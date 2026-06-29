// ─────────────────────────────────────────────────────────────
//  Garment3DPreview — CLO-3D-style live 3D garment view.
//  Drapes a tailored t-shirt (with the flattened artboard mapped onto
//  the chest as a <Decal>) over a photoreal rigged human GLB. If the
//  GLB can't load (offline / CDN blocked), it gracefully falls back to
//  a procedural mannequin body so the preview never blanks.
//  Clears the Three cache on unmount to avoid WebGL context leaks.
// ─────────────────────────────────────────────────────────────

/* eslint-disable @typescript-eslint/no-explicit-any */
import { Suspense, useMemo, useState, useEffect, Component, type ReactNode } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Decal, useTexture, useGLTF, ContactShadows, Center, Html } from "@react-three/drei";
import * as THREE from "three";
import { X, Loader2, RotateCcw, Box, User } from "lucide-react";

// Free, CC-licensed rigged human avatar (Ready Player Me). Swappable via
// VITE_STUDIO_HUMAN_GLB. A-pose, ~1.8m tall, origin at the feet.
const HUMAN_GLB =
  (import.meta as any).env?.VITE_STUDIO_HUMAN_GLB ||
  "https://models.readyplayer.me/64bfa15f0e72c63d7c3934a6.glb";

const GARMENT_COLORS: { key: string; label: string; hex: string }[] = [
  { key: "white", label: "White", hex: "#f4f4f5" },
  { key: "black", label: "Black", hex: "#18181b" },
  { key: "sand", label: "Sand", hex: "#d8c9b0" },
  { key: "navy", label: "Navy", hex: "#1e2a44" },
  { key: "olive", label: "Olive", hex: "#5a5f3f" },
];

// ── Photoreal rigged human GLB (preferred body) ───────────────────────────────
function HumanBody({ isDark }: { isDark: boolean }) {
  // useGLTF's type is a union (single url vs array); we always pass one url.
  const { scene } = useGLTF(HUMAN_GLB) as unknown as { scene: THREE.Object3D };
  // Clone so we never mutate the cached source, and tone down emissive so the
  // avatar reads as a neutral mannequin under studio lighting.
  const model = useMemo(() => {
    const c = scene.clone(true);
    c.traverse((o: any) => {
      if (o.isMesh) {
        o.castShadow = false;
        o.receiveShadow = false;
        if (o.material) {
          o.material = o.material.clone();
          o.material.envMapIntensity = isDark ? 0.5 : 0.8;
        }
      }
    });
    return c;
  }, [scene, isDark]);

  // RPM avatars stand ~1.8 units tall with feet at the origin. Lift + scale so
  // the chest sits where the shirt decal is mapped.
  return <primitive object={model} position={[0, -1.25, 0]} scale={1.35} />;
}

// ── Procedural mannequin (graceful fallback when the GLB can't load) ──────────
function ProceduralBody({ isDark }: { isDark: boolean }) {
  const skinColor = isDark ? "#1f1f21" : "#e4e4e7";
  const skinMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({ color: skinColor, roughness: 0.45, metalness: 0.12 }),
    [skinColor],
  );

  return (
    <group>
      {/* Head */}
      <mesh position={[0, 2.0, 0]} material={skinMaterial}><sphereGeometry args={[0.22, 32, 32]} /></mesh>
      {/* Neck */}
      <mesh position={[0, 1.72, 0]} material={skinMaterial}><cylinderGeometry args={[0.1, 0.12, 0.35, 32]} /></mesh>
      {/* Shoulders / clavicle beam */}
      <mesh position={[0, 1.5, 0]} material={skinMaterial}><capsuleGeometry args={[0.12, 0.8, 16, 32]} /></mesh>
      {/* Lower body / hips */}
      <mesh position={[0, 0.05, 0]} material={skinMaterial}><cylinderGeometry args={[0.28, 0.24, 0.6, 32]} /></mesh>
      <mesh position={[0, -0.25, 0]} material={skinMaterial}><capsuleGeometry args={[0.24, 0.3, 16, 32]} /></mesh>
      {/* Arms hanging at the sides */}
      {[-1, 1].map((s) => (
        <group key={`arm-${s}`} position={[s * 0.48, 1.4, 0]}>
          <mesh position={[s * 0.06, -0.25, 0]} rotation={[0, 0, s * 0.15]} material={skinMaterial}><capsuleGeometry args={[0.09, 0.5, 16, 32]} /></mesh>
          <mesh position={[s * 0.16, -0.75, 0]} rotation={[0, 0, s * 0.08]} material={skinMaterial}><capsuleGeometry args={[0.08, 0.5, 16, 32]} /></mesh>
        </group>
      ))}
    </group>
  );
}

