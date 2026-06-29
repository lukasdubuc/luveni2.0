// ─────────────────────────────────────────────────────────────
//  Garment3DPreview — live 3D garment view.
//  A single, correctly-proportioned mannequin that actually WEARS the
//  t-shirt: body + fitted shirt + chest <Decal> all live in one coordinate
//  space, so the print sits on the chest and the figure is never oversized.
//  The decal is sized true-to-print from the real front-print dimensions.
//
//  For a photoreal human-on-model render, the "Realistic" tab uses Printful's
//  mockup generator (the exact print on a real product photo). That tab is the
//  default whenever a Printful variant is available.
// ─────────────────────────────────────────────────────────────

/* eslint-disable @typescript-eslint/no-explicit-any */
import { Suspense, useMemo, useState, useEffect } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Decal, useTexture, ContactShadows, Center, Html } from "@react-three/drei";
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
// chest. Real print widths scale linearly from here.
const REF_PRINT_W_IN = 12;
const REF_DECAL_W = 0.62;

// One mannequin that wears the shirt. Body + shirt + decal share the same
// local space so the garment is always on the figure at a sane scale.
function Mannequin({
  color, design, isDark, printWidthIn, printHeightIn,
}: {
  color: string; design: string; isDark: boolean; printWidthIn?: number | null; printHeightIn?: number | null;
}) {
  const texture = useTexture(design);
  texture.anisotropy = 8;

  const skinColor = isDark ? "#2a2a2e" : "#d9d4cc";
  const skin = useMemo(
    () => new THREE.MeshStandardMaterial({ color: skinColor, roughness: 0.6, metalness: 0.05 }),
    [skinColor],
  );
  const shirt = useMemo(
    () => new THREE.MeshStandardMaterial({ color, roughness: 0.82, metalness: 0.04, side: THREE.DoubleSide }),
    [color],
  );

  // True-to-print decal scale: width from the real print width vs a 12" baseline,
  // height from the real print aspect (falls back to the texture's own aspect).
  const decalScale = useMemo<[number, number, number]>(() => {
    const w = printWidthIn && printWidthIn > 0 ? (printWidthIn / REF_PRINT_W_IN) * REF_DECAL_W : REF_DECAL_W;
    const aspect = printHeightIn && printHeightIn > 0
      ? printHeightIn / printWidthIn!
      : (texture.image ? (texture.image as any).height / (texture.image as any).width : 1.25);
    return [w, w * aspect, 0.6];
  }, [printWidthIn, printHeightIn, texture]);

  // Anchor the print just below the collar and let it grow downward.
  const decalY = 0.74 - decalScale[1] * 0.5;

  return (
    <Center>
      <group position={[0, -0.15, 0]} scale={0.92}>
        {/* ── Body ── */}
        {/* Head */}
        <mesh position={[0, 1.42, 0]} material={skin}><sphereGeometry args={[0.2, 32, 32]} /></mesh>
        {/* Neck */}
        <mesh position={[0, 1.2, 0]} material={skin}><cylinderGeometry args={[0.085, 0.1, 0.22, 24]} /></mesh>
        {/* Hips / legs base (below the shirt hem) */}
        <mesh position={[0, -0.35, 0]} material={skin}><cylinderGeometry args={[0.22, 0.18, 0.5, 32]} /></mesh>
        {/* Forearms peeking from the sleeves */}
        {[-1, 1].map((s) => (
          <mesh key={s} position={[s * 0.4, 0.42, 0]} rotation={[0, 0, s * 0.18]} material={skin}>
            <capsuleGeometry args={[0.07, 0.42, 12, 24]} />
          </mesh>
        ))}

        {/* ── Shirt (worn on the torso) ── */}
        {/* Torso — carries the chest print */}
        <mesh position={[0, 0.42, 0]} material={shirt}>
          <cylinderGeometry args={[0.34, 0.3, 1.15, 64, 1, true]} />
          <Decal position={[0, decalY, 0.34]} rotation={[0, 0, 0]} scale={decalScale}>
            <meshStandardMaterial map={texture} transparent polygonOffset polygonOffsetFactor={-4} roughness={0.82} depthTest />
          </Decal>
        </mesh>
        {/* Closed top + shoulders */}
        <mesh position={[0, 0.96, 0]} material={shirt}><sphereGeometry args={[0.34, 48, 32, 0, Math.PI * 2, 0, Math.PI / 2]} /></mesh>
        {/* Shoulder yoke (horizontal capsule across the shoulders) */}
        <mesh position={[0, 0.92, 0]} rotation={[0, 0, Math.PI / 2]} material={shirt}><capsuleGeometry args={[0.33, 0.62, 24, 48]} /></mesh>
        {/* Collar */}
        <mesh position={[0, 1.08, 0]} rotation={[Math.PI / 2, 0, 0]} material={shirt}><torusGeometry args={[0.11, 0.025, 16, 48]} /></mesh>
        {/* Sleeves */}
        {[-1, 1].map((s) => (
          <mesh key={s} position={[s * 0.4, 0.72, 0]} rotation={[0, 0, s * 0.5]} material={shirt}>
            <cylinderGeometry args={[0.12, 0.115, 0.42, 32, 1, true]} />
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
  // Default to the photoreal Printful render when it's available — that's the
  // real human-on-model result; 3D is the live stylized preview.
  const [tab, setTab] = useState<"3d" | "real">(canMockup ? "real" : "3d");
  const [mockups, setMockups] = useState<string[] | null>(null);
  const [mockBusy, setMockBusy] = useState(false);

  useEffect(() => () => { THREE.Cache.clear(); }, []);

  const openReal = async () => {
    setTab("real");
    if (mockups || mockBusy || !fetchMockups) return;
    setMockBusy(true);
    try { setMockups(await fetchMockups()); }
    finally { setMockBusy(false); }
  };

  // Auto-render the mockup on open when Realistic is the default tab.
  useEffect(() => {
    if (canMockup && fetchMockups && !mockups && !mockBusy) {
      setMockBusy(true);
      fetchMockups().then(setMockups).finally(() => setMockBusy(false));
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
              <Box size={12} /> 3D
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
        <Canvas
          camera={{ position: [0, 0.1, 4.6], fov: 40 }}
          dpr={[1, 1.5]}
          gl={{ antialias: true, powerPreference: "high-performance", preserveDrawingBuffer: false }}
        >
          <color attach="background" args={[isDark ? "#0a0a0b" : "#101012"]} />
          <hemisphereLight args={["#ffffff", "#3a3a40", 0.85]} />
          <ambientLight intensity={0.35} />
          <directionalLight position={[3, 5, 4]} intensity={1.1} />
          <directionalLight position={[-4, 2, -3]} intensity={0.45} />
          <directionalLight position={[0, 2, -5]} intensity={0.35} />
          <Suspense fallback={
            <Html center>
              <div className="flex flex-col items-center justify-center gap-2">
                <Loader2 className="animate-spin text-white" />
                <span className="text-[10px] text-white/50 uppercase tracking-widest">Loading…</span>
              </div>
            </Html>
          }>
            <Mannequin color={color} design={design} isDark={isDark} printWidthIn={printWidthIn} printHeightIn={printHeightIn} />
          </Suspense>
          <ContactShadows position={[0, -1.25, 0]} opacity={0.4} scale={6} blur={2.6} far={3} />
          <OrbitControls
            enablePan={false}
            autoRotate={spin}
            autoRotateSpeed={1.4}
            minDistance={2.6}
            maxDistance={7}
            target={[0, 0.1, 0]}
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
