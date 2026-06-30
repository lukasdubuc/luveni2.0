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
import { Suspense, useMemo, useState, useEffect } from "react";
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

// Calibration: a standard 12" front print maps to this decal width on the chest.
const REF_PRINT_W_IN = 12;
const REF_DECAL_W = 0.62;
const CHEST_R = 0.42; // torso half-width; the flattened front carries the decal

// A realistic display mannequin (smooth, neutral, featureless — like a CLO/store
// dress form) WEARING the tee: neutral body underneath, coloured shirt over the
// torso, and the design mapped onto the chest true-to-print. Reliable, no asset.
function Mannequin({ color, design, printWidthIn, printHeightIn, isDark }: { color: string; design: string; printWidthIn?: number | null; printHeightIn?: number | null; isDark: boolean }) {
  const texture = useTexture(design);
  texture.anisotropy = 8;

  const skinColor = isDark ? "#3b3b40" : "#dcd5cb"; // matte mannequin material
  const skin = useMemo(() => new THREE.MeshStandardMaterial({ color: skinColor, roughness: 0.85, metalness: 0.03 }), [skinColor]);
  const shirt = useMemo(() => new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0.03, side: THREE.DoubleSide }), [color]);

  // True-to-print decal: width from the real print width vs a 12" baseline.
  const decalScale = useMemo<[number, number, number]>(() => {
    const w = printWidthIn && printWidthIn > 0 ? (printWidthIn / REF_PRINT_W_IN) * REF_DECAL_W : REF_DECAL_W;
    const aspect = printHeightIn && printHeightIn > 0
      ? printHeightIn / printWidthIn!
      : (texture.image ? (texture.image as any).height / (texture.image as any).width : 1.25);
    return [w, w * aspect, 0.6];
  }, [printWidthIn, printHeightIn, texture]);
  const decalY = 0.92 - decalScale[1] * 0.5; // anchor just below the collar

  return (
    <Center>
      <group>
        {/* ── Mannequin body (neutral) ── */}
        {/* Head — smooth featureless ovoid */}
        <mesh position={[0, 1.9, 0]} scale={[0.8, 1, 0.84]} material={skin} castShadow>
          <sphereGeometry args={[0.26, 48, 40]} />
        </mesh>
        {/* Neck */}
        <mesh position={[0, 1.55, 0]} material={skin}>
          <cylinderGeometry args={[0.1, 0.12, 0.28, 32]} />
        </mesh>
        {/* Pelvis / hips below the shirt hem */}
        <mesh position={[0, -0.12, 0]} scale={[1, 1, 0.72]} material={skin} castShadow>
          <sphereGeometry args={[0.33, 40, 32]} />
        </mesh>
        {/* Upper legs (taper down, framing a full human form) */}
        {[-1, 1].map((s) => (
          <mesh key={`leg-${s}`} position={[s * 0.16, -0.85, 0]} material={skin} castShadow>
            <capsuleGeometry args={[0.15, 1.0, 16, 28]} />
          </mesh>
        ))}
        {/* Upper arms (neutral, at the sides) */}
        {[-1, 1].map((s) => (
          <mesh key={`uarm-${s}`} position={[s * 0.5, 0.62, 0]} rotation={[0, 0, s * 0.13]} material={skin} castShadow>
            <capsuleGeometry args={[0.1, 0.78, 16, 28]} />
          </mesh>
        ))}

        {/* ── Shirt worn over the torso ── */}
        {/* Shoulders / upper chest cap */}
        <mesh position={[0, 1.26, 0]} scale={[1.16, 0.72, 0.78]} material={shirt} castShadow>
          <sphereGeometry args={[0.42, 48, 36]} />
        </mesh>
        {/* Torso shirt body — flattened front/back so it reads like a chest */}
        <mesh position={[0, 0.62, 0]} scale={[1, 1, 0.66]} material={shirt} castShadow receiveShadow>
          <cylinderGeometry args={[CHEST_R, 0.36, 1.3, 64, 1, false]} />
          {/* Chest decal — the user's design, true-to-print */}
          <Decal position={[0, decalY, CHEST_R]} rotation={[0, 0, 0]} scale={decalScale}>
            <meshStandardMaterial map={texture} transparent polygonOffset polygonOffsetFactor={-4} roughness={0.85} depthTest />
          </Decal>
        </mesh>
        {/* Collar */}
        <mesh position={[0, 1.46, 0]} rotation={[Math.PI / 2, 0, 0]} material={shirt}>
          <torusGeometry args={[0.13, 0.035, 16, 48]} />
        </mesh>
        {/* Short sleeves */}
        {[-1, 1].map((s) => (
          <mesh key={`slv-${s}`} position={[s * 0.5, 1.0, 0]} rotation={[0, 0, s * 0.5]} material={shirt} castShadow>
            <cylinderGeometry args={[0.17, 0.155, 0.42, 32, 1, true]} />
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
        <Canvas shadows camera={{ position: [0, 0, 5.0], fov: 40 }} dpr={[1, 2]}>
          <color attach="background" args={[isDark ? "#0a0a0b" : "#101012"]} />
          <ambientLight intensity={0.6} />
          <directionalLight position={[3, 5, 4]} intensity={1.4} castShadow shadow-mapSize={[1024, 1024]} />
          <directionalLight position={[-4, 2, -2]} intensity={0.5} />
          <Suspense fallback={null}>
            <Mannequin color={color} design={design} isDark={isDark} printWidthIn={printWidthIn} printHeightIn={printHeightIn} />
            <Environment preset="studio" />
          </Suspense>
          <ContactShadows position={[0, -1.75, 0]} opacity={0.4} scale={8} blur={2.6} far={3.2} />
          {/* Orbit around the body's centre (not the feet). */}
          <OrbitControls
            enablePan={false}
            autoRotate={spin}
            autoRotateSpeed={1.6}
            target={[0, 0, 0]}
            minDistance={2.8}
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
