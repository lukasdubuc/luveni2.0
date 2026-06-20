// ─────────────────────────────────────────────────────────────
//  J.A.R.V.I.S — Luveni GM  |  components/jarvis/NeuralOrb.tsx
//
//  Perplexity-grade orb: a smooth, glossy, liquid-gradient sphere
//  with domain-warped internal flow, an iridescent fresnel rim and a
//  crisp glassy HD specular. State + audio drive palette and flow.
//
//  No outer halo shell — the orb is just the core sphere (unchanged
//  size + animation), so there's no glow "box" around it.
//
//  Bonus: a springy pointer "fidget" tilt — the orb leans toward the
//  cursor and settles back when you leave.
// ─────────────────────────────────────────────────────────────

import React, { useEffect, useRef } from 'react';

export type OrbState = 'idle' | 'listening' | 'thinking' | 'speaking' | 'error';

interface NeuralOrbProps {
  state:      OrbState;
  audioLevel: number;
  size?:      number;
}

// ── Shared GLSL: value-noise + fbm (smooth, cheap, liquid-friendly) ──
const NOISE = `
float hash(vec3 p){ return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453); }
float noise(vec3 p){
  vec3 i=floor(p); vec3 f=fract(p); f=f*f*(3.0-2.0*f);
  return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),
             mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);
}
float fbm(vec3 p){
  float a=0.5, s=0.0;
  for(int i=0;i<5;i++){ s+=a*noise(p); p*=2.02; a*=0.5; }
  return s;
}
`;

const ACES = `
vec3 ACESFilm(vec3 x){
  float a=2.51,b=0.03,c=2.43,d=0.59,e=0.14;
  return clamp((x*(a*x+b))/(x*(c*x+d)+e),0.0,1.0);
}
`;

// ── Per-state palette selector (4-segment continuous lerp on uState) ──
const PALETTE = `
void stateColors(float s, out vec3 deep, out vec3 mid, out vec3 bright, out vec3 rim){
  vec3 d0=vec3(0.015,0.045,0.150), m0=vec3(0.05,0.32,0.72), b0=vec3(0.35,0.80,1.00), r0=vec3(0.45,0.75,1.00);
  vec3 d1=vec3(0.010,0.060,0.190), m1=vec3(0.02,0.42,0.92), b1=vec3(0.45,0.88,1.00), r1=vec3(0.40,0.85,1.00);
  vec3 d2=vec3(0.090,0.020,0.190), m2=vec3(0.42,0.12,0.78), b2=vec3(0.82,0.45,1.00), r2=vec3(0.70,0.45,1.00);
  vec3 d3=vec3(0.000,0.090,0.090), m3=vec3(0.02,0.48,0.42), b3=vec3(0.30,0.95,0.72), r3=vec3(0.30,0.95,0.78);
  vec3 d4=vec3(0.150,0.000,0.020), m4=vec3(0.62,0.06,0.12), b4=vec3(1.00,0.34,0.28), r4=vec3(1.00,0.35,0.30);

  s=clamp(s,0.0,4.0);
  if(s<1.0){ float k=s;
    deep=mix(d0,d1,k); mid=mix(m0,m1,k); bright=mix(b0,b1,k); rim=mix(r0,r1,k);
  } else if(s<2.0){ float k=s-1.0;
    deep=mix(d1,d2,k); mid=mix(m1,m2,k); bright=mix(b1,b2,k); rim=mix(r1,r2,k);
  } else if(s<3.0){ float k=s-2.0;
    deep=mix(d2,d3,k); mid=mix(m2,m3,k); bright=mix(b2,b3,k); rim=mix(r2,r3,k);
  } else { float k=s-3.0;
    deep=mix(d3,d4,k); mid=mix(m3,m4,k); bright=mix(b3,b4,k); rim=mix(r3,r4,k);
  }
}
`;

const VERT = `
precision highp float;
uniform float uTime;
uniform float uAudio;
uniform float uState;
varying vec3 vNormal;
varying vec3 vView;
varying vec3 vPos;
${NOISE}
void main(){
  vNormal = normalize(normalMatrix * normal);
  // Gentle liquid breathing — barely-there at idle, swells with audio.
  float flow = fbm(position * 1.7 + vec3(0.0, 0.0, uTime * 0.22));
  float disp = (0.018 + uAudio * 0.11) * (flow - 0.5);
  vec3 p = position + normal * disp;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vView = -mv.xyz;
  vPos  = p;
  gl_Position = projectionMatrix * mv;
}
`;

