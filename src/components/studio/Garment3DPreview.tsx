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
import { Suspense, useMemo, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Decal, useTexture, Environment, ContactShadows, Center } from "@react-three/drei";
import * as THREE from "three";
import { X, Loader2, RotateCcw, Box, User } from "lucide-react";

const GARMENT_COLORS: { key: string; label: string; hex: string }[] = [
  { key: "white", label: "White", hex: "#f4f4f5" },
  { key: "black", label: "Black", hex: "#18181b" },
  { key: "sand", label: "Sand", hex: "#d8c9b0" },
  { key: "navy", label: "Navy", hex: "#1e2a44" },
  { key: "olive", label: "Olive", hex: "#5a5f3f" },
];

// Calibration: a standard 12" front print maps to this decal width on the
// torso; real print widths scale linearly from here.
const REF_PRINT_W_IN = 12;
const REF_DECAL_W = 1.25;

// A soft-knit fabric material so light reads like cloth, not plastic.
function fabric(color: string) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.92, metalness: 0.02 });
}

// Procedural t-shirt: a rounded torso + two angled sleeves, on a neck/head so
// the garment reads on a human form. Not a CAD pattern, but enough volume for
// a convincing live preview & decal.
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
      : (texture.image ? (texture.image as any).height / (texture.image as any).width : 1.4 / 1.25);
    return [w, w * aspect, 1.2];
  }, [printWidthIn, printHeightIn, texture]);

  return (
    <Center>
      <group rotation={[0, 0, 0]}>
        {/* Mannequin — neck + head so the garment reads on a human form */}
        <mesh position={[0, 1.62, 0.05]} material={skin}>
          <cylinderGeometry args={[0.26, 0.34, 0.5, 24]} />
        </mesh>
        <mesh position={[0, 2.18, 0.05]} material={skin} castShadow>
          <sphereGeometry args={[0.42, 32, 24]} />
        </mesh>
        {/* Torso */}
        <mesh castShadow receiveShadow material={mat}>
          <capsuleGeometry args={[0.95, 1.5, 12, 32]} />
          {/* Chest decal — the user's design, true-to-print */}
          <Decal
            position={[0, 0.35, 0.92]}
            rotation={[0, 0, 0]}
            scale={decalScale}
          >
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

        {/* Shoulders */}
        <mesh position={[0, 0.95, 0]} material={mat} castShadow>
          <sphereGeometry args={[0.98, 24, 16]} />
        </mesh>

        {/* Sleeves */}
        {[-1, 1].map((s) => (
          <mesh
            key={s}
            position={[s * 1.05, 0.7, 0]}
            rotation={[0, 0, (s * Math.PI) / 4]}
            material={mat}
            castShadow
          >
            <capsuleGeometry args={[0.42, 0.7, 8, 20]} />
          </mesh>
        ))}

        {/* Collar */}
        <mesh position={[0, 1.32, 0.18]} rotation={[Math.PI / 2.4, 0, 0]} material={mat}>
          <torusGeometry args={[0.34, 0.1, 12, 32]} />
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
            <Tee color={color} design={design} printWidthIn={printWidthIn} printHeightIn={printHeightIn} />
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
