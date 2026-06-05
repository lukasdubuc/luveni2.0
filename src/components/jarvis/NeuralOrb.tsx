// ─────────────────────────────────────────────────────────────
//  J.A.R.V.I.S — Luveni GM  |  components/jarvis/NeuralOrb.tsx
// ─────────────────────────────────────────────────────────────

import React, { useEffect, useRef } from 'react';

export type OrbState = 'idle' | 'listening' | 'thinking' | 'speaking' | 'error';

interface NeuralOrbProps {
  state:      OrbState;
  audioLevel: number;
  size?:      number;
}

const VERT = `
precision highp float;
uniform float uTime;
uniform float uAudio;
uniform float uState;
varying vec3 vNormal;
varying vec3 vViewPosition;
varying vec3 vPosition;

float hash(vec3 p){ return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453); }
float noise(vec3 p){
  vec3 i=floor(p); vec3 f=fract(p); f=f*f*(3.0-2.0*f);
  return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),
             mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);
}

void main() {
  vNormal = normalize(normalMatrix * normal);
  
  // High-fidelity physical displacement based on current state and audio
  float waveSpeed = uTime * (1.2 + uState * 0.25);
  float dispNoise = noise(position * 2.8 + vec3(0.0, 0.0, waveSpeed));
  float dispAmount = (0.015 + uAudio * 0.075) * dispNoise;
  vec3 displacedPosition = position + normal * dispAmount;

  vec4 mvPosition = modelViewMatrix * vec4(displacedPosition, 1.0);
  vViewPosition = -mvPosition.xyz;
  vPosition = displacedPosition;
  gl_Position = projectionMatrix * mvPosition;
}
`;

const FRAG_BACK = `
precision highp float;
uniform float uTime;
uniform float uAudio;
uniform float uState;
varying vec3 vNormal;
varying vec3 vViewPosition;
varying vec3 vPosition;

float hash(vec3 p){ return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453); }
float noise(vec3 p){
  vec3 i=floor(p); vec3 f=fract(p); f=f*f*(3.0-2.0*f);
  return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),
             mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);
}

// ACES Tone mapping for filmic glowing color behavior
vec3 ACESFilm(vec3 x) {
  float a = 2.51;
  float b = 0.03;
  float c = 2.43;
  float d = 0.59;
  float e = 0.14;
  return clamp((x*(a*x+b))/(x*(c*x+d)+e), 0.0, 1.0);
}

void main() {
  vec3 normal  = normalize(vNormal);
  vec3 viewDir = normalize(vViewPosition);
  float ndotv  = max(dot(normal, viewDir), 0.0);
  float t      = uTime * 0.35;
  vec3 p  = vPosition * 2.2 + vec3(t*0.12, t*0.08, t*0.06);
  float n = noise(p)*0.62 + noise(p*2.2)*0.38;

  // Base state color variables
  vec3 c0_0 = vec3(0.02, 0.01, 0.10); // idle (deep indigo)
  vec3 c0_1 = vec3(0.00, 0.03, 0.12); // listening (vibrant blue core)
  vec3 c0_2 = vec3(0.06, 0.01, 0.15); // thinking (magenta-indigo violet)
  vec3 c0_3 = vec3(0.00, 0.06, 0.08); // speaking (deep emerald teal)
  vec3 c0_4 = vec3(0.12, 0.00, 0.02); // error (crimson shadow)

  vec3 c1_0 = vec3(0.10, 0.02, 0.28); // idle 
  vec3 c1_1 = vec3(0.00, 0.09, 0.38); // listening
  vec3 c1_2 = vec3(0.22, 0.02, 0.42); // thinking
  vec3 c1_3 = vec3(0.02, 0.16, 0.24); // speaking
  vec3 c1_4 = vec3(0.35, 0.01, 0.05); // error

  vec3 finalC0 = vec3(0.0);
  vec3 finalC1 = vec3(0.0);

  // Dynamic continuous interpolator loop (compile safe, compatible with GLSL ES 1.0)
  float s = clamp(uState, 0.0, 4.0);
  if (s < 1.0) {
    finalC0 = mix(c0_0, c0_1, s);
    finalC1 = mix(c1_0, c1_1, s);
  } else if (s < 2.0) {
    finalC0 = mix(c0_1, c0_2, s - 1.0);
    finalC1 = mix(c1_1, c1_2, s - 1.0);
  } else if (s < 3.0) {
    finalC0 = mix(c0_2, c0_3, s - 2.0);
    finalC1 = mix(c1_2, c1_3, s - 2.0);
  } else {
    finalC0 = mix(c0_3, c0_4, s - 3.0);
    finalC1 = mix(c1_3, c1_4, s - 3.0);
  }

  vec3 col = mix(finalC0, finalC1, n);
  float midGlow = smoothstep(0.0, 0.5, ndotv) * smoothstep(1.0, 0.5, ndotv);
  col = mix(col * 0.35, col * 1.95, midGlow);

  col = ACESFilm(col);
  gl_FragColor = vec4(col, 1.0);
}
`;