// Error boundary so a failed GLB fetch swaps in the procedural body instead of
// blanking the whole preview.
class BodyBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

// The tailored t-shirt garment + chest decal. Always rendered on top of the
// body so the print mapping and colour swatches behave identically regardless
// of which body (GLB or procedural) is underneath.
function Shirt({ color, design }: { color: string; design: string }) {
  const texture = useTexture(design);
  texture.anisotropy = 8;

  const shirtMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0.05, side: THREE.DoubleSide }),
    [color],
  );

  return (
    <group>
      {/* Torso shirt body — carries the chest decal */}
      <mesh position={[0, 0.78, 0.01]} material={shirtMaterial}>
        <cylinderGeometry args={[0.39, 0.34, 1.25, 64, 1, true]} />
        <Decal position={[0, 0.28, 0.39]} rotation={[0, 0, 0]} scale={[0.55, 0.75, 0.5]}>
          <meshStandardMaterial map={texture} transparent polygonOffset polygonOffsetFactor={-4} roughness={0.85} depthTest />
        </Decal>
      </mesh>
      {/* Shoulder yoke */}
      <mesh position={[0, 1.4, 0]} material={shirtMaterial}><capsuleGeometry args={[0.395, 0.76, 32, 64]} /></mesh>
      {/* Collar trim */}
      <mesh position={[0, 1.55, 0]} rotation={[Math.PI / 2, 0, 0]} material={shirtMaterial}><torusGeometry args={[0.13, 0.03, 16, 64]} /></mesh>
      {/* Sleeves */}
      <mesh position={[-0.45, 1.34, 0]} rotation={[0, 0, 0.45]} material={shirtMaterial}><cylinderGeometry args={[0.14, 0.135, 0.35, 32, 1, true]} /></mesh>
      <mesh position={[0.45, 1.34, 0]} rotation={[0, 0, -0.45]} material={shirtMaterial}><cylinderGeometry args={[0.14, 0.135, 0.35, 32, 1, true]} /></mesh>
    </group>
  );
}

// Composes the body (GLB → procedural fallback) with the shirt + decal.
function Figure({ color, design, isDark }: { color: string; design: string; isDark: boolean }) {
  return (
    <Center>
      <group position={[0, -0.6, 0]}>
        <BodyBoundary fallback={<ProceduralBody isDark={isDark} />}>
          <Suspense fallback={<ProceduralBody isDark={isDark} />}>
            <HumanBody isDark={isDark} />
          </Suspense>
        </BodyBoundary>
        <Shirt color={color} design={design} />
      </group>
    </Center>
  );
}

