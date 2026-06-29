// ─────────────────────────────────────────────────────────────
//  Garment3DPreview — CLO-3D-style live 3D garment view.
//  Maps the flattened artboard (transparent PNG) onto a procedural
//  t-shirt mesh as a chest decal, with orbit, lighting and a few
//  garment base colors. Three.js is DOM-only so this is loaded
//  lazily by the editor (never on SSR).
// ─────────────────────────────────────────────────────────────

/* eslint-disable @typescript-eslint/no-explicit-any */
import { Suspense, useMemo, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Decal, useTexture, ContactShadows, Center } from "@react-three/drei";
import * as THREE from "three";
import { X, Loader2, RotateCcw, Box, User } from "lucide-react";

const GARMENT_COLORS: { key: string; label: string; hex: string }[] = [
  { key: "white", label: "White", hex: "#f4f4f5" },
  { key: "black", label: "Black", hex: "#18181b" },
  { key: "sand", label: "Sand", hex: "#d8c9b0" },
  { key: "navy", label: "Navy", hex: "#1e2a44" },
  { key: "olive", label: "Olive", hex: "#5a5f3f" },
];

// A soft-knit fabric material so light reads like cloth, not plastic.
function fabric(color: string) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.92, metalness: 0.02 });
}

// Procedural t-shirt: a rounded torso + two angled sleeves. Not a CAD
// pattern, but enough volume for a convincing live preview & decal.
function Tee({ color, design }: { color: string; design: string }) {
  const mat = useMemo(() => fabric(color), [color]);
  const skin = useMemo(() => new THREE.MeshStandardMaterial({ color: "#cdb09a", roughness: 0.7, metalness: 0.02 }), []);
  const texture = useTexture(design);
  texture.anisotropy = 8;

  return (
    <Center>
      {/* Human mannequin (skin) with the shirt worn over the torso + upper arms */}
      <group>
        {/* Head */}
        <mesh position={[0, 2.55, 0]} material={skin}><sphereGeometry args={[0.46, 32, 24]} /></mesh>
        {/* Neck */}
        <mesh position={[0, 2.0, 0]} material={skin}><cylinderGeometry args={[0.2, 0.26, 0.45, 24]} /></mesh>

        {/* Hips / waist below the shirt hem (skin) */}
        <mesh position={[0, -0.35, 0]} material={skin}><capsuleGeometry args={[0.62, 0.5, 8, 24]} /></mesh>

        {/* Forearms (skin) hanging below the sleeves */}
        {[-1, 1].map((s) => (
          <mesh key={`fa${s}`} position={[s * 0.92, 0.35, 0]} rotation={[0, 0, s * 0.12]} material={skin}>
            <capsuleGeometry args={[0.16, 0.85, 8, 20]} />
          </mesh>
        ))}

        {/* ── Shirt ── */}
        {/* Shoulders / yoke */}
        <mesh position={[0, 1.5, 0]} material={mat}><sphereGeometry args={[0.78, 28, 20]} /></mesh>
        {/* Collar */}
        <mesh position={[0, 1.78, 0]} rotation={[Math.PI / 2, 0, 0]} material={mat}><torusGeometry args={[0.24, 0.07, 12, 28]} /></mesh>
        {/* Torso — slightly tapered chest→waist; carries the chest decal */}
        <mesh position={[0, 0.75, 0]} material={mat}>
          <capsuleGeometry args={[0.72, 1.35, 16, 36]} />
          <Decal position={[0, 0.28, 0.7]} rotation={[0, 0, 0]} scale={[1.0, 1.15, 1.0]}>
            <meshStandardMaterial map={texture} transparent polygonOffset polygonOffsetFactor={-1} roughness={0.92} depthTest />
          </Decal>
        </mesh>
        {/* Short sleeves over the upper arms */}
        {[-1, 1].map((s) => (
          <mesh key={`sl${s}`} position={[s * 0.82, 1.15, 0]} rotation={[0, 0, s * 0.55]} material={mat}>
            <capsuleGeometry args={[0.28, 0.5, 10, 24]} />
          </mesh>
        ))}
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
          {/* Soft studio lighting — no network HDR, so no context churn */}
          <hemisphereLight args={["#ffffff", "#3a3a40", 0.85]} />
          <ambientLight intensity={0.35} />
          <directionalLight position={[3, 5, 4]} intensity={1.1} />
          <directionalLight position={[-4, 2, -3]} intensity={0.45} />
          <directionalLight position={[0, 2, -5]} intensity={0.35} />
          <Suspense fallback={null}>
            <Tee color={color} design={design} />
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
