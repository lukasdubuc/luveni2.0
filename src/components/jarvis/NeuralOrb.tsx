// ─────────────────────────────────────────────────────────────
//  J.A.R.V.I.S — Luveni GM  |  components/jarvis/NeuralOrb.tsx
// ─────────────────────────────────────────────────────────────

import { useEffect, useRef, useState } from 'react';
import type { OrbState } from '../../types/jarvis';

interface NeuralOrbProps {
  state:          OrbState;
  audioLevel:     number;
  size?:          number;
  isMuted?:       boolean;                  // Controlled from parent
  onMuteToggle?:  (muted: boolean) => void; // Parent callback
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

  // 1. Double Fresnel: one for soft inner rim, one for ultra-sharp outer glass edge
  float fresnel = pow(smoothstep(0.0, 1.0, 1.0 - max(dot(normal, viewDir), 0.0)), 2.5);
  float outerRim = pow(smoothstep(0.0, 1.0, 1.0 - max(dot(normal, viewDir), 0.0)), 8.0);

  // 2. Multi-axial organic noise waves
  float t = uTime * 0.65;
  vec3 p1 = rotationMatrix(vec3(1.0, 0.4, 0.2), t * 0.12) * vPosition;
  vec3 p2 = rotationMatrix(vec3(-0.3, 1.0, 0.5), -t * 0.10) * vPosition;
  vec3 p3 = rotationMatrix(vec3(0.4, -0.4, 1.0), t * 0.18) * vPosition;

  float n1 = sin(p1.x * 5.0 + p1.y * 3.0 + t) * cos(p1.z * 4.0 - t * 0.5);
  float n2 = cos(p2.y * 4.5 + p2.z * 2.0 - t * 0.7) * sin(p2.x * 3.2 + t * 0.4);
  float n3 = sin(p3.z * 5.0 + p3.x * 3.5 + t * 0.9);

  // 3. Render thin, high-contrast wispy ribbons matching the reference image
  float thickness = 0.03 + uAudio * 0.10;
  float line1 = pow(1.0 - smoothstep(0.0, thickness * 0.7, abs(n1 + n2 * 0.25 - 0.08)), 3.0);
  float line2 = pow(1.0 - smoothstep(0.0, (thickness + 0.015) * 0.7, abs(n2 + n3 * 0.3 + 0.12)), 3.0);
  float line3 = pow(1.0 - smoothstep(0.0, thickness * 0.75, abs(n3 * 0.5 + n1 * 0.4 - 0.20)), 3.0);

  // 4. Color Palette 
  vec3 magenta     = vec3(0.95, 0.05, 0.55);
  vec3 deepBlue    = vec3(0.02, 0.20, 0.95);
  vec3 royalPurple = vec3(0.45, 0.02, 0.85);
  vec3 neonCyan    = vec3(0.0, 0.95, 1.0);

  // Dynamic mixing based on coordinate rotation
  vec3 col1 = mix(magenta, royalPurple, sin(t + p1.z) * 0.5 + 0.5);
  vec3 col2 = mix(deepBlue, neonCyan, cos(t - p2.x) * 0.5 + 0.5);
  vec3 col3 = mix(royalPurple, magenta, sin(t * 1.3) * 0.5 + 0.5);

  // Asymmetric Rim Color (gradient shifts along diagonal vector for cyan-to-magenta edge matching image)
  float colorShift = dot(normal, vec3(0.6, -0.6, 0.5)) * 0.5 + 0.5;
  vec3 rimColor = mix(royalPurple, neonCyan, colorShift);

  // 5. Final Output Compilation
  vec3 finalColor = vec3(0.0);
  finalColor += line1 * col1 * 3.0;
  finalColor += line2 * col2 * 2.6;
  finalColor += line3 * col3 * 2.2;
  finalColor += fresnel * rimColor * 2.6;
  finalColor += outerRim * neonCyan * 3.2; // Crispy outer glowing edge

  // 6. Opacity Mapping
  float alpha = fresnel * 0.70 + line1 * 0.95 + line2 * 0.95 + line3 * 0.95;
  alpha = clamp(alpha, 0.0, 0.98);

