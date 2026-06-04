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

// ── Vertex Shader ─────────────────────────────────────────────
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

// ── Backing sphere — solid dark glass core, no additive blowout
const FRAG_BACK = `
precision highp float;
uniform float uTime;
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
  vec3 normal  = normalize(vNormal);
  vec3 viewDir = normalize(vViewPosition);
  float ndotv  = max(dot(normal, viewDir), 0.0);
  float t      = uTime * 0.4;

  vec3 p  = vPosition * 2.0 + vec3(t*0.1, t*0.07, t*0.05);
  float n = noise(p)*0.6 + noise(p*2.1)*0.4;

  // State-driven deep interior color
  vec3 c0, c1;
  if(uState < 0.5){      c0=vec3(0.04,0.0,0.12);  c1=vec3(0.12,0.0,0.30); }
  else if(uState < 1.5){ c0=vec3(0.0,0.02,0.14);  c1=vec3(0.0,0.08,0.35); }
  else if(uState < 2.5){ c0=vec3(0.08,0.0,0.18);  c1=vec3(0.25,0.0,0.45); }
  else {                  c0=vec3(0.0,0.06,0.10);  c1=vec3(0.0,0.18,0.28); }

  vec3 col = mix(c0, c1, n);
  // Slightly brighter at mid-sphere for depth illusion
  float midGlow = smoothstep(0.0,0.5,ndotv)*smoothstep(1.0,0.5,ndotv);
  col = mix(col*0.4, col*1.6, midGlow);

  // Fully opaque — this is what kills the holes
  gl_FragColor = vec4(col, 1.0);
}
`;

// ── Original filament shader — UNCHANGED ─────────────────────
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
  vec3 p1 = rotX(t*0.15)*rotY(t*0.10)*p;
  vec3 q  = vec3(sin(p1.x*2.0+t*0.4), cos(p1.y*2.0-t*0.3), sin(p1.z*2.0+t*0.5));
  vec3 p2 = rotZ(-t*0.12)*rotX(t*0.08)*(p+q*0.5);
  vec3 r  = vec3(sin(p2.y*3.0+t*0.6), cos(p2.z*3.0-t*0.4), sin(p2.x*3.0+t*0.2));
  return sin(r.x*2.5+r.y*1.5)*cos(r.z*2.0);
}

