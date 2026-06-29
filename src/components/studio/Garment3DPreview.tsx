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
import { OrbitControls, Decal, useTexture, Environment, ContactShadows, Center } from "@react-three/drei";
import * as THREE from "three";
import { X, Loader2, RotateCcw } from "lucide-react";

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
  const texture = useTexture(design);
  texture.anisotropy = 8;

  return (
    <Center>
      <group rotation={[0, 0, 0]}>
        {/* Torso */}
        <mesh castShadow receiveShadow material={mat}>
          <capsuleGeometry args={[0.95, 1.5, 12, 32]} />
          {/* Chest decal — the user's design */}
          <Decal
            position={[0, 0.35, 0.92]}
            rotation={[0, 0, 0]}
            scale={[1.25, 1.4, 1.2]}
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
}: {
  design: string; // transparent PNG data URL of the flattened artboard
  onClose: () => void;
  isDark?: boolean;
}) {
  const [color, setColor] = useState(GARMENT_COLORS[0].hex);
  const [spin, setSpin] = useState(true);

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-black/95 backdrop-blur-md">
      {/* Top bar */}
      <div className="flex items-center justify-between px-5 py-4 shrink-0">
        <div className="flex items-center gap-2 text-white">
          <span className="text-[11px] font-bold uppercase tracking-[0.2em]">3D Garment View</span>
          <span className="text-[9px] uppercase tracking-widest text-white/40">drag to rotate · scroll to zoom</span>
        </div>
        <button
          onClick={onClose}
          className="flex items-center gap-1.5 rounded-full bg-white/10 px-4 py-2 text-[10px] font-semibold uppercase tracking-widest text-white transition-colors hover:bg-white/20"
        >
          <X size={13} /> Close
        </button>
      </div>

      {/* 3D viewport */}
      <div className="relative flex-1">
        <Canvas shadows camera={{ position: [0, 0.3, 4.2], fov: 40 }} dpr={[1, 2]}>
          <color attach="background" args={[isDark ? "#0a0a0b" : "#101012"]} />
          <ambientLight intensity={0.6} />
          <directionalLight position={[3, 5, 4]} intensity={1.4} castShadow shadow-mapSize={[1024, 1024]} />
          <directionalLight position={[-4, 2, -2]} intensity={0.5} />
          <Suspense fallback={null}>
            <Tee color={color} design={design} />
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

      {/* Bottom controls: garment color + reset spin */}
      <div className="flex items-center justify-center gap-3 px-5 py-5 shrink-0">
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