  // 7. Translucent Glass Core (makes center dark but keeps glowing threads visible on the surface)
  float centerDarkness = 1.0 - smoothstep(0.2, 0.85, dot(normal, viewDir));
  finalColor = mix(finalColor, vec3(0.01, 0.0, 0.03), centerDarkness * 0.65);

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

  const [internalMuted, setInternalMuted] = useState(true);
  const muted = isMuted !== undefined ? isMuted : internalMuted;

  const ctx = useRef<{
    renderer: any; uniforms: any; clock: any;
    geometry?: any; material?: any;
  } | null>(null);

  useEffect(() => { audioRef.current = audioLevel; }, [audioLevel]);

  // ── WebGL Initialization ─────────────────────────────────────
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

  const isListening = state === 'listening';

  return (
    <div className="relative w-full h-[65vh] flex flex-col items-center justify-center overflow-visible select-none">
      {/* ── Typography & Keyframes ── */}
      <style dangerouslySetInnerHTML={{__html: `
        html, body, .jarvis-root {
          font-family: 'Helvetica Neue', Arial, sans-serif !important;
        }
        @keyframes subtlePulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.03); }
        }
      `}} />

      {/* ── Glowing WebGL Orb ── */}
      <div
        ref={mountRef}
        className="transition-transform duration-300"
        style={{
          position:  'relative',
          width:     `${size}px`,
          height:    `${size}px`,
          animation: 'subtlePulse 4.2s infinite ease-in-out',
          overflow:  'visible',
        }}
      />

      {/* ── Stable Standby/Listening Status Text ── */}
      <div className="mt-6 flex flex-col items-center justify-center h-8">
        <span 
          className={`text-xs tracking-[0.3em] uppercase font-semibold transition-all duration-300 ease-in-out ${
            isListening 
              ? 'text-cyan-400 drop-shadow-[0_0_8px_rgba(6,182,212,0.5)] opacity-100' 
              : 'text-purple-400/80 opacity-90'
          }`}
        >
          {isListening ? '● LISTENING' : 'STANDBY'}
        </span>
      </div>

      {/* ── Clean Glassmorphic Circular Control Button ── */}
      <button
        onClick={handleMuteClick}
        className="mt-6 relative z-10 flex items-center justify-center w-14 h-14 rounded-full border bg-[#0d0d1e]/80 backdrop-blur-xl transition-all duration-300 outline-none focus:outline-none group"
        style={{
          borderColor: muted ? 'rgba(239, 68, 68, 0.25)' : 'rgba(6, 182, 212, 0.25)',
          boxShadow: muted 
            ? '0 0 15px rgba(239, 68, 68, 0.08)' 
            : '0 0 15px rgba(6, 182, 212, 0.08)'
        }}
      >
        {/* Glow Layer */}
        <div 
          className={`absolute inset-0 rounded-full transition-all duration-300 opacity-0 group-hover:opacity-100 ${
            muted 
              ? 'bg-red-500/5 shadow-[0_0_20px_rgba(239,68,68,0.25)]' 
              : 'bg-cyan-500/5 shadow-[0_0_20px_rgba(6,182,212,0.25)]'
          }`}
        />

        {muted ? (
          /* Red Unmute (Microphone Slashed) Icon */
          <svg 
            xmlns="http://www.w3.org/2000/svg" 
            fill="none" 
            viewBox="0 0 24 24" 
            strokeWidth={1.5} 
            stroke="currentColor" 
            className="w-5 h-5 text-red-400/90 group-hover:text-red-300 transition-colors duration-200"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M2.25 2.25l19.5 19.5M15.364 15.364l4.656-4.656m0 0l2.25 2.25m-2.25-2.25l2.25-2.25m-4.5 4.5l-2.25-2.25M9 10.5v1.5a3 3 0 003 3v0M12 4.5c.828 0 1.5.672 1.5 1.5V9M12 21v-3" />
          </svg>
        ) : (
          /* Cyan Mute (Active Microphone) Icon */
          <svg 
            xmlns="http://www.w3.org/2000/svg" 
            fill="none" 
            viewBox="0 0 24 24" 
            strokeWidth={1.5} 
            stroke="currentColor" 
            className="w-5 h-5 text-cyan-400/90 group-hover:text-cyan-300 transition-colors duration-200"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V6a3 3 0 016 0v6.75a3 3 0 01-3 3z" />
          </svg>
        )}
      </button>
    </div>
  );
}