// ── Core sphere: glossy liquid-gradient body (HD glassy lighting) ──
const FRAG_CORE = `
precision highp float;
uniform float uTime;
uniform float uAudio;
uniform float uState;
varying vec3 vNormal;
varying vec3 vView;
varying vec3 vPos;
${NOISE}
${ACES}
${PALETTE}
void main(){
  vec3 N = normalize(vNormal);
  vec3 V = normalize(vView);
  float ndv  = max(dot(N, V), 0.0);
  float fres = pow(1.0 - ndv, 3.0);

  // Domain-warped internal flow → smooth marbled liquid, no hard bands.
  float t = uTime * (0.16 + uState * 0.02);
  vec3 q  = vPos * 1.5;
  vec3 warp = vec3(
    fbm(q + vec3(0.0, 1.7, t)),
    fbm(q + vec3(3.2, 0.0, t)),
    fbm(q + vec3(1.1, 4.4, t))
  );
  float flow = fbm(q + warp * 1.5 + vec3(t * 0.6));
  flow = clamp((flow - 0.25) * 1.6, 0.0, 1.0);

  vec3 deep, mid, bright, rim;
  stateColors(uState, deep, mid, bright, rim);

  vec3 col = mix(deep, mid, smoothstep(0.10, 0.62, flow));
  col = mix(col, bright, smoothstep(0.58, 0.96, flow) * (0.85 + uAudio * 0.5));

  // Iridescent fresnel rim.
  col += fres * rim * 1.25;

  // Glassy multi-lobe specular — crisp HD glint + soft sheen.
  vec3 L  = normalize(vec3(0.32, 0.78, 0.55));
  vec3 H  = normalize(L + V);
  float nh = max(dot(N, H), 0.0);
  float specSharp = pow(nh, 110.0);          // tight clearcoat glint
  float specSoft  = pow(nh, 24.0) * 0.30;    // broad sheen
  vec3 specCol = bright * 0.55 + vec3(0.55);
  col += (specSharp * 1.15 + specSoft) * specCol;

  // Secondary back-rim light for extra definition.
  col += pow(1.0 - ndv, 6.0) * rim * 0.40;

  // Depth shaping — darker toward the silhouette interior.
  col *= mix(0.70, 1.14, ndv);

  // Touch more clarity/contrast for a raw, 4K-clean read.
  col = (col - 0.5) * 1.07 + 0.5;
  col *= 1.06;

  col = ACESFilm(col);
  gl_FragColor = vec4(col, 1.0);
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

const clamp1 = (v: number) => Math.max(-1, Math.min(1, v));

export default function NeuralOrb({ state, audioLevel, size = 380 }: NeuralOrbProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef(0);
  const stateRef = useRef(0);
  const pointerRef = useRef({ x: 0, y: 0, active: false });
  const ctx = useRef<{
    renderer: any; uCore: any; clock: any; geoCore?: any; matCore?: any;
  } | null>(null);

  useEffect(() => { audioRef.current = audioLevel; }, [audioLevel]);
  useEffect(() => { stateRef.current = STATE_NUM[state]; }, [state]);

  useEffect(() => {
    if (!mountRef.current) return;
    let active = true;
    let rafId: number | null = null;

    const el = mountRef.current;
    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      pointerRef.current = {
        x: clamp1(((e.clientX - r.left) / r.width) * 2 - 1),
        y: clamp1(((e.clientY - r.top) / r.height) * 2 - 1),
        active: true,
      };
    };
    const onLeave = () => { pointerRef.current.active = false; };
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerleave', onLeave);

    loadThree()
      .then(() => { if (active && mountRef.current) boot(); })
      .catch(e => console.error('[NeuralOrb]', e));

    function boot() {
      const THREE = (window as any).THREE;
      el.querySelector('canvas')?.remove();

      const renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        powerPreference: 'high-performance',
        precision: 'highp',
        stencil: false,
        depth: true,
      });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(size, size);
      renderer.setClearColor(0x000000, 0);
      const canvas = renderer.domElement as HTMLCanvasElement;
      canvas.style.cssText = 'width:100%;height:100%;display:block;position:absolute;top:0;left:0;';
      el.appendChild(canvas);

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
      camera.position.z = 3.1;

      const uCore = { uTime: { value: 0 }, uAudio: { value: 0 }, uState: { value: 0 } };
      const geoCore = new THREE.SphereGeometry(1.0, 128, 128);
      const matCore = new THREE.ShaderMaterial({
        vertexShader: VERT, fragmentShader: FRAG_CORE,
        uniforms: uCore, transparent: false, depthWrite: true, side: THREE.FrontSide,
      });
      const meshCore = new THREE.Mesh(geoCore, matCore);
      scene.add(meshCore);

      const clock = new THREE.Clock();
      let iState = stateRef.current;
      let iAudio = 0;
      let tiltX = 0, tiltY = 0, scl = 1;

      const tick = () => {
        if (!active) return;
        rafId = requestAnimationFrame(tick);
        const t = clock.getElapsedTime();

        iState += (stateRef.current - iState) * 0.07;
        iAudio += (audioRef.current - iAudio) * 0.14;

        uCore.uTime.value = t; uCore.uState.value = iState; uCore.uAudio.value = iAudio;

        // Slow idle drift (unchanged animation).
        const ry = t * 0.05;
        const rx = Math.sin(t * 0.045) * 0.06;

        // Springy pointer "fidget" — lean toward the cursor, settle back.
        const p = pointerRef.current;
        const tgtX = p.active ? p.y * 0.42 : 0;
        const tgtY = p.active ? p.x * 0.55 : 0;
        const tgtS = p.active ? 1.04 : 1.0;
        tiltX += (tgtX - tiltX) * 0.09;
        tiltY += (tgtY - tiltY) * 0.09;
        scl   += (tgtS - scl)   * 0.10;

        meshCore.rotation.x = rx + tiltX;
        meshCore.rotation.y = ry + tiltY;
        meshCore.scale.setScalar(scl);

        renderer.render(scene, camera);
      };
      tick();
      ctx.current = { renderer, uCore, clock, geoCore, matCore };
    }

    return () => {
      active = false;
      if (rafId !== null) cancelAnimationFrame(rafId);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerleave', onLeave);
      if (ctx.current) {
        const { renderer, geoCore, matCore } = ctx.current;
        geoCore?.dispose(); matCore?.dispose();
        renderer?.dispose();
        ctx.current = null;
      }
      el.querySelector('canvas')?.remove();
    };
  }, [size]);

  return <div ref={mountRef} style={{ position: 'relative', width: `${size}px`, height: `${size}px` }} />;
}
