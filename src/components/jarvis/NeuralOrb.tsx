// ─────────────────────────────────────────────────────────────
//  J.A.R.V.I.S — Luveni GM  |  components/jarvis/NeuralOrb.tsx
// ─────────────────────────────────────────────────────────────

import { useEffect, useRef } from 'react';
import type { OrbState } from '../../types/jarvis';

interface NeuralOrbProps {
  state:      OrbState;
  audioLevel: number;
  size?:      number;
}

// ── Vertex Shader (Passes normals & view vectors for edge glow) ──
const VERT = `
precision highp float;
varying vec3 vNormal;
varying vec3 vViewPosition;
varying vec3 vPosition;

void main() {
  vNormal = normalize(normalMatrix * normal);
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  vViewPosition = -mvPosition.xyz;
  vPosition = position;
  gl_Position = projectionMatrix * mvPosition;
}
`;

// ── Volumetric Liquid-Glass Fragment Shader ──
const FRAG = `
precision highp float;
uniform float uTime;
uniform float uAudio;

varying vec3 vNormal;
varying vec3 vViewPosition;
varying vec3 vPosition;

// Safe rotation matrices
mat3 rotX(float a) {
  float s = sin(a), c = cos(a);
  return mat3(1.0, 0.0, 0.0, 0.0, c, -s, 0.0, s, c);
}
mat3 rotY(float a) {
  float s = sin(a), c = cos(a);
  return mat3(c, 0.0, s, 0.0, 1.0, 0.0, -s, 0.0, c);
}
mat3 rotZ(float a) {
  float s = sin(a), c = cos(a);
  return mat3(c, -s, 0.0, s, c, 0.0, 0.0, 0.0, 1.0);
}

// 3D Domain warping wave generator to create the nested liquid filaments
float liquidNoise(vec3 p, float t) {
  vec3 p1 = rotX(t * 0.15) * rotY(t * 0.1) * p;
  vec3 q = vec3(
    sin(p1.x * 2.0 + t * 0.4),
    cos(p1.y * 2.0 - t * 0.3),
    sin(p1.z * 2.0 + t * 0.5)
  );
  
  vec3 p2 = rotZ(-t * 0.12) * rotX(t * 0.08) * (p + q * 0.5);
  vec3 r = vec3(
    sin(p2.y * 3.0 + t * 0.6),
    cos(p2.z * 3.0 - t * 0.4),
    sin(p2.x * 3.0 + t * 0.2)
  );
  
  float wave = sin(r.x * 2.5 + r.y * 1.5) * cos(r.z * 2.0);
  return wave;
}

void main() {
  vec3 normal = normalize(vNormal);
  vec3 viewDir = normalize(vViewPosition);

  float t = uTime * 0.8;
  float ndotv = max(dot(normal, viewDir), 0.0);
  
  // 1. Double Fresnel: Soft inner edge glow + razor-thin outer glass rim
  float fresnel = pow(1.0 - ndotv, 2.5);
  float sharpRim = pow(1.0 - ndotv, 12.0);

  // Volumetric scale projection
  vec3 p = vPosition * 1.8;

  // 2. Compute three warping bands representing organic magnetic fields
  float n1 = liquidNoise(p, t);
  float n2 = liquidNoise(p + vec3(0.5, -0.3, 0.2), t * 0.85);
  float n3 = liquidNoise(p - vec3(0.3, 0.4, -0.5), t * 1.15);

  // 3. Sharp filament band mapping
  float thickness = 0.035 + uAudio * 0.12;
  float band1 = pow(smoothstep(thickness, 0.0, abs(n1 - 0.12)), 2.6);
  float band2 = pow(smoothstep(thickness + 0.01, 0.0, abs(n2 + 0.15)), 2.6);
  float band3 = pow(smoothstep(thickness * 1.1, 0.0, abs(n3 - 0.25)), 3.0);

  // 4. Vibrant Color Palettes
  vec3 neonCyan     = vec3(0.0, 0.95, 1.0);
  vec3 electricBlue = vec3(0.02, 0.22, 1.0);
  vec3 magenta      = vec3(0.95, 0.02, 0.60);
  vec3 hotPink      = vec3(1.0, 0.08, 0.75);
  vec3 deepIndigo   = vec3(0.35, 0.0, 0.9);

  // Non-uniform diagonal rim gradient (magenta top-left, cyan bottom-right)
  float diagonal = dot(normal, normalize(vec3(0.7, -0.7, 0.4))) * 0.5 + 0.5;
  vec3 rimColor = mix(magenta, neonCyan, diagonal);

  vec3 col1 = mix(magenta, hotPink, sin(t + p.z) * 0.5 + 0.5);
  vec3 col2 = mix(electricBlue, neonCyan, cos(t - p.x) * 0.5 + 0.5);
  vec3 col3 = mix(deepIndigo, magenta, sin(t * 1.2) * 0.5 + 0.5);

  // 5. Final Volumetric Compilation
  vec3 finalColor = vec3(0.0);
  finalColor += band1 * col1 * 3.5;
  finalColor += band2 * col2 * 3.0;
  finalColor += band3 * col3 * 2.5;
  finalColor += fresnel * rimColor * 2.8;
  finalColor += sharpRim * neonCyan * 4.0; // Clean outer white-cyan glass edge

  // 6. Volumetric Hollow Dark Glass Core
  float centerDarkness = 1.0 - smoothstep(0.18, 0.88, ndotv);
  finalColor = mix(finalColor, vec3(0.01, 0.005, 0.03), centerDarkness * 0.8);

  // 7. Opacity Mapping
  float alpha = fresnel * 0.65 + band1 * 0.9 + band2 * 0.9 + band3 * 0.9 + sharpRim * 1.0;
  alpha = clamp(alpha, 0.0, 0.96);

  gl_FragColor = vec4(finalColor, alpha);
}
`;

