// ─────────────────────────────────────────────────────────────
//  Garment3DPreview — CLO-3D-style live 3D garment view.
//  Maps the flattened artboard (transparent PNG) onto a procedural
//  t-shirt mesh as a chest decal, on a simple neck/head form so the
//  garment reads as worn. Orbit, studio lighting, garment base colors,
//  plus a "Realistic" tab for Printful's photoreal on-model mockup.
//  Three.js is DOM-only so this is loaded lazily by the editor.
//
//  The chest decal is sized true-to-print from the product's real front
//  print dimensions (falls back to a sensible default when unknown).
// ─────────────────────────────────────────────────────────────

/* eslint-disable @typescript-eslint/no-explicit-any */
import { Suspense, useMemo, useState, useEffect, Component, type ReactNode } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Decal, useTexture, useGLTF, Environment, ContactShadows, Center } from "@react-three/drei";
import * as THREE from "three";
import { X, Loader2, RotateCcw, Box, User } from "lucide-react";

// A rigged human wearing a t-shirt (three.js "Soldier" asset, hosted locally so
// it loads offline with no draco decoder). Swappable via VITE_STUDIO_HUMAN_GLB.
const HUMAN_GLB = (import.meta as any).env?.VITE_STUDIO_HUMAN_GLB || "/models/figure.glb";

// Real rigged human in a tee, with the design mapped onto the chest true-to-print.
function HumanFigure({ design, printWidthIn, printHeightIn }: { design: string; printWidthIn?: number | null; printHeightIn?: number | null }) {
  const { scene } = useGLTF(HUMAN_GLB) as unknown as { scene: THREE.Object3D };
  const texture = useTexture(design);
  texture.anisotropy = 8;

  // Clone + normalize: scale to a consistent height and re-center at the origin.
  const { model, chestY, chestZ } = useMemo(() => {
    const c = scene.clone(true);
    c.traverse((o: any) => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; } });
    const box = new THREE.Box3().setFromObject(c);
    const size = new THREE.Vector3(); box.getSize(size);
    const center = new THREE.Vector3(); box.getCenter(center);
    const targetH = 2.7;
    const s = targetH / (size.y || 1.8);
    c.scale.setScalar(s);
    c.position.set(-center.x * s, -center.y * s, -center.z * s);
    // Chest sits a bit above the vertical centre; front surface ≈ half the depth.
    return { model: c, chestY: targetH * 0.30, chestZ: (size.z * 0.5 * s) * 0.7 + 0.02 };
  }, [scene]);

  // True-to-print chest panel: width from the real print width vs a 12" baseline.
  const [w, h] = useMemo(() => {
    const width = (printWidthIn && printWidthIn > 0 ? printWidthIn / 12 : 1) * 0.5;
    const aspect = printHeightIn && printWidthIn ? printHeightIn / printWidthIn
      : (texture.image ? (texture.image as any).height / (texture.image as any).width : 1.25);
    return [width, width * aspect];
  }, [printWidthIn, printHeightIn, texture]);

  return (
    <group>
      <primitive object={model} />
      {/* Design on the chest (slightly proud of the shirt so it always reads). */}
      <mesh position={[0, chestY, chestZ]}>
        <planeGeometry args={[w, h]} />
        <meshStandardMaterial map={texture} transparent roughness={0.85} polygonOffset polygonOffsetFactor={-4} />
      </mesh>
    </group>
  );
}

// Swaps in the procedural tee if the GLB can't load, so the view never blanks.
class FigureBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

const GARMENT_COLORS: { key: string; label: string; hex: string }[] = [
  { key: "white", label: "White", hex: "#f4f4f5" },
  { key: "black", label: "Black", hex: "#18181b" },
  { key: "sand", label: "Sand", hex: "#d8c9b0" },
  { key: "navy", label: "Navy", hex: "#1e2a44" },
  { key: "olive", label: "Olive", hex: "#5a5f3f" },
];

// Calibration: a standard 12" front print maps to this decal width on the
// chest; real print widths scale linearly from here.
const REF_PRINT_W_IN = 12;
const REF_DECAL_W = 0.95;
const TORSO_R = 0.7; // torso radius — decal sits on the front of the chest

