// ─────────────────────────────────────────────────────────────
//  Garment3DPreview — CLO-3D-quality live 3D garment viewer
//
//  Features:
//  • Anatomically-detailed procedural human mannequin (LatheGeometry
//    torso + CapsuleGeometry limbs + spheroid head with face features)
//  • Full artboard (garment template + design layers) projected onto
//    the shirt front as a flat plane — exactly what CLO-3D does
//  • Live canvas sync via useFrame + CanvasTexture every paint stroke
//  • PBR fabric material (MeshPhysicalMaterial) with sheen for cloth feel
//  • Camera presets: Front · Back · Left · 3/4
//  • Wireframe toggle · auto-spin · PNG export
//  • Environment presets: Studio · Soft · Outdoor
//  • Default tab: 3D (realistic/mockup tab optional)
// ─────────────────────────────────────────────────────────────

/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  Suspense, useMemo, useState, useEffect, useRef,
  Component, type ReactNode,
} from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  OrbitControls, useTexture, useGLTF,
  Environment, ContactShadows, Center, Grid,
} from "@react-three/drei";
import * as THREE from "three";
import {
  X, Loader2, RotateCcw, Box, User, Download,
  Camera, Grid3X3, Eye, ChevronLeft, ChevronRight,
} from "lucide-react";

import { useMeasurementSystem, formatLength } from "@/lib/units";

// Optional real avatar GLB
const HUMAN_GLB: string = (import.meta as any).env?.VITE_STUDIO_HUMAN_GLB || "";

// ── Garment color swatch palette ──────────────────────────────────────────────
const GARMENT_COLORS = [
  { key: "white",  label: "White",  hex: "#f4f4f5" },
  { key: "black",  label: "Black",  hex: "#18181b" },
  { key: "sand",   label: "Sand",   hex: "#d8c9b0" },
  { key: "navy",   label: "Navy",   hex: "#1e2a44" },
  { key: "olive",  label: "Olive",  hex: "#5a5f3f" },
  { key: "red",    label: "Red",    hex: "#b91c1c" },
  { key: "royal",  label: "Royal",  hex: "#1d4ed8" },
  { key: "forest", label: "Forest", hex: "#14532d" },
];

// ── Fabric presets (CLO-3D style) — how the cloth catches light ───────────────
type FabricKey = "cotton" | "denim" | "knit" | "silk" | "fleece";
const FABRICS: Record<FabricKey, { label: string; roughness: number; sheen: number; sheenRoughness: number; metalness: number }> = {
  cotton: { label: "Cotton", roughness: 0.82, sheen: 0.25, sheenRoughness: 0.6, metalness: 0.01 },
  denim:  { label: "Denim",  roughness: 0.93, sheen: 0.12, sheenRoughness: 0.85, metalness: 0.0 },
  knit:   { label: "Knit",   roughness: 0.88, sheen: 0.45, sheenRoughness: 0.4, metalness: 0.0 },
  silk:   { label: "Silk",   roughness: 0.34, sheen: 0.9,  sheenRoughness: 0.18, metalness: 0.04 },
  fleece: { label: "Fleece", roughness: 0.97, sheen: 0.6,  sheenRoughness: 0.5, metalness: 0.0 },
};

// ── Body calibration constants ─────────────────────────────────────────────────
const BODY_H = 3.4;         // total body height in scene units
const HEAD_R = 0.225;       // skull sphere radius
const TORSO_Z = 0.60;       // depth squash (front-to-back / side-to-side ratio)
const SHIRT_FRONT_Z = 0.295; // Z of shirt surface at chest
const SHIRT_W = 0.92;       // projected shirt front width
const SHIRT_H = 1.30;       // projected shirt front height