const STATE_NUM: Record<OrbState, number> = {
  idle: 0, listening: 1, thinking: 2, speaking: 3, error: 4,
};

function loadThree(): Promise<void> {
  if ((window as any).THREE) return Promise.resolve();
  return new Promise((resolve, reject) => {
    let s = document.querySelector('script[data-three="r128"]') as HTMLScriptElement | null;
    if (!s) {
      s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
      s.dataset.three = 'r128';
      document.head.appendChild(s);
    }
    const t0 = Date.now();
    const poll = () => {
      if ((window as any).THREE) return resolve();
      if (Date.now() - t0 > 15000) return reject(new Error('THREE timeout'));
      setTimeout(poll, 80);
    };
    poll();
  });
}

export default function NeuralOrb({ state, audioLevel, size = 380 }: NeuralOrbProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef(0);

  const ctx = useRef<{
    renderer: any; uniforms: any; clock: any;
    geometry?: any; material?: any;
  } | null>(null);

  useEffect(() => { audioRef.current = audioLevel; }, [audioLevel]);

  // ── WebGL Boot ──────────────────────────────────────────────
  useEffect(() => {
    if (!mountRef.current) return;
    let active = true;
    let rafId: number | null = null;

    loadThree()
      .then(() => { if (active && mountRef.current) boot(); })
      .catch(e => console.error('[NeuralOrb]', e));

    function boot() {
      const THREE = (window as any).THREE;
      const el    = mountRef.current!;

      el.querySelector('canvas')?.remove();

      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      const renderer = new THREE.WebGLRenderer({ 
        antialias: true, 
        alpha: true,
        powerPreference: "high-performance"
      });
      renderer.setPixelRatio(dpr);
      renderer.setSize(size, size);
      renderer.setClearColor(0x000000, 0);

      const canvas = renderer.domElement as HTMLCanvasElement;
      canvas.style.width        = `100%`;
      canvas.style.height       = `100%`;
      canvas.style.display      = 'block';
      canvas.style.position     = 'absolute';
      canvas.style.top          = '0';
      canvas.style.left         = '0';
      canvas.style.overflow     = 'visible';
      el.appendChild(canvas);

      const scene  = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
      camera.position.z = 3.0;

      const geo = new THREE.SphereGeometry(1.0, 48, 48);

      const uniforms = {
        uTime:  { value: 0 },
        uAudio: { value: 0 },
        uState: { value: 0 }
      };

      const mat = new THREE.ShaderMaterial({
        vertexShader:   VERT,
        fragmentShader: FRAG,
        uniforms,
        transparent: true,
        depthWrite:  false,
        blending:    THREE.AdditiveBlending,
      });

      const mesh = new THREE.Mesh(geo, mat);
      scene.add(mesh);

      const clock = new THREE.Clock();

      const tick = () => {
        if (!active) return;
        
        rafId = requestAnimationFrame(tick);
        
        const t  = clock.getElapsedTime();
        uniforms.uTime.value  = t;
        uniforms.uAudio.value = audioRef.current;

        renderer.render(scene, camera);
      };
      tick();

      ctx.current = { renderer, uniforms, clock, geometry: geo, material: mat };
    }

    return () => {
      active = false;
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
      if (ctx.current) {
        const { renderer, geometry, material } = ctx.current;
        geometry?.dispose();
        material?.dispose();
        renderer?.dispose();
        renderer?.forceContextLoss?.();
        ctx.current = null;
      }
      mountRef.current?.querySelector('canvas')?.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size]);

  // ── State updates ──────────────────────────────────────────
  useEffect(() => {
    if (!ctx.current) return;
    ctx.current.uniforms.uState.value = STATE_NUM[state];
  }, [state]);

  return (
    <div
      ref={mountRef}
      style={{
        position:  'relative',
        width:     `${size}px`,
        height:    `${size}px`,
        overflow:  'visible',
      }}
    />
  );
}
