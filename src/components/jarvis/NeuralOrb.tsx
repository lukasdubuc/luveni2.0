// ─────────────────────────────────────────────────────────────
//  J.A.R.V.I.S — Luveni GM  |  components/jarvis/NeuralOrb.tsx
// ─────────────────────────────────────────────────────────────

import { useEffect, useRef, useState } from 'react';
import type { OrbState } from '../../types/jarvis';

interface NeuralOrbProps {
  state:          OrbState;
  audioLevel:     number;
  size?:          number;
  isMuted?:       boolean;                  // Optional control from parent
  onMuteToggle?:  (muted: boolean) => void; // Optional callback
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

  float fresnel = pow(smoothstep(0.0, 1.0, 1.0 - max(dot(normal, viewDir), 0.0)), 2.8);

  float t = uTime * 0.75;
  vec3 p1 = rotationMatrix(vec3(1.0, 0.5, 0.2), t * 0.15) * vPosition;
  vec3 p2 = rotationMatrix(vec3(-0.4, 1.0, 0.4), -t * 0.12) * vPosition;
  vec3 p3 = rotationMatrix(vec3(0.3, -0.3, 1.0), t * 0.22) * vPosition;

  float n1 = sin(p1.x * 4.0 + p1.y * 2.5 + t) * cos(p1.z * 3.5 - t * 0.6);
  float n2 = cos(p2.y * 3.8 + p2.z * 1.8 - t * 0.8) * sin(p2.x * 2.8 + t * 0.5);
  float n3 = sin(p3.z * 4.5 + p3.x * 3.2 + t * 1.1);

  float thickness = 0.05 + uAudio * 0.12;
  float line1 = 1.0 - smoothstep(0.0, thickness, abs(n1 + n2 * 0.3 - 0.1));
  float line2 = 1.0 - smoothstep(0.0, thickness + 0.02, abs(n2 + n3 * 0.4 + 0.15));
  float line3 = 1.0 - smoothstep(0.0, thickness * 1.1, abs(n3 * 0.6 + n1 * 0.5 - 0.25));

  vec3 magenta    = vec3(0.95, 0.04, 0.62);
  vec3 deepBlue   = vec3(0.05, 0.22, 0.98);
  vec3 royalPurple = vec3(0.52, 0.02, 0.88);
  vec3 neonCyan   = vec3(0.0, 0.92, 1.0);

  vec3 col1 = mix(magenta, royalPurple, sin(t + p1.z) * 0.5 + 0.5);
  vec3 col2 = mix(deepBlue, neonCyan, cos(t - p2.x) * 0.5 + 0.5);
  vec3 col3 = mix(royalPurple, magenta, sin(t * 1.4) * 0.5 + 0.5);
  vec3 rimColor = mix(royalPurple, neonCyan, fresnel);

  vec3 finalColor = vec3(0.0);
  finalColor += line1 * col1 * 2.8;
  finalColor += line2 * col2 * 2.4;
  finalColor += line3 * col3 * 2.0;
  finalColor += fresnel * rimColor * 2.8;

  float alpha = fresnel * 0.65 + line1 * 0.9 + line2 * 0.9 + line3 * 0.9;
  alpha = clamp(alpha, 0.0, 0.95);

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

export default function NeuralOrb({
  state,
  audioLevel,
  size = 380,
  isMuted,
  onMuteToggle,
}: NeuralOrbProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef(0);

  // Fallback state if the parent component does not manage mute status
  const [internalMuted, setInternalMuted] = useState(true);
  const muted = isMuted !== undefined ? isMuted : internalMuted;

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
        // Force context loss to prevent WebGL memory leaks
        renderer?.forceContextLoss?.();
        ctx.current = null;
      }
      mountRef.current?.querySelector('canvas')?.remove();
    };
  }, [size]);

  // ── State updates ──────────────────────────────────────────
  useEffect(() => {
    if (!ctx.current) return;
    ctx.current.uniforms.uState.value = STATE_NUM[state];
  }, [state]);

  const handleMuteClick = () => {
    const nextMuted = !muted;
    if (onMuteToggle) {
      onMuteToggle(nextMuted);
    } else {
      setInternalMuted(nextMuted);
    }
  };

  // Determine styling based on the active state
  const isListening = state === 'listening';

  return (
    <div className="relative w-full h-[70vh] flex flex-col items-center justify-center overflow-visible select-none">
      {/* ── Global Typography & Keyframes ── */}
      <style dangerouslySetInnerHTML={{__html: `
        html, body, .jarvis-root {
          font-family: 'Helvetica Neue', Arial, sans-serif !important;
        }
        @keyframes subtlePulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.03); }
        }
      `}} />

      {/* ── Glowing WebGL Orb Container ── */}
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

      {/* ── Stable Standby/Listening Status Text ── */}
      <div className="mt-4 flex flex-col items-center justify-center h-8">
        <span 
          className={`text-xs tracking-[0.3em] uppercase font-medium transition-all duration-300 ease-in-out ${
            isListening 
              ? 'text-cyan-400 drop-shadow-[0_0_8px_rgba(34,211,238,0.4)] opacity-100' 
              : 'text-purple-400/80 opacity-90'
          }`}
        >
          {isListening ? '● LISTENING' : 'STANDBY'}
        </span>
      </div>

      {/* ── Persistent Circular Control Button ── */}
      <button
        onClick={handleMuteClick}
        className="mt-6 relative z-10 flex items-center justify-center w-14 h-14 rounded-full border bg-black/50 backdrop-blur-md transition-all duration-300 outline-none focus:outline-none focus:ring-1 focus:ring-cyan-500/50 group"
        style={{
          borderColor: muted ? 'rgba(239, 68, 68, 0.25)' : 'rgba(6, 182, 212, 0.25)',
          boxShadow: muted 
            ? '0 0 15px rgba(239, 68, 68, 0.05)' 
            : '0 0 15px rgba(6, 182, 212, 0.05)'
        }}
      >
        {/* Glow Layer */}
        <div 
          className={`absolute inset-0 rounded-full transition-all duration-300 opacity-0 group-hover:opacity-100 ${
            muted 
              ? 'bg-red-500/5 shadow-[0_0_20px_rgba(239,68,68,0.2)]' 
              : 'bg-cyan-500/5 shadow-[0_0_20px_rgba(6,182,212,0.2)]'
          }`}
        />

        {muted ? (
          /* Unmute state action (cross-slashed/muted speaker icon representing click to unmute) */
          <svg 
            xmlns="http://www.w3.org/2000/svg" 
            fill="none" 
            viewBox="0 0 24 24" 
            strokeWidth={1.5} 
            stroke="currentColor" 
            className="w-5 h-5 text-red-400/90 group-hover:text-red-300 transition-colors duration-200"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 9.75L19.5 12m0 0l2.25 2.25M19.5 12l2.25-2.25M19.5 12l-2.25 2.25m-10.5-6L4.5 9H1.5v6h3l4.5 3.75V3.75z" />
          </svg>
        ) : (
          /* Mute state action (active speaker sound waves icon representing click to mute) */
          <svg 
            xmlns="http://www.w3.org/2000/svg" 
            fill="none" 
            viewBox="0 0 24 24" 
            strokeWidth={1.5} 
            stroke="currentColor" 
            className="w-5 h-5 text-cyan-400/90 group-hover:text-cyan-300 transition-colors duration-200"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z" />
          </svg>
        )}
      </button>
    </div>
  );
}