void main() {
  vec3 normal  = normalize(vNormal);
  vec3 viewDir = normalize(vViewPosition);
  float ndotv  = max(dot(normal, viewDir), 0.0);
  float fresnel    = pow(1.0-ndotv, 2.5);
  float sharpRim   = pow(1.0-ndotv, 12.0);
  float t = uTime*0.8;
  vec3 p  = vPosition*1.8;

  float n1 = liquidNoise(p, t);
  float n2 = liquidNoise(p+vec3(0.5,-0.3,0.2), t*0.85);
  float n3 = liquidNoise(p-vec3(0.3,0.4,-0.5), t*1.15);

  float thick = 0.035 + uAudio*0.12;
  float band1 = pow(smoothstep(thick,       0.0, abs(n1-0.12)), 2.6);
  float band2 = pow(smoothstep(thick+0.01,  0.0, abs(n2+0.15)), 2.6);
  float band3 = pow(smoothstep(thick*1.1,   0.0, abs(n3-0.25)), 3.0);

  // State-based palette
  vec3 neonCyan, electricBlue, magenta, hotPink, deepIndigo;
  if(uState < 0.5){
    neonCyan=vec3(0.0,0.95,1.0); electricBlue=vec3(0.02,0.22,1.0);
    magenta=vec3(0.95,0.02,0.60); hotPink=vec3(1.0,0.08,0.75); deepIndigo=vec3(0.35,0.0,0.9);
  } else if(uState < 1.5){
    neonCyan=vec3(0.0,0.9,1.0); electricBlue=vec3(0.0,0.5,1.0);
    magenta=vec3(0.0,0.7,1.0); hotPink=vec3(0.2,0.4,1.0); deepIndigo=vec3(0.0,0.3,0.9);
  } else if(uState < 2.5){
    neonCyan=vec3(0.8,0.0,1.0); electricBlue=vec3(0.5,0.0,0.9);
    magenta=vec3(0.9,0.1,0.6); hotPink=vec3(0.7,0.0,1.0); deepIndigo=vec3(0.4,0.0,0.8);
  } else {
    neonCyan=vec3(0.0,1.0,0.6); electricBlue=vec3(0.0,0.8,0.4);
    magenta=vec3(0.0,0.6,1.0); hotPink=vec3(0.0,1.0,0.5); deepIndigo=vec3(0.0,0.5,0.8);
  }

  float diagonal  = dot(normal, normalize(vec3(0.7,-0.7,0.4)))*0.5+0.5;
  vec3  rimColor  = mix(magenta, neonCyan, diagonal);
  vec3  col1 = mix(magenta,      hotPink,      sin(t+p.z)*0.5+0.5);
  vec3  col2 = mix(electricBlue, neonCyan,     cos(t-p.x)*0.5+0.5);
  vec3  col3 = mix(deepIndigo,   magenta,      sin(t*1.2)*0.5+0.5);

  vec3 finalColor = vec3(0.0);
  finalColor += band1*col1*3.5;
  finalColor += band2*col2*3.0;
  finalColor += band3*col3*2.5;
  finalColor += fresnel*rimColor*2.8;
  finalColor += sharpRim*neonCyan*4.0;

  // No centerDarkness mix — backing sphere handles that
  float alpha = fresnel*0.65 + band1*0.9 + band2*0.9 + band3*0.9 + sharpRim*1.0;
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
  const stateRef = useRef(0);

  const ctx = useRef<{
    renderer: any; uBack: any; uFilament: any; clock: any;
    geoBack?: any; matBack?: any; geoFil?: any; matFil?: any;
  } | null>(null);

  useEffect(() => { audioRef.current = audioLevel; }, [audioLevel]);
  useEffect(() => {
    stateRef.current = STATE_NUM[state];
    if (ctx.current) {
      ctx.current.uBack.uState.value     = stateRef.current;
      ctx.current.uFilament.uState.value = stateRef.current;
    }
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
      const el    = mountRef.current!;
      el.querySelector('canvas')?.remove();

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
      renderer.setPixelRatio(dpr);
      renderer.setSize(size, size);
      renderer.setClearColor(0x000000, 0);
      renderer.sortObjects = true;

      const canvas = renderer.domElement as HTMLCanvasElement;
      canvas.style.cssText = 'width:100%;height:100%;display:block;position:absolute;top:0;left:0;overflow:visible;';
      el.appendChild(canvas);

      const scene  = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
      camera.position.z = 3.0;

      // ── Backing sphere — opaque, NormalBlending, renders first ──
      const geoBack = new THREE.SphereGeometry(0.995, 64, 64);
      const uBack   = { uTime: {value:0}, uState: {value:0} };
      const matBack = new THREE.ShaderMaterial({
        vertexShader: VERT, fragmentShader: FRAG_BACK,
        uniforms: uBack, transparent: false,
        depthWrite: true, side: THREE.FrontSide,
      });
      const meshBack = new THREE.Mesh(geoBack, matBack);
      meshBack.renderOrder = 0;
      scene.add(meshBack);

      // ── Filament sphere — additive on top ────────────────────
      const geoFil = new THREE.SphereGeometry(1.0, 64, 64);
      const uFilament = { uTime: {value:0}, uAudio: {value:0}, uState: {value:0} };
      const matFil = new THREE.ShaderMaterial({
        vertexShader: VERT, fragmentShader: FRAG,
        uniforms: uFilament, transparent: true,
        depthWrite: false, blending: THREE.AdditiveBlending,
        side: THREE.FrontSide,
      });
      const meshFil = new THREE.Mesh(geoFil, matFil);
      meshFil.renderOrder = 1;
      scene.add(meshFil);

      const clock = new THREE.Clock();

      const tick = () => {
        if (!active) return;
        rafId = requestAnimationFrame(tick);
        const t = clock.getElapsedTime();
        uBack.uTime.value        = t;
        uFilament.uTime.value    = t;
        uFilament.uAudio.value   = audioRef.current;

        // Slow shared rotation
        const ry = t * 0.08;
        const rx = Math.sin(t * 0.05) * 0.06;
        meshBack.rotation.y = ry;
        meshBack.rotation.x = rx;
        meshFil.rotation.y  = ry;
        meshFil.rotation.x  = rx;

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
        geoFil?.dispose();  matFil?.dispose();
        renderer?.dispose(); renderer?.forceContextLoss?.();
        ctx.current = null;
      }
      mountRef.current?.querySelector('canvas')?.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size]);

  return (
    <div
      ref={mountRef}
      style={{ position: 'relative', width: `${size}px`, height: `${size}px`, overflow: 'visible' }}
    />
  );
}