// ── Procedural fabric normal map (weave + soft wrinkles) ─────────────────────
//  Generates a tiling normal map on a canvas so the shirt catches light like
//  real cloth — a woven micro-texture plus low-frequency folds. No external
//  asset needed. Cached per fabric so it's built once.
const _normalCache = new Map<FabricKey, THREE.CanvasTexture>();
function fabricNormalMap(fabric: FabricKey): THREE.CanvasTexture {
  const cached = _normalCache.get(fabric);
  if (cached) return cached;
  const S = 256;
  const cvs = document.createElement("canvas");
  cvs.width = cvs.height = S;
  const ctx = cvs.getContext("2d")!;
  // Base normal = flat surface (R,G = 128, B = 255).
  ctx.fillStyle = "rgb(128,128,255)";
  ctx.fillRect(0, 0, S, S);

  // Weave period + amplitude per fabric.
  const weave: Record<FabricKey, { period: number; amp: number; wrinkle: number }> = {
    cotton: { period: 6, amp: 26, wrinkle: 18 },
    denim:  { period: 5, amp: 40, wrinkle: 14 },
    knit:   { period: 9, amp: 34, wrinkle: 22 },
    silk:   { period: 4, amp: 10, wrinkle: 26 },
    fleece: { period: 11, amp: 30, wrinkle: 30 },
  };
  const { period, amp, wrinkle } = weave[fabric];

  // Woven thread micro-normals: perturb the R (x) and G (y) channels.
  const img = ctx.getImageData(0, 0, S, S);
  const d = img.data;
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const i = (y * S + x) * 4;
      const warp = Math.sin((x / period) * Math.PI * 2) * amp;
      const weft = Math.sin((y / period) * Math.PI * 2) * amp;
      // Low-frequency folds via layered sines (organic wrinkle direction).
      const foldX = Math.sin((x / 70) + Math.cos(y / 90)) * wrinkle;
      const foldY = Math.cos((y / 64) + Math.sin(x / 110)) * wrinkle;
      d[i]     = Math.max(0, Math.min(255, 128 + warp + foldX));
      d[i + 1] = Math.max(0, Math.min(255, 128 + weft + foldY));
      // Keep B high so normals stay mostly surface-facing.
      d[i + 2] = 235 + ((x ^ y) & 7);
    }
  }
  ctx.putImageData(img, 0, 0);

  const tex = new THREE.CanvasTexture(cvs);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 4);
  tex.needsUpdate = true;
  _normalCache.set(fabric, tex);
  return tex;
}

// Normal-map strength per fabric (denim/fleece read rougher/foldier).
const NORMAL_STRENGTH: Record<FabricKey, number> = {
  cotton: 0.5, denim: 0.85, knit: 0.7, silk: 0.28, fleece: 0.9,
};

// ── Utility: build LatheGeometry from profile points ─────────────────────────
function lathe(profile: [number, number][], segs = 64): THREE.BufferGeometry {
  const pts = profile.map(([r, y]) => new THREE.Vector2(Math.max(r, 0.001), y));
  const g = new THREE.LatheGeometry(pts, segs);
  g.computeVertexNormals();
  return g;
}

// ── Camera preset controller (inside Canvas) ─────────────────────────────────
function CameraPreset({ preset, onDone }: { preset: string | null; onDone: () => void }) {
  const { camera } = useThree();
  useEffect(() => {
    if (!preset) return;
    const targets: Record<string, [number, number, number]> = {
      front:  [0, 0.2, 5.8],
      back:   [0, 0.2, -5.8],
      left:   [-5.8, 0.2, 0],
      right:  [5.8, 0.2, 0],
      q3d:    [3.8, 0.8, 4.2],
      top:    [0, 6.0, 0.1],
    };
    const t = targets[preset] || targets.front;
    camera.position.set(t[0], t[1], t[2]);
    camera.lookAt(0, 0.2, 0);
    onDone();
  }, [preset]);
  return null;
}