// A soft-knit fabric material so light reads like cloth, not plastic.
function fabric(color: string) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.92, metalness: 0.02 });
}

// Procedural human torso wearing a fitted tee: tapered torso, shoulder yoke,
// neck + head and arms hanging at the sides so it reads as a proportional
// person — not a blob. Enough form for a convincing live preview & decal.
function Tee({ color, design, printWidthIn, printHeightIn }: { color: string; design: string; printWidthIn?: number | null; printHeightIn?: number | null }) {
  const mat = useMemo(() => fabric(color), [color]);
  const skin = useMemo(() => new THREE.MeshStandardMaterial({ color: "#cdb09a", roughness: 0.7, metalness: 0.02 }), []);
  const texture = useTexture(design);
  texture.anisotropy = 8;

  // True-to-print decal scale: width from the real print width vs a 12" baseline,
  // height from the real print aspect (falls back to the texture's own aspect).
  const decalScale = useMemo<[number, number, number]>(() => {
    const w = printWidthIn && printWidthIn > 0 ? (printWidthIn / REF_PRINT_W_IN) * REF_DECAL_W : REF_DECAL_W;
    const aspect = printHeightIn && printHeightIn > 0
      ? printHeightIn / printWidthIn!
      : (texture.image ? (texture.image as any).height / (texture.image as any).width : 1.25);
    return [w, w * aspect, 1.0];
  }, [printWidthIn, printHeightIn, texture]);

  return (
    <Center>
      <group rotation={[0, 0, 0]}>
        {/* Head + neck */}
        <mesh position={[0, 2.02, 0]} material={skin} castShadow>
          <sphereGeometry args={[0.32, 32, 24]} />
        </mesh>
        <mesh position={[0, 1.62, 0]} material={skin}>
          <cylinderGeometry args={[0.14, 0.17, 0.34, 24]} />
        </mesh>

        {/* Shoulder yoke (horizontal capsule reads as shoulders, not a ball) */}
        <mesh position={[0, 1.34, 0]} rotation={[0, 0, Math.PI / 2]} material={mat} castShadow>
          <capsuleGeometry args={[0.24, 1.0, 16, 32]} />
        </mesh>

        {/* Torso (tapered, narrower than the shoulders so it reads human) */}
        <mesh position={[0, 0.5, 0]} material={mat} castShadow receiveShadow>
          <capsuleGeometry args={[TORSO_R, 1.25, 16, 48]} />
          {/* Chest decal — the user's design, true-to-print */}
          <Decal position={[0, 0.4, TORSO_R]} rotation={[0, 0, 0]} scale={decalScale}>
            <meshStandardMaterial
              map={texture}
              transparent
              polygonOffset
              polygonOffsetFactor={-1}
              roughness={0.9}
              depthTest
            />
          </Decal>
        </mesh>

        {/* Upper arms hanging at the sides */}
        {[-1, 1].map((s) => (
          <mesh key={`arm-${s}`} position={[s * 0.82, 0.78, 0]} rotation={[0, 0, s * 0.16]} material={mat} castShadow>
            <capsuleGeometry args={[0.17, 1.0, 12, 28]} />
          </mesh>
        ))}

        {/* Short sleeves at the shoulders */}
        {[-1, 1].map((s) => (
          <mesh key={`slv-${s}`} position={[s * 0.78, 1.16, 0]} rotation={[0, 0, s * 0.5]} material={mat} castShadow>
            <capsuleGeometry args={[0.25, 0.34, 10, 24]} />
          </mesh>
        ))}

        {/* Collar */}
        <mesh position={[0, 1.5, 0]} rotation={[Math.PI / 2, 0, 0]} material={mat}>
          <torusGeometry args={[0.17, 0.05, 12, 36]} />
        </mesh>
      </group>
    </Center>
  );
}