export default function Garment3DPreview({
  design,
  onClose,
  isDark = true,
  canMockup = false,
  fetchMockups,
}: {
  design: string; // transparent PNG data URL of the flattened artboard
  onClose: () => void;
  isDark?: boolean;
  canMockup?: boolean; // true when a Printful product variant is available
  fetchMockups?: () => Promise<string[]>;
}) {
  const [color, setColor] = useState(GARMENT_COLORS[0].hex);
  const [spin, setSpin] = useState(true);
  const [tab, setTab] = useState<"3d" | "real">("3d");
  const [mockups, setMockups] = useState<string[] | null>(null);
  const [mockBusy, setMockBusy] = useState(false);

  // Clear memory cache upon closing the component to prevent WebGL Context Losses
  useEffect(() => {
    return () => {
      THREE.Cache.clear();
    };
  }, []);

  const openReal = async () => {
    setTab("real");
    if (mockups || mockBusy || !fetchMockups) return;
    setMockBusy(true);
    try { setMockups(await fetchMockups()); }
    finally { setMockBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-black/95 backdrop-blur-md">
      {/* Top bar */}
      <div className="flex items-center justify-between px-5 py-4 shrink-0">
        <div className="flex items-center gap-2">
          <div className="flex gap-1 rounded-full bg-white/10 p-1">
            <button onClick={() => setTab("3d")}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[10px] font-semibold uppercase tracking-widest transition-colors ${tab === "3d" ? "bg-white text-black" : "text-white/60 hover:text-white"}`}>
              <Box size={12} /> 3D
            </button>
            {canMockup && (
              <button onClick={openReal}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[10px] font-semibold uppercase tracking-widest transition-colors ${tab === "real" ? "bg-white text-black" : "text-white/60 hover:text-white"}`}>
                <User size={12} /> Realistic
              </button>
            )}
          </div>
          <span className="hidden sm:inline text-[9px] uppercase tracking-widest text-white/40">
            {tab === "3d" ? "drag to rotate · scroll to zoom" : "photoreal on-model · exact print"}
          </span>
        </div>
        <button
          onClick={onClose}
          className="flex items-center gap-1.5 rounded-full bg-white/10 px-4 py-2 text-[10px] font-semibold uppercase tracking-widest text-white transition-colors hover:bg-white/20"
        >
          <X size={13} /> Close
        </button>
      </div>

      {/* Realistic on-model mockups */}
      {tab === "real" && (
        <div className="flex-1 overflow-y-auto px-5 pb-6">
          {mockBusy ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-white/50">
              <Loader2 className="animate-spin" />
              <span className="text-[10px] uppercase tracking-widest">Rendering photoreal mockup…</span>
            </div>
          ) : mockups && mockups.length > 0 ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {mockups.map((url) => (
                <img key={url} src={url} alt="On-model mockup" className="w-full rounded-2xl bg-white/5 object-contain" />
              ))}
            </div>
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-white/50">
              <User size={28} className="opacity-40" />
              <span className="text-[10px] uppercase tracking-widest">No mockup available</span>
              {fetchMockups && <button onClick={() => { setMockups(null); openReal(); }} className="rounded-full bg-white/10 px-4 py-2 text-[10px] uppercase tracking-widest text-white hover:bg-white/20">Retry</button>}
            </div>
          )}
        </div>
      )}

      {/* 3D viewport */}
      <div className={`relative flex-1 ${tab === "real" ? "hidden" : ""}`}>
        <Canvas
          camera={{ position: [0, 0, 5.4], fov: 38 }}
          dpr={[1, 1.5]}
          gl={{ antialias: true, powerPreference: "high-performance", preserveDrawingBuffer: false }}
        >
          <color attach="background" args={[isDark ? "#0a0a0b" : "#101012"]} />
          {/* Soft studio lighting */}
          <hemisphereLight args={["#ffffff", "#3a3a40", 0.85]} />
          <ambientLight intensity={0.35} />
          <directionalLight position={[3, 5, 4]} intensity={1.1} />
          <directionalLight position={[-4, 2, -3]} intensity={0.45} />
          <directionalLight position={[0, 2, -5]} intensity={0.35} />
          <Suspense fallback={
            <Html center>
              <div className="flex flex-col items-center justify-center gap-2">
                <Loader2 className="animate-spin text-white" />
                <span className="text-[10px] text-white/50 uppercase tracking-widest">Loading model…</span>
              </div>
            </Html>
          }>
            <Figure color={color} design={design} isDark={isDark} />
          </Suspense>
          <ContactShadows position={[0, -1.95, 0]} opacity={0.4} scale={9} blur={2.6} far={3.5} />
          <OrbitControls
            enablePan={false}
            autoRotate={spin}
            autoRotateSpeed={1.4}
            minDistance={3}
            maxDistance={8}
            target={[0, 0, 0]}
            onStart={() => setSpin(false)}
          />
        </Canvas>
      </div>

      {/* Bottom controls: garment color + reset spin (3D tab only) */}
      <div className={`flex items-center justify-center gap-3 px-5 py-5 shrink-0 ${tab === "real" ? "hidden" : ""}`}>
        <div className="flex items-center gap-2 rounded-full bg-white/10 px-3 py-2">
          {GARMENT_COLORS.map((c) => (
            <button
              key={c.key}
              onClick={() => setColor(c.hex)}
              aria-label={c.label}
              title={c.label}
              className={`h-6 w-6 rounded-full border transition-transform hover:scale-110 ${
                color === c.hex ? "border-white ring-2 ring-white/50" : "border-white/20"
              }`}
              style={{ backgroundColor: c.hex }}
            />
          ))}
        </div>
        <button
          onClick={() => setSpin((v) => !v)}
          className="flex items-center gap-1.5 rounded-full bg-white/10 px-4 py-2 text-[10px] font-semibold uppercase tracking-widest text-white transition-colors hover:bg-white/20"
        >
          <RotateCcw size={13} /> {spin ? "Stop spin" : "Auto spin"}
        </button>
      </div>
    </div>
  );
}

// Preload the avatar so the first open is snappy; harmless if the CDN is blocked.
try { useGLTF.preload(HUMAN_GLB); } catch { /* noop */ }