// ── Realistic human mannequin ─────────────────────────────────────────────────
function Mannequin({
  color,
  liveCanvas,
  staticDesign,
  isDark,
  showWire,
  fabric,
}: {
  color: string;
  liveCanvas?: HTMLCanvasElement | null;
  staticDesign?: string;
  isDark: boolean;
  showWire: boolean;
  fabric?: FabricKey;
}) {
  const fab = FABRICS[fabric ?? "cotton"];
  // ── Live canvas texture ─────────────────────────────────────────────────────
  const liveTexRef = useRef<THREE.CanvasTexture | null>(null);
  useEffect(() => {
    if (!liveCanvas) return;
    const t = new THREE.CanvasTexture(liveCanvas);
    t.anisotropy = 8;
    t.flipY = true;
    liveTexRef.current = t;
    return () => { t.dispose(); liveTexRef.current = null; };
  }, [liveCanvas]);
  useFrame(() => { if (liveTexRef.current) liveTexRef.current.needsUpdate = true; });

  // Static fallback texture
  const staticTex = useTexture(staticDesign || "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==");
  const designTex = liveTexRef.current ?? (staticDesign ? staticTex : null);

  // ── Materials ───────────────────────────────────────────────────────────────
  const skinHex = isDark ? "#c9a882" : "#ddb896";
  const skin = useMemo(() => new THREE.MeshPhysicalMaterial({
    color: skinHex,
    roughness: 0.68,
    metalness: 0,
    sheen: 0.12,
    sheenColor: new THREE.Color("#f0c8a8"),
    clearcoat: 0.04,
    clearcoatRoughness: 0.82,
  }), [skinHex]);

  const hairMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: isDark ? "#1a0a00" : "#2c1800",
    roughness: 0.98,
    metalness: 0,
  }), [isDark]);

  const eyeMat = useMemo(() => new THREE.MeshStandardMaterial({ color: "#1a1a2e", roughness: 0.2, metalness: 0.1 }), []);
  const eyeWhite = useMemo(() => new THREE.MeshStandardMaterial({ color: "#f5f5f5", roughness: 0.5 }), []);
  const lipMat = useMemo(() => new THREE.MeshStandardMaterial({ color: "#c87070", roughness: 0.6 }), []);

  const fabricNormal = useMemo(() => fabricNormalMap(fabric ?? "cotton"), [fabric]);
  const shirt = useMemo(() => new THREE.MeshPhysicalMaterial({
    color,
    roughness: fab.roughness,
    metalness: fab.metalness,
    sheen: fab.sheen,
    sheenColor: new THREE.Color(color),
    sheenRoughness: fab.sheenRoughness,
    // High-fidelity fabric folds/wrinkles via procedural normal map.
    normalMap: fabricNormal,
    normalScale: new THREE.Vector2(
      NORMAL_STRENGTH[fabric ?? "cotton"],
      NORMAL_STRENGTH[fabric ?? "cotton"],
    ),
    side: THREE.DoubleSide,
    wireframe: showWire,
  }), [color, showWire, fab, fabricNormal, fabric]);

  const designMat = useMemo(() => designTex ? new THREE.MeshBasicMaterial({
    map: designTex,
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -4,
  }) : null, [designTex]);

  // ── Procedural geometry ─────────────────────────────────────────────────────
  const geo = useMemo(() => {
    // Skull: ovoid – taller than wide, narrower front-to-back
    const skull = new THREE.SphereGeometry(HEAD_R, 64, 48);

    // Jaw: slightly oblate sphere blending into skull base
    const jaw = new THREE.SphereGeometry(HEAD_R * 0.82, 32, 24);

    // Ear: flattened torus
    const ear = new THREE.TorusGeometry(0.055, 0.028, 12, 28);

    // Eyelid groove: small flattened sphere
    const eyeSphere = new THREE.SphereGeometry(0.033, 16, 12);

    // Nose: oblate bump
    const nose = new THREE.SphereGeometry(0.028, 12, 10);

    // Lip segment
    const lip = new THREE.SphereGeometry(0.048, 12, 8);

    // Hair cap: upper hemisphere, scaled taller for volume
    const hair = new THREE.SphereGeometry(HEAD_R * 1.05, 32, 32, 0, Math.PI * 2, 0, Math.PI * 0.52);

    // Neck: tapered cylinder section
    const neck = lathe([
      [0.0, 1.54], [0.09, 1.555], [0.10, 1.64],
      [0.115, 1.725], [0.16, 1.77], [0.0, 1.775],
    ]);

    // Torso: highly detailed silhouette — shoulder peak, chest, waist pinch, hip flare, pelvis
    const torso = lathe([
      [0.00, 1.615],
      [0.22, 1.605], [0.36, 1.57], [0.435, 1.50],  // shoulder into chest
      [0.445, 1.38], [0.435, 1.24],                  // upper chest
      [0.41,  1.10], [0.37,  0.96], [0.335, 0.82],  // ribcage
      [0.305, 0.68], [0.298, 0.58],                  // waist
      [0.315, 0.46], [0.365, 0.34], [0.405, 0.20],  // hips
      [0.41,  0.08], [0.36,  -0.02], [0.22, -0.07], [0.0, -0.09],
    ], 80);

    // Fitted tee shell: slightly larger than torso, has realistic hem/cuff shape
    const shirtBody = lathe([
      [0.00, 1.505],
      [0.245, 1.495], [0.38, 1.46], [0.46, 1.395],
      [0.475, 1.275], [0.465, 1.155],
      [0.445, 1.015], [0.41,  0.875], [0.385, 0.755],
      [0.37,  0.63],  [0.365, 0.525],
      [0.385, 0.40],  [0.42,  0.30],  [0.445, 0.22],
    ], 80);

    // Limb helper (tapered capsule profile)
    const capsule = (rTop: number, rBot: number, len: number, segs = 40) =>
      lathe([
        [0.0, len],      [rTop * 0.65, len],      [rTop, len - rTop * 0.55],
        [rTop * 0.98, len * 0.70], [(rTop + rBot) / 2, len * 0.45],
        [rBot, rBot * 0.55], [rBot * 0.65, 0], [0.0, 0],
      ], segs);

    return {
      skull, jaw, ear, eyeSphere, nose, lip, hair, neck, torso, shirtBody,
      upperArm:  capsule(0.105, 0.090, 0.64),
      foreArm:   capsule(0.088, 0.065, 0.60),
      hand:      new THREE.SphereGeometry(0.075, 20, 16),
      thigh:     capsule(0.162, 0.118, 0.84),
      calf:      capsule(0.120, 0.074, 0.84),
      foot:      new THREE.SphereGeometry(0.10,  20, 14),
    };
  }, []);

  return (
    <Center>
      <group>
        {/* ── HEAD ─────────────────────────────────────────────────────────── */}
        <group position={[0, 1.84, 0]}>
          {/* Skull */}
          <mesh geometry={geo.skull} material={skin} scale={[0.87, 1.0, 0.82]} castShadow />
          {/* Jaw: slightly lower, blends into skull */}
          <mesh geometry={geo.jaw} material={skin} position={[0, -0.09, 0.02]} scale={[0.88, 0.68, 0.84]} castShadow />
          {/* Ears */}
          {[-1, 1].map((s) => (
            <mesh key={`ear-${s}`} geometry={geo.ear} material={skin}
              position={[s * HEAD_R * 0.87, 0.02, 0]}
              rotation={[0, s * Math.PI / 2, 0]}
              scale={[0.5, 1, 0.28]} castShadow />
          ))}
          {/* Eye whites */}
          {[-1, 1].map((s) => (
            <group key={`eye-${s}`} position={[s * 0.075, 0.04, HEAD_R * 0.68]}>
              <mesh geometry={geo.eyeSphere} material={eyeWhite} scale={[1, 0.72, 0.52]} />
              {/* Iris */}
              <mesh geometry={geo.eyeSphere} material={eyeMat} scale={[0.58, 0.42, 0.60]} position={[0, 0, 0.01]} />
            </group>
          ))}
          {/* Nose bridge + tip */}
          <mesh geometry={geo.nose} material={skin} position={[0, -0.03, HEAD_R * 0.76]} scale={[1.1, 1.6, 1.2]} />
          <mesh geometry={geo.nose} material={skin} position={[0, -0.07, HEAD_R * 0.78]} scale={[1.4, 0.9, 1.3]} />
          {/* Lips */}
          <mesh geometry={geo.lip} material={lipMat} position={[0, -0.135, HEAD_R * 0.74]} scale={[1.6, 0.55, 0.85]} />
          <mesh geometry={geo.lip} material={lipMat} position={[0, -0.158, HEAD_R * 0.73]} scale={[1.3, 0.48, 0.78]} />
          {/* Hair cap */}
          <mesh geometry={geo.hair} material={hairMat}
            position={[0, 0.045, -0.012]}
            scale={[0.88, 1.05, 0.86]}
            rotation={[0, 0, 0]}
            castShadow />
          {/* Short hair sides */}
          {[-1, 1].map((s) => (
            <mesh key={`hair-s-${s}`} geometry={geo.hair} material={hairMat}
              position={[s * HEAD_R * 0.62, -0.06, -0.03]}
              scale={[0.46, 0.65, 0.44]}
              rotation={[0.1, s * 0.4, s * 0.15]}
              castShadow />
          ))}
        </group>

        {/* ── NECK ─────────────────────────────────────────────────────────── */}
        <mesh geometry={geo.neck} material={skin} castShadow />

        {/* ── TORSO (under shirt) ──────────────────────────────────────────── */}
        <mesh geometry={geo.torso} material={skin} scale={[1, 1, TORSO_Z]} castShadow receiveShadow />

        {/* ── ARMS ─────────────────────────────────────────────────────────── */}
        {[-1, 1].map((s) => (
          <group key={`arm-${s}`} position={[s * 0.455, 1.52, 0]} rotation={[0.04, 0, s * 0.18]}>
            <mesh geometry={geo.upperArm} material={skin} position={[0, -0.64, 0]} castShadow />
            <group position={[s * 0.055, -0.64, 0.038]} rotation={[0.20, 0, s * 0.06]}>
              <mesh geometry={geo.foreArm} material={skin} position={[0, -0.60, 0]} castShadow />
              {/* Hand */}
              <mesh geometry={geo.hand} material={skin} position={[0, -0.68, 0]} scale={[0.72, 0.58, 0.48]} castShadow />
              {/* Thumb */}
              <mesh geometry={geo.hand} material={skin} position={[s * 0.038, -0.66, 0.03]} scale={[0.28, 0.42, 0.28]} castShadow />
            </group>
          </group>
        ))}

        {/* ── LEGS ─────────────────────────────────────────────────────────── */}
        {[-1, 1].map((s) => (
          <group key={`leg-${s}`} position={[s * 0.175, -0.04, 0]}>
            <mesh geometry={geo.thigh} material={skin} position={[0, -0.84, 0]} castShadow />
            <group position={[0, -0.84, 0]}>
              <mesh geometry={geo.calf} material={skin} position={[0, -0.84, 0]} castShadow />
              {/* Foot */}
              <mesh geometry={geo.foot} material={skin}
                position={[s * 0.02, -0.90, 0.08]}
                scale={[0.62, 0.38, 1.45]}
                castShadow />
            </group>
          </group>
        ))}

        {/* ── FITTED TEE ──────────────────────────────────────────────────── */}
        <mesh geometry={geo.shirtBody} material={shirt} scale={[1, 1, TORSO_Z * 1.07]} castShadow receiveShadow />

        {/* Crew collar ring */}
        <mesh position={[0, 1.49, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[1, TORSO_Z * 1.12, 1]} material={shirt} castShadow>
          <torusGeometry args={[0.162, 0.029, 16, 52]} />
        </mesh>

        {/* Short sleeves — cuffed cylinders over upper arms */}
        {[-1, 1].map((s) => (
          <mesh key={`slv-${s}`}
            position={[s * 0.445, 1.29, 0]}
            rotation={[0, 0, s * 0.44]}
            scale={[1, 1, 0.80]}
            material={shirt} castShadow>
            <cylinderGeometry args={[0.170, 0.145, 0.48, 38, 1, true]} />
          </mesh>
        ))}

        {/* ── DESIGN + TEMPLATE PROJECTION (full artboard canvas onto shirt front) ── */}
        {designMat && (
          <mesh
            position={[0, 0.62, SHIRT_FRONT_Z + 0.002]}
            rotation={[0, 0, 0]}
            renderOrder={1}
          >
            <planeGeometry args={[SHIRT_W, SHIRT_H]} />
            <primitive object={designMat} attach="material" />
          </mesh>
        )}
      </group>
    </Center>
  );
}

