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

// Optional real avatar: set VITE_STUDIO_HUMAN_GLB to a glTF/GLB URL (a CLO/VRoid/
// Blender export converted to glTF, hosted on /public, Supabase storage, or any
// public URL). When set, the 3D view loads it and maps the design onto the
// chest; otherwise it uses the built-in procedural mannequin. Dormant by default.
const HUMAN_GLB: string = (import.meta as any).env?.VITE_STUDIO_HUMAN_GLB || "";

// Loads a real glTF avatar (draco-enabled) and maps the design onto its chest.
function AvatarFigure({ url, design, printWidthIn, printHeightIn }: { url: string; design: string; printWidthIn?: number | null; printHeightIn?: number | null }) {
  const { scene } = useGLTF(url, true) as unknown as { scene: THREE.Object3D };
  const texture = useTexture(design);
  texture.anisotropy = 8;

  const { model, chestY, chestZ } = useMemo(() => {
    const c = scene.clone(true);
    c.traverse((o: any) => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; } });
    const box = new THREE.Box3().setFromObject(c);
    const size = new THREE.Vector3(); box.getSize(size);
    const center = new THREE.Vector3(); box.getCenter(center);
    const targetH = 3.4;
    const s = targetH / (size.y || 1.8);
    c.scale.setScalar(s);
    c.position.set(-center.x * s, -center.y * s, -center.z * s);
    return { model: c, chestY: targetH * 0.22, chestZ: (size.z * 0.5 * s) * 0.78 + 0.02 };
  }, [scene]);

  const [w, h] = useMemo(() => {
    const width = (printWidthIn && printWidthIn > 0 ? printWidthIn / 12 : 1) * 0.55;
    const aspect = printHeightIn && printWidthIn ? printHeightIn / printWidthIn
      : (texture.image ? (texture.image as any).height / (texture.image as any).width : 1.25);
    return [width, width * aspect];
  }, [printWidthIn, printHeightIn, texture]);

  return (
    <group>
      <primitive object={model} />
      <mesh position={[0, chestY, chestZ]}>
        <planeGeometry args={[w, h]} />
        <meshStandardMaterial map={texture} transparent roughness={0.85} polygonOffset polygonOffsetFactor={-4} />
      </mesh>
    </group>
  );
}

// Falls back to the procedural mannequin if the avatar can't load.
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

// Calibration: a standard 12" front print maps to this decal width on the chest.
const REF_PRINT_W_IN = 12;
const REF_DECAL_W = 0.62;
const CHEST_R = 0.42; // torso half-width; the flattened front carries the decal

// Builds a smooth, anatomically-proportioned human torso as a lathed surface of
// revolution: a vertical profile of (radius, height) control points lofted around
// Y, then squashed front-to-back so it reads like a real chest/waist/hip taper
// rather than a plain cylinder. One welded mesh = no seams between body segments.
function lathedBody(profile: [number, number][], segments = 64): THREE.BufferGeometry {
  const points = profile.map(([r, y]) => new THREE.Vector2(Math.max(r, 0.001), y));
  const geo = new THREE.LatheGeometry(points, segments);
  geo.computeVertexNormals();
  return geo;
}

