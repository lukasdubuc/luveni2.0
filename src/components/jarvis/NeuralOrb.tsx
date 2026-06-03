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

// ── Fragment Shader (Highly compatible, safe-range wave procedural plasma) ──
const FRAG = `
precision highp float;
uniform float uTime;
uniform float uAudio;

varying vec3 vNormal;
varying vec3 vViewPosition;
varying vec3 vPosition;

// Safe multi-axial coordinate rotation matrix to prevent standard axial tiling
mat3 rotationMatrix(vec3 axis, float angle) {
  axis = normalize(axis);
  float s = sin(angle);
  float c = cos(angle);
  float oc = 1.0 - c;
  return mat3(
    oc * axis.x * axis.x + c,           oc * axis.x * axis.y - axis.z * s,  oc * axis.z * axis.x + axis.y * s,
    oc * axis.x * axis.y + axis.z * s,  oc * axis.y * axis.y + c,           oc * axis.y * axis.z - axis.x * s,
    oc * axis.z * axis.x - axis.y * s,  oc * axis.y * axis.z + axis.x * s,  oc * axis.z * axis.z + c
  );
}

void main() {
  vec3 normal = normalize(vNormal);
  vec3 viewDir = normalize(vViewPosition);

  // 1. Fresnel Edge Rim Glow (ascending range edge0 < edge1 for GPU safety)
  float fresnel = pow(smoothstep(0.0, 1.0, 1.0 - max(dot(normal, viewDir), 0.0)), 2.8);

  // 2. Multi-axial organic noise waves
  float t = uTime * 0.75;
  vec3 p1 = rotationMatrix(vec3(1.0, 0.5, 0.2), t * 0.15) * vPosition;
  vec3 p2 = rotationMatrix(vec3(-0.4, 1.0, 0.4), -t * 0.12) * vPosition;
  vec3 p3 = rotationMatrix(vec3(0.3, -0.3, 1.0), t * 0.22) * vPosition;

  float n1 = sin(p1.x * 4.0 + p1.y * 2.5 + t) * cos(p1.z * 3.5 - t * 0.6);
  float n2 = cos(p2.y * 3.8 + p2.z * 1.8 - t * 0.8) * sin(p2.x * 2.8 + t * 0.5);
  float n3 = sin(p3.z * 4.5 + p3.x * 3.2 + t * 1.1);

  // 3. Render thin wispy ribbons (safe smoothstep range inversion)
  float thickness = 0.05 + uAudio * 0.12;
  float line1 = 1.0 - smoothstep(0.0, thickness, abs(n1 + n2 * 0.3 - 0.1));
  float line2 = 1.0 - smoothstep(0.0, thickness + 0.02, abs(n2 + n3 * 0.4 + 0.15));
  float line3 = 1.0 - smoothstep(0.0, thickness * 1.1, abs(n3 * 0.6 + n1 * 0.5 - 0.25));

  // 4. Color Palette (Magenta, Electric Blue, Purple, Cyan matching target image)
  vec3 magenta    = vec3(0.95, 0.04, 0.62);
  vec3 deepBlue   = vec3(0.05, 0.22, 0.98);
  vec3 royalPurple = vec3(0.52, 0.02, 0.88);
  vec3 neonCyan   = vec3(0.0, 0.92, 1.0);

  vec3 col1 = mix(magenta, royalPurple, sin(t + p1.z) * 0.5 + 0.5);
  vec3 col2 = mix(deepBlue, neonCyan, cos(t - p2.x) * 0.5 + 0.5);
  vec3 col3 = mix(royalPurple, magenta, sin(t * 1.4) * 0.5 + 0.5);
  vec3 rimColor = mix(royalPurple, neonCyan, fresnel);

  // 5. Build final luminous mapping
  vec3 finalColor = vec3(0.0);
  finalColor += line1 * col1 * 2.8;
  finalColor += line2 * col2 * 2.4;
  finalColor += line3 * col3 * 2.0;
  finalColor += fresnel * rimColor * 2.8;

  // 6. Opacity Mapping
  float alpha = fresnel * 0.65 + line1 * 0.9 + line2 * 0.9 + line3 * 0.9;
  alpha = clamp(alpha, 0.0, 0.95);

  // 7. Translucent Dark Glass Shadow Core (safely inverted smoothstep)
  float centerDarkness = 1.0 - smoothstep(0.15, 0.85, dot(normal, viewDir));
  finalColor = mix(finalColor, vec3(0.02, 0.01, 0.06), centerDarkness * 0.4);

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

// ── Component ─────────────────────────────────────────────────
export default function NeuralOrb({ state, audioLevel, size = 380 }: NeuralOrbProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef(0);

  const ctx = useRef<{
    renderer: any; uniforms: any; clock: any;
    geometry?: any; material?: any;
  } | null>(null);

  useEffect(() => { audioRef.current = audioLevel; }, [audioLevel]);

  // ── Boot WebGL ──────────────────────────────────────────────
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

      // Cap DPR to 1.5 to reduce fragment shader calculations on high-res displays
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

      // Lowered from 64x64 to 48x48 to optimize GPU overhead
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
        // Halt processing immediately if the component is unmounted
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
        ctx.current.geometry?.dispose();
        ctx.current.material?.dispose();
        ctx.current.renderer?.dispose();
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
    <div className="relative w-full h-[60vh] flex flex-col items-center justify-center overflow-visible">
      {/* ── Global Typography & Keyframes ── */}
      <style dangerouslySetInnerHTML={{__html: `
        html, body, .jarvis-root {
          font-family: 'Helvetica Neue', Arial, sans-serif !important;
        }
        @keyframes subtlePulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.04); }
        }
      `}} />

      {/* ── Glowing WebGL Orb ── */}
      <div
        ref={mountRef}
        style={{
          position:  'relative',
          width:     `${size}px`,
          height:    `${size}px`,
          animation: 'subtlePulse 4.2s infinite ease-in-out',
          overflow:  'visible',
        }}
      />
    </div>
  );
}