// ── GLB avatar with design plane overlay ─────────────────────────────────────
function AvatarFigure({ url, liveCanvas, staticDesign }: { url: string; liveCanvas?: HTMLCanvasElement | null; staticDesign?: string }) {
  const { scene } = useGLTF(url, true) as unknown as { scene: THREE.Object3D };
  const liveTexRef = useRef<THREE.CanvasTexture | null>(null);
  useEffect(() => {
    if (!liveCanvas) return;
    const t = new THREE.CanvasTexture(liveCanvas);
    t.anisotropy = 8; t.flipY = true;
    liveTexRef.current = t;
    return () => { t.dispose(); liveTexRef.current = null; };
  }, [liveCanvas]);
  useFrame(() => { if (liveTexRef.current) liveTexRef.current.needsUpdate = true; });

  const staticTex = useTexture(staticDesign || "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==");
  const designTex = liveTexRef.current ?? (staticDesign ? staticTex : null);

  const model = useMemo(() => {
    const c = scene.clone(true);
    c.traverse((o: any) => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; } });
    const box = new THREE.Box3().setFromObject(c);
    const sz = new THREE.Vector3(); box.getSize(sz);
    const ctr = new THREE.Vector3(); box.getCenter(ctr);
    const s = BODY_H / (sz.y || 1.8);
    c.scale.setScalar(s);
    c.position.set(-ctr.x * s, -ctr.y * s, -ctr.z * s);
    return { model: c, chestZ: (sz.z * 0.5 * s) * 0.78 + 0.02 };
  }, [scene]);

  const designMat = useMemo(() => designTex ? new THREE.MeshBasicMaterial({
    map: designTex, transparent: true, depthWrite: false,
    polygonOffset: true, polygonOffsetFactor: -4,
  }) : null, [designTex]);

  return (
    <group>
      <primitive object={model.model} />
      {designMat && (
        <mesh position={[0, 0.62, model.chestZ + 0.002]}>
          <planeGeometry args={[SHIRT_W, SHIRT_H]} />
          <primitive object={designMat} attach="material" />
        </mesh>
      )}
    </group>
  );
}