export default function Garment3DPreview({
  design,
  onClose,
  isDark = true,
  canMockup = false,
  printWidthIn = null,
  printHeightIn = null,
  fetchMockups,
}: {
  design: string; // transparent PNG data URL of the flattened artboard
  onClose: () => void;
  isDark?: boolean;
  canMockup?: boolean; // true when a Printful product variant is available
  printWidthIn?: number | null;  // real front-print width (inches) for true-to-size decal
  printHeightIn?: number | null; // real front-print height (inches)
  fetchMockups?: () => Promise<string[]>;
}) {
  const [color, setColor] = useState(GARMENT_COLORS[0].hex);
  const [spin, setSpin] = useState(true);
  // Default to the photoreal on-model render when it's available — that's the
  // real human wearing the exact product with the design; the 3D tab is a quick
  // stylized preview.
  const [tab, setTab] = useState<"3d" | "real">(canMockup ? "real" : "3d");
  const [mockups, setMockups] = useState<string[] | null>(null);
  const [mockBusy, setMockBusy] = useState(false);

  const openReal = async () => {
    setTab("real");
    if (mockups || mockBusy || !fetchMockups) return;
    setMockBusy(true);
    try { setMockups(await fetchMockups()); }
    finally { setMockBusy(false); }
  };

  // Auto-render the photoreal mockup on open when it's the default tab.
  useEffect(() => {
    if (canMockup && fetchMockups && !mockups && !mockBusy) {
      setMockBusy(true);
      fetchMockups().then(setMockups).catch(() => {}).finally(() => setMockBusy(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-black/95 backdrop-blur-md">
      {/* Top bar */}
      <div className="flex items-center justify-between px-5 py-4 shrink-0">
        <div className="flex items-center gap-2">
          <div className="flex gap-1 rounded-full bg-white/10 p-1">
            {canMockup && (
              <button onClick={openReal}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[10px] font-semibold uppercase tracking-widest transition-colors ${tab === "real" ? "bg-white text-black" : "text-white/60 hover:text-white"}`}>
                <User size={12} /> Realistic
              </button>
            )}
            <button onClick={() => setTab("3d")}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[10px] font-semibold uppercase tracking-widest transition-colors ${tab === "3d" ? "bg-white text-black" : "text-white/60 hover:text-white"}`}>
              <Box size={12} /> 3D Preview
            </button>
          </div>
          <span className="hidden sm:inline text-[9px] uppercase tracking-widest text-white/40">
            {tab === "3d"
              ? (printWidthIn && printHeightIn
                  ? `drag to rotate · print ${printWidthIn}″ × ${printHeightIn}″ true-to-size`
                  : "drag to rotate · scroll to zoom")
              : "photoreal on-model · exact print"}
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
        <Canvas shadows camera={{ position: [0, 0.3, 4.2], fov: 40 }} dpr={[1, 2]}>
          <color attach="background" args={[isDark ? "#0a0a0b" : "#101012"]} />
          <ambientLight intensity={0.6} />
          <directionalLight position={[3, 5, 4]} intensity={1.4} castShadow shadow-mapSize={[1024, 1024]} />
          <directionalLight position={[-4, 2, -2]} intensity={0.5} />
          <Suspense fallback={null}>
            {/* Real rigged human in a tee; falls back to the procedural tee. */}
            <FigureBoundary fallback={<Tee color={color} design={design} printWidthIn={printWidthIn} printHeightIn={printHeightIn} />}>
              <Suspense fallback={<Tee color={color} design={design} printWidthIn={printWidthIn} printHeightIn={printHeightIn} />}>
                <HumanFigure design={design} printWidthIn={printWidthIn} printHeightIn={printHeightIn} />
              </Suspense>
            </FigureBoundary>
            <Environment preset="studio" />
          </Suspense>
          <ContactShadows position={[0, -1.6, 0]} opacity={0.45} scale={8} blur={2.5} far={3} />
          <OrbitControls
            enablePan={false}
            autoRotate={spin}
            autoRotateSpeed={1.6}
            minDistance={2.6}
            maxDistance={7}
            onStart={() => setSpin(false)}
          />
        </Canvas>

        {/* Loading hint */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <Suspense fallback={<Loader2 className="animate-spin text-white/40" />}>{null}</Suspense>
        </div>
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

// Preload the figure so the first open is instant; harmless if it fails.
try { useGLTF.preload(HUMAN_GLB); } catch { /* noop */ }