// A realistic display figure — a smooth, neutral human form (like a CLO/Browzwear
// avatar or a high-end store mannequin) WEARING the tee. The body is built from
// lathed anatomical profiles (head, neck, torso, arms, legs) so the silhouette
// reads as a real person; the fitted shirt drapes over the torso and the design
// is mapped onto the chest true-to-print. Reliable, no external asset required.
function Mannequin({ color, design, printWidthIn, printHeightIn, isDark }: { color: string; design: string; printWidthIn?: number | null; printHeightIn?: number | null; isDark: boolean }) {
  const texture = useTexture(design);
  texture.anisotropy = 8;

  const skinColor = isDark ? "#caa890" : "#e8c9b0"; // warm neutral mannequin skin
  const skin = useMemo(() => new THREE.MeshStandardMaterial({ color: skinColor, roughness: 0.62, metalness: 0.0 }), [skinColor]);
  const shirt = useMemo(() => new THREE.MeshStandardMaterial({ color, roughness: 0.78, metalness: 0.02, side: THREE.DoubleSide }), [color]);

  // ── Anatomical geometry (built once) ──────────────────────────────────────
  const geo = useMemo(() => {
    // Head: rounded ovoid (jaw narrows toward chin, crown rounds off).
    const head = lathedBody([
      [0.0, 1.78], [0.11, 1.80], [0.18, 1.86], [0.205, 1.95],
      [0.205, 2.05], [0.18, 2.14], [0.11, 2.20], [0.0, 2.22],
    ]);
    // Neck → trapezius slope into the shoulders.
    const neck = lathedBody([
      [0.0, 1.56], [0.095, 1.57], [0.10, 1.66], [0.12, 1.74], [0.16, 1.78], [0.0, 1.79],
    ]);
    // Torso: shoulders → chest → narrowing waist → flaring hips → pelvis.
    const torso = lathedBody([
      [0.0, 1.62], [0.30, 1.58], [0.40, 1.50], [0.43, 1.36], // shoulder/chest
      [0.40, 1.20], [0.35, 1.00], [0.315, 0.80],             // ribcage → waist
      [0.33, 0.60], [0.39, 0.40], [0.41, 0.22],              // hips
      [0.36, 0.06], [0.22, -0.04], [0.0, -0.06],             // pelvis floor
    ]);
    // Limb segment helper (tapered capsule-like profile).
    const limb = (rTop: number, rBot: number, len: number) => lathedBody([
      [0.0, len], [rTop * 0.7, len], [rTop, len - rTop * 0.6],
      [rBot, rBot * 0.6], [rBot * 0.7, 0], [0.0, 0],
    ], 40);
    // Fitted tee shell — slightly larger than the torso so it drapes over it.
    const shirtBody = lathedBody([
      [0.0, 1.50], [0.33, 1.46], [0.44, 1.36],
      [0.45, 1.18], [0.40, 0.96], [0.375, 0.74],
      [0.40, 0.56], [0.46, 0.40], [0.47, 0.30],
    ]);
    return {
      head, neck, torso, shirtBody,
      upperArm: limb(0.10, 0.085, 0.62),
      foreArm: limb(0.083, 0.062, 0.58),
      thigh: limb(0.155, 0.11, 0.82),
      calf: limb(0.115, 0.07, 0.82),
    };
  }, []);

  // True-to-print decal: width from the real print width vs a 12" baseline.
  const decalScale = useMemo<[number, number, number]>(() => {
    const w = printWidthIn && printWidthIn > 0 ? (printWidthIn / REF_PRINT_W_IN) * REF_DECAL_W : REF_DECAL_W;
    const aspect = printHeightIn && printHeightIn > 0
      ? printHeightIn / printWidthIn!
      : (texture.image ? (texture.image as any).height / (texture.image as any).width : 1.25);
    return [w, w * aspect, 0.6];
  }, [printWidthIn, printHeightIn, texture]);
  const decalY = 0.95 - decalScale[1] * 0.5; // anchor just below the collar

  // Front-to-back squash so lathed bodies read as a human (deeper than wide → no).
  const torsoZ = 0.62;

  return (
    <Center>
      <group>
        {/* ── Body (neutral human form) ── */}
        <mesh geometry={geo.head} material={skin} castShadow />
        <mesh geometry={geo.neck} material={skin} castShadow />
        {/* Torso underneath the shirt — gives the shirt a real body to drape on */}
        <mesh geometry={geo.torso} material={skin} scale={[1, 1, torsoZ]} castShadow receiveShadow />

        {/* Arms — upper arm at the shoulder, slight outward angle, then forearm */}
        {[-1, 1].map((s) => (
          <group key={`arm-${s}`} position={[s * 0.43, 1.5, 0]} rotation={[0, 0, s * 0.16]}>
            <mesh geometry={geo.upperArm} material={skin} position={[0, -0.62, 0]} castShadow />
            <group position={[s * 0.06, -0.62, 0.04]} rotation={[0.18, 0, s * 0.05]}>
              <mesh geometry={geo.foreArm} material={skin} position={[0, -0.58, 0]} castShadow />
              {/* Hand — simple rounded paddle */}
              <mesh position={[0, -0.66, 0]} scale={[0.6, 1, 0.4]} material={skin} castShadow>
                <sphereGeometry args={[0.08, 24, 20]} />
              </mesh>
            </group>
          </group>
        ))}

        {/* Legs — thigh then calf, slight stance */}
        {[-1, 1].map((s) => (
          <group key={`leg-${s}`} position={[s * 0.17, -0.02, 0]}>
            <mesh geometry={geo.thigh} material={skin} position={[0, -0.82, 0]} castShadow />
            <group position={[0, -0.82, 0]}>
              <mesh geometry={geo.calf} material={skin} position={[0, -0.82, 0]} castShadow />
              {/* Foot */}
              <mesh position={[0, -0.86, 0.06]} scale={[0.6, 0.4, 1.3]} material={skin} castShadow>
                <sphereGeometry args={[0.1, 24, 20]} />
              </mesh>
            </group>
          </group>
        ))}

        {/* ── Fitted tee worn over the torso ── */}
        {/* Shirt body: lathed shell slightly larger than the torso so it drapes */}
        <mesh material={shirt} geometry={geo.shirtBody} scale={[1, 1, torsoZ * 1.06]} castShadow receiveShadow>
          {/* Chest decal — the user's design, true-to-print */}
          <Decal position={[0, decalY, CHEST_R * torsoZ * 1.06]} rotation={[0, 0, 0]} scale={decalScale}>
            <meshStandardMaterial map={texture} transparent polygonOffset polygonOffsetFactor={-4} roughness={0.78} depthTest />
          </Decal>
        </mesh>
        {/* Ribbed crew collar */}
        <mesh position={[0, 1.48, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[1, torsoZ * 1.1, 1]} material={shirt}>
          <torusGeometry args={[0.16, 0.028, 16, 48]} />
        </mesh>
        {/* Short sleeves — angled down over the upper arms */}
        {[-1, 1].map((s) => (
          <mesh key={`slv-${s}`} position={[s * 0.42, 1.28, 0]} rotation={[0, 0, s * 0.42]} scale={[1, 1, 0.82]} material={shirt} castShadow>
            <cylinderGeometry args={[0.165, 0.135, 0.46, 36, 1, true]} />
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
        <Canvas shadows camera={{ position: [0, 0, 6.4], fov: 38 }} dpr={[1, 2]}>
          <color attach="background" args={[isDark ? "#0a0a0b" : "#101012"]} />
          <ambientLight intensity={0.5} />
          <directionalLight position={[3, 5, 4]} intensity={1.5} castShadow shadow-mapSize={[2048, 2048]} />
          <directionalLight position={[-4, 2, -2]} intensity={0.55} />
          {/* Soft rim from behind to separate the figure from the dark backdrop */}
          <directionalLight position={[0, 3, -5]} intensity={0.4} />
          <Suspense fallback={null}>
            {HUMAN_GLB ? (
              <FigureBoundary fallback={<Mannequin color={color} design={design} isDark={isDark} printWidthIn={printWidthIn} printHeightIn={printHeightIn} />}>
                <Suspense fallback={<Mannequin color={color} design={design} isDark={isDark} printWidthIn={printWidthIn} printHeightIn={printHeightIn} />}>
                  <AvatarFigure url={HUMAN_GLB} design={design} printWidthIn={printWidthIn} printHeightIn={printHeightIn} />
                </Suspense>
              </FigureBoundary>
            ) : (
              <Mannequin color={color} design={design} isDark={isDark} printWidthIn={printWidthIn} printHeightIn={printHeightIn} />
            )}
            <Environment preset="studio" />
          </Suspense>
          <ContactShadows position={[0, -2.5, 0]} opacity={0.45} scale={8} blur={2.6} far={3.2} />
          {/* Orbit around the body's centre (not the feet). */}
          <OrbitControls
            enablePan={false}
            autoRotate={spin}
            autoRotateSpeed={1.6}
            target={[0, 0, 0]}
            minDistance={3.2}
            maxDistance={9}
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