// ── Error boundary ────────────────────────────────────────────────────────────
class FigureBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

// ── Camera angle presets ──────────────────────────────────────────────────────
const CAM_PRESETS = [
  { id: "front", label: "Front",  icon: "↑" },
  { id: "q3d",   label: "3/4",    icon: "↗" },
  { id: "left",  label: "Left",   icon: "←" },
  { id: "back",  label: "Back",   icon: "↓" },
];

// ── Main export ───────────────────────────────────────────────────────────────
export default function Garment3DPreview({
  design,
  onClose,
  isDark = true,
  canMockup = false,
  printWidthIn = null,
  printHeightIn = null,
  fetchMockups,
  liveCanvas = null,
  productColor = null,
}: {
  design: string;
  onClose: () => void;
  isDark?: boolean;
  canMockup?: boolean;
  printWidthIn?: number | null;
  printHeightIn?: number | null;
  fetchMockups?: () => Promise<string[]>;
  liveCanvas?: HTMLCanvasElement | null;
  productColor?: string | null;
}) {
  // Map product color name → hex swatch
  const matchedColor = useMemo(() => {
    if (!productColor) return GARMENT_COLORS[0].hex;
    const lc = productColor.toLowerCase();
    const match = GARMENT_COLORS.find((c) =>
      lc.includes(c.key) || c.label.toLowerCase().includes(lc)
    );
    return match?.hex ?? GARMENT_COLORS[0].hex;
  }, [productColor]);

  const [color, setColor] = useState(matchedColor);
  const [spin, setSpin] = useState(true);
  const [showWire, setShowWire] = useState(false);
  const [showGrid, setShowGrid] = useState(false);
  const [envPreset, setEnvPreset] = useState<"studio" | "sunset" | "dawn">("studio");
  const [fabric, setFabric] = useState<FabricKey>("cotton");
  const [tab, setTab] = useState<"3d" | "real">("3d"); // 3D first per requirements
  const [mockups, setMockups] = useState<string[] | null>(null);
  const [mockBusy, setMockBusy] = useState(false);
  const [camPreset, setCamPreset] = useState<string | null>("front");
  const [units] = useMeasurementSystem();
  const glRef = useRef<HTMLDivElement>(null);
  const printDims = printWidthIn && printHeightIn
    ? `${formatLength(printWidthIn, units)} × ${formatLength(printHeightIn, units)}`
    : null;

  // Sync to product color when prop changes
  useEffect(() => { setColor(matchedColor); }, [matchedColor]);

  const loadMockups = async () => {
    if (mockups || mockBusy || !fetchMockups) return;
    setMockBusy(true);
    try { setMockups(await fetchMockups()); }
    finally { setMockBusy(false); }
  };

  const openReal = () => { setTab("real"); loadMockups(); };

  const export3d = () => {
    const cvs = glRef.current?.querySelector("canvas") as HTMLCanvasElement | null;
    if (!cvs) return;
    const a = document.createElement("a");
    a.href = cvs.toDataURL("image/png");
    a.download = "garment-3d.png";
    a.click();
  };

  const orbitRef = useRef<any>(null);

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-black/96 backdrop-blur-md select-none">
      {/* ── Top bar ────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-5 py-3.5 shrink-0 border-b border-white/5">
        <div className="flex items-center gap-2">
          {/* Tab switcher */}
          <div className="flex gap-0.5 rounded-full bg-white/10 p-1">
            <button onClick={() => setTab("3d")}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest transition-colors ${tab === "3d" ? "bg-white text-black" : "text-white/60 hover:text-white"}`}>
              <Box size={11} /> 3D
            </button>
            {canMockup && (
              <button onClick={openReal}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest transition-colors ${tab === "real" ? "bg-white text-black" : "text-white/60 hover:text-white"}`}>
                <User size={11} /> Mockup
              </button>
            )}
          </div>

          {tab === "3d" && (
            <span className="hidden sm:inline text-[9px] uppercase tracking-widest text-white/35">
              {printDims
                ? `print area ${printDims} · drag to orbit`
                : "drag to orbit · scroll to zoom"}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {tab === "3d" && (
            <button onClick={export3d}
              className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-white hover:bg-white/20">
              <Download size={11} /> Export
            </button>
          )}
          <button onClick={onClose}
            className="flex items-center gap-1.5 rounded-full bg-white/10 px-4 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-white hover:bg-white/20">
            <X size={12} /> Close
          </button>
        </div>
      </div>

      {/* ── Realistic mockup tab ─────────────────────────────────────────── */}
      {tab === "real" && (
        <div className="flex-1 overflow-y-auto px-5 pb-6">
          {mockBusy ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-white/50">
              <Loader2 className="animate-spin" size={28} />
              <span className="text-[10px] uppercase tracking-widest">Rendering photoreal mockup…</span>
            </div>
          ) : mockups && mockups.length > 0 ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 pt-4">
              {mockups.map((url) => (
                <img key={url} src={url} alt="Mockup" className="w-full rounded-2xl bg-white/5 object-contain" />
              ))}
            </div>
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-white/50">
              <User size={32} className="opacity-30" />
              <span className="text-[10px] uppercase tracking-widest">No mockup available</span>
              {fetchMockups && (
                <button onClick={() => { setMockups(null); loadMockups(); }}
                  className="rounded-full bg-white/10 px-4 py-2 text-[10px] uppercase tracking-widest text-white hover:bg-white/20">
                  Retry
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── 3D viewport ───────────────────────────────────────────────────── */}
      <div ref={glRef} className={`relative flex-1 ${tab !== "3d" ? "hidden" : ""}`}>
        <Canvas
          shadows
          camera={{ position: [0, 0.2, 5.8], fov: 36 }}
          dpr={[1, 2]}
          gl={{ preserveDrawingBuffer: true, antialias: true }}
        >
          <color attach="background" args={[isDark ? "#080809" : "#0d0e10"]} />

          {/* Lighting — key/fill/rim setup for realistic skin */}
          <ambientLight intensity={0.55} />
          <directionalLight position={[4, 7, 5]} intensity={1.8} castShadow
            shadow-mapSize={[2048, 2048]} shadow-bias={-0.0004} />
          <directionalLight position={[-5, 3, -3]} intensity={0.65} />
          <directionalLight position={[0, 4, -6]} intensity={0.35} color="#d0e8ff" />
          <pointLight position={[0, 3.5, 3]} intensity={0.4} color="#fff8f0" />

          <Suspense fallback={null}>
            {HUMAN_GLB ? (
              <FigureBoundary fallback={
                <Mannequin color={color} liveCanvas={liveCanvas} staticDesign={design} isDark={isDark} showWire={showWire} fabric={fabric} />
              }>
                <Suspense fallback={
                  <Mannequin color={color} liveCanvas={liveCanvas} staticDesign={design} isDark={isDark} showWire={showWire} fabric={fabric} />
                }>
                  <AvatarFigure url={HUMAN_GLB} liveCanvas={liveCanvas} staticDesign={design} />
                </Suspense>
              </FigureBoundary>
            ) : (
              <Mannequin color={color} liveCanvas={liveCanvas} staticDesign={design} isDark={isDark} showWire={showWire} fabric={fabric} />
            )}
            <Environment preset={envPreset} />
          </Suspense>

          <ContactShadows position={[0, -1.85, 0]} opacity={0.55} scale={10} blur={2.8} far={3.5} />

          {showGrid && (
            <Grid position={[0, -1.85, 0]} args={[12, 12]}
              cellColor="#444" sectionColor="#666" fadeDistance={16} fadeStrength={1} />
          )}

          <CameraPreset preset={camPreset} onDone={() => setCamPreset(null)} />

          <OrbitControls
            ref={orbitRef}
            enablePan={false}
            autoRotate={spin}
            autoRotateSpeed={1.4}
            target={[0, 0.2, 0]}
            minDistance={2.8}
            maxDistance={11}
            onStart={() => setSpin(false)}
          />
        </Canvas>

        {/* Camera angle preset pills (CLO-3D style) */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 flex gap-1 rounded-full bg-black/60 backdrop-blur-sm px-2 py-1.5 border border-white/10">
          {CAM_PRESETS.map((p) => (
            <button key={p.id} onClick={() => { setSpin(false); setCamPreset(p.id); }}
              className="text-[9px] font-bold uppercase tracking-widest text-white/60 hover:text-white px-2.5 py-1 rounded-full hover:bg-white/10 transition-colors">
              {p.label}
            </button>
          ))}
        </div>

        {/* CLO-3D style control toolbar */}
        <div className="absolute top-4 right-4 flex flex-col gap-2">
          <button onClick={() => setShowWire((v) => !v)}
            className={`p-2 rounded-lg text-[10px] uppercase font-bold tracking-wider transition-colors border ${showWire ? "bg-white text-black border-white" : "bg-black/60 text-white/60 border-white/10 hover:text-white"}`}
            title="Wireframe">
            <Grid3X3 size={13} />
          </button>
          <button onClick={() => setShowGrid((v) => !v)}
            className={`p-2 rounded-lg transition-colors border ${showGrid ? "bg-white text-black border-white" : "bg-black/60 text-white/60 border-white/10 hover:text-white"}`}
            title="Floor grid">
            <Eye size={13} />
          </button>
          <button onClick={() => setSpin((v) => !v)}
            className={`p-2 rounded-lg transition-colors border ${spin ? "bg-white text-black border-white" : "bg-black/60 text-white/60 border-white/10 hover:text-white"}`}
            title="Auto-spin">
            <RotateCcw size={13} />
          </button>
        </div>

        {/* Loading spinner overlay */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <Suspense fallback={<Loader2 className="animate-spin text-white/30" size={28} />}>{null}</Suspense>
        </div>
      </div>

      {/* ── Bottom controls ───────────────────────────────────────────────── */}
      <div className={`flex items-center justify-between gap-3 px-5 py-4 shrink-0 border-t border-white/5 ${tab !== "3d" ? "hidden" : ""}`}>
        {/* Garment color swatches */}
        <div className="flex items-center gap-1.5 rounded-full bg-white/8 px-3 py-2 border border-white/10">
          {GARMENT_COLORS.map((c) => (
            <button key={c.key} onClick={() => setColor(c.hex)} aria-label={c.label} title={c.label}
              className={`h-6 w-6 rounded-full border-2 transition-transform hover:scale-110 ${color === c.hex ? "border-white ring-2 ring-white/40 scale-110" : "border-transparent hover:border-white/40"}`}
              style={{ backgroundColor: c.hex }} />
          ))}
        </div>

        {/* Fabric presets (CLO-3D) */}
        <div className="flex gap-1 rounded-full bg-white/8 px-2 py-1.5 border border-white/10">
          {(Object.keys(FABRICS) as FabricKey[]).map((f) => (
            <button key={f} onClick={() => setFabric(f)} title={`${FABRICS[f].label} fabric`}
              className={`px-2.5 py-1 rounded-full text-[9px] font-bold uppercase tracking-widest transition-colors ${fabric === f ? "bg-white text-black" : "text-white/50 hover:text-white"}`}>
              {FABRICS[f].label}
            </button>
          ))}
        </div>

        {/* Environment presets */}
        <div className="flex gap-1 rounded-full bg-white/8 px-2 py-1.5 border border-white/10">
          {(["studio", "sunset", "dawn"] as const).map((e) => (
            <button key={e} onClick={() => setEnvPreset(e)}
              className={`px-3 py-1 rounded-full text-[9px] font-bold uppercase tracking-widest transition-colors ${envPreset === e ? "bg-white text-black" : "text-white/50 hover:text-white"}`}>
              {e}
            </button>
          ))}
        </div>

        {/* Print dims badge */}
        {printWidthIn && printHeightIn && (
          <div className="hidden sm:flex items-center gap-1 text-[9px] text-white/35 font-mono uppercase">
            <Camera size={10} /> {printDims}
          </div>
        )}
      </div>
    </div>
  );
}