const FRAG = `
precision highp float;
uniform float uTime;
uniform float uAudio;
uniform float uState;
varying vec3 vNormal;
varying vec3 vViewPosition;
varying vec3 vPosition;

mat3 rotX(float a){ float s=sin(a),c=cos(a); return mat3(1,0,0,0,c,-s,0,s,c); }
mat3 rotY(float a){ float s=sin(a),c=cos(a); return mat3(c,0,s,0,1,0,-s,0,c); }
mat3 rotZ(float a){ float s=sin(a),c=cos(a); return mat3(c,-s,0,s,c,0,0,0,1); }

float liquidNoise(vec3 p, float t) {
  vec3 p1 = rotX(t*0.14)*rotY(t*0.09)*p;
  vec3 q  = vec3(sin(p1.x*2.2+t*0.35), cos(p1.y*1.8-t*0.28), sin(p1.z*2.1+t*0.45));
  vec3 p2 = rotZ(-t*0.1)*rotX(t*0.06)*(p+q*0.55);
  vec3 r  = vec3(sin(p2.y*2.8+t*0.5), cos(p2.z*2.6-t*0.35), sin(p2.x*3.2+t*0.18));
  return sin(r.x*2.3+r.y*1.7)*cos(r.z*1.9);
}

vec3 ACESFilm(vec3 x) {
  float a = 2.51;
  float b = 0.03;
  float c = 2.43;
  float d = 0.59;
  float e = 0.14;
  return clamp((x*(a*x+b))/(x*(c*x+d)+e), 0.0, 1.0);
}

void main() {
  vec3 normal  = normalize(vNormal);
  vec3 viewDir = normalize(vViewPosition);
  float ndotv  = max(dot(normal, viewDir), 0.0);
  
  // Cinematic organic fresnel and halo outline
  float fresnel = pow(1.0 - ndotv, 2.2);
  float sharpRim = pow(1.0 - ndotv, 14.0);
  
  float t = uTime * 0.75;
  vec3 p  = vPosition * 1.95;

  float n1 = liquidNoise(p, t);
  float n2 = liquidNoise(p + vec3(0.4, -0.25, 0.15), t * 0.82);
  float n3 = liquidNoise(p - vec3(0.25, 0.35, -0.4), t * 1.12);

  // Filament thickness responds contextually to audio
  float thick = 0.028 + uAudio * 0.15;
  float band1 = pow(smoothstep(thick, 0.0, abs(n1 - 0.10)), 2.8);
  float band2 = pow(smoothstep(thick + 0.008, 0.0, abs(n2 + 0.12)), 2.8);
  float band3 = pow(smoothstep(thick * 1.05, 0.0, abs(n3 - 0.22)), 3.2);

  // High-fidelity chromatic spectrum definitions for each state
  vec3 neon_0 = vec3(0.0, 0.98, 1.0);  // idle - cyan
  vec3 neon_1 = vec3(0.0, 0.75, 1.0);  // listening - vibrant sky
  vec3 neon_2 = vec3(0.85, 0.1, 1.0);  // thinking - violet
  vec3 neon_3 = vec3(0.0, 1.0, 0.55);  // speaking - toxic emerald
  vec3 neon_4 = vec3(1.0, 0.15, 0.1);  // error - crimson

  vec3 mid_0 = vec3(0.05, 0.3, 1.0);   // idle
  vec3 mid_1 = vec3(0.0, 0.45, 1.0);   // listening
  vec3 mid_2 = vec3(0.5, 0.0, 0.95);   // thinking
  vec3 mid_3 = vec3(0.0, 0.8, 0.38);   // speaking
  vec3 mid_4 = vec3(0.95, 0.02, 0.25); // error

  vec3 dark_0 = vec3(0.4, 0.0, 0.95);  // idle
  vec3 dark_1 = vec3(0.0, 0.2, 0.9);   // listening
  vec3 dark_2 = vec3(0.3, 0.0, 0.75);  // thinking
  vec3 dark_3 = vec3(0.0, 0.45, 0.7);  // speaking
  vec3 dark_4 = vec3(0.5, 0.0, 0.05);  // error

  vec3 neon, mid, dark;
  float s = clamp(uState, 0.0, 4.0);

  if (s < 1.0) {
    neon = mix(neon_0, neon_1, s);
    mid  = mix(mid_0,  mid_1,  s);
    dark = mix(dark_0, dark_1, s);
  } else if (s < 2.0) {
    neon = mix(neon_1, neon_2, s - 1.0);
    mid  = mix(mid_1,  mid_2,  s - 1.0);
    dark = mix(dark_1, dark_2, s - 1.0);
  } else if (s < 3.0) {
    neon = mix(neon_2, neon_3, s - 2.0);
    mid  = mix(mid_2,  mid_3,  s - 2.0);
    dark = mix(dark_2, dark_3, s - 2.0);
  } else {
    neon = mix(neon_3, neon_4, s - 3.0);
    mid  = mix(mid_3,  mid_4,  s - 3.0);
    dark = mix(dark_3, dark_4, s - 3.0);
  }

  float diagonal = dot(normal, normalize(vec3(0.65, -0.65, 0.38))) * 0.5 + 0.5;
  vec3 rimColor = mix(mid, neon, diagonal);
  vec3 col1 = mix(mid, neon * 1.2, sin(t + p.z) * 0.5 + 0.5);
  vec3 col2 = mix(dark, neon, cos(t - p.x) * 0.5 + 0.5);
  vec3 col3 = mix(dark, mid * 1.3, sin(t * 1.15) * 0.5 + 0.5);

  vec3 finalColor = vec3(0.0);
  finalColor += band1 * col1 * 3.8;
  finalColor += band2 * col2 * 3.2;
  finalColor += band3 * col3 * 2.8;
  finalColor += fresnel * rimColor * 3.0;
  finalColor += sharpRim * neon * 4.5;

  // Render HDR mapped spectrum details
  finalColor = ACESFilm(finalColor);

  float alpha = fresnel * 0.72 + band1 * 0.95 + band2 * 0.95 + band3 * 0.95 + sharpRim * 1.0;
  alpha = clamp(alpha * (1.0 + uAudio * 0.25), 0.0, 0.98);

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
  const stateRef = useRef(0);
  const ctx = useRef<{
    renderer: any; uBack: any; uFilament: any; clock: any;
    geoBack?: any; matBack?: any; geoFil?: any; matFil?: any;
  } | null>(null);

  useEffect(() => { audioRef.current = audioLevel; }, [audioLevel]);
  useEffect(() => {
    stateRef.current = STATE_NUM[state];
  }, [state]);

  useEffect(() => {
    if (!mountRef.current) return;
    let active = true;
    let rafId: number | null = null;
    loadThree()
      .then(() => { if (active && mountRef.current) boot(); })
      .catch(e => console.error('[NeuralOrb]', e));

    function boot() {
      const THREE = (window as any).THREE;
      const el = mountRef.current!;
      el.querySelector('canvas')?.remove();

      const renderer = new THREE.WebGLRenderer({ 
        antialias: true, 
        alpha: true, 
        powerPreference: 'high-performance',
        precision: 'highp',
        stencil: false,
        depth: true
      });
      
      // Limit device pixel ratio to maintain flawless visuals on 4K/retina displays without over-rendering pixels
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(size, size);
      renderer.setClearColor(0x000000, 0);
      const canvas = renderer.domElement as HTMLCanvasElement;
      canvas.style.cssText = 'width:100%;height:100%;display:block;position:absolute;top:0;left:0;';
      el.appendChild(canvas);

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
      camera.position.z = 3.0;

      const geoBack = new THREE.SphereGeometry(0.992, 64, 64);
      const uBack = { 
        uTime: { value: 0 }, 
        uAudio: { value: 0 }, 
        uState: { value: 0 } 
      };
      const matBack = new THREE.ShaderMaterial({
        vertexShader: VERT, fragmentShader: FRAG_BACK,
        uniforms: uBack, transparent: false, depthWrite: true, side: THREE.FrontSide,
      });
      const meshBack = new THREE.Mesh(geoBack, matBack);
      scene.add(meshBack);

      const geoFil = new THREE.SphereGeometry(1.0, 64, 64);
      const uFilament = { 
        uTime: { value: 0 }, 
        uAudio: { value: 0 }, 
        uState: { value: 0 } 
      };
      const matFil = new THREE.ShaderMaterial({
        vertexShader: VERT, fragmentShader: FRAG,
        uniforms: uFilament, transparent: true, depthWrite: false,
        blending: THREE.AdditiveBlending, side: THREE.FrontSide,
      });
      const meshFil = new THREE.Mesh(geoFil, matFil);
      scene.add(meshFil);

      const clock = new THREE.Clock();
      
      // Values used for smooth frame-by-frame interpolation
      let interpolState = stateRef.current;
      let interpolAudio = 0;

      const tick = () => {
        if (!active) return;
        rafId = requestAnimationFrame(tick);
        
        const t = clock.getElapsedTime();
        
        // Linear Interpolation (LERP) smooths changes out to bypass instantaneous jittery frames
        interpolState += (stateRef.current - interpolState) * 0.08;
        interpolAudio += (audioRef.current - interpolAudio) * 0.15;

        uBack.uTime.value = t;
        uBack.uState.value = interpolState;
        uBack.uAudio.value = interpolAudio;

        uFilament.uTime.value = t;
        uFilament.uState.value = interpolState;
        uFilament.uAudio.value = interpolAudio;

        const ry = t * 0.12;
        const rx = Math.sin(t * 0.06) * 0.08;
        meshBack.rotation.y = meshFil.rotation.y = ry;
        meshBack.rotation.x = meshFil.rotation.x = rx;
        
        renderer.render(scene, camera);
      };
      tick();
      ctx.current = { renderer, uBack, uFilament, clock, geoBack, matBack, geoFil, matFil };
    }

    return () => {
      active = false;
      if (rafId !== null) cancelAnimationFrame(rafId);
      if (ctx.current) {
        const { renderer, geoBack, matBack, geoFil, matFil } = ctx.current;
        geoBack?.dispose(); matBack?.dispose();
        geoFil?.dispose(); matFil?.dispose();
        renderer?.dispose();
        ctx.current = null;
      }
      mountRef.current?.querySelector('canvas')?.remove();
    };
  }, [size]);

  return <div ref={mountRef} style={{ position: 'relative', width: `${size}px`, height: `${size}px` }} />;
}
