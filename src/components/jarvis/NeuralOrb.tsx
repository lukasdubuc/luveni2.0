// ─────────────────────────────────────────────────────────────
//  J.A.R.V.I.S — Luveni GM  |  components/jarvis/NeuralOrb.tsx
//  Volumetric glass sphere — solid atmosphere, plasma interior
// ─────────────────────────────────────────────────────────────

import { useEffect, useRef } from 'react';
import type { OrbState } from '../../types/jarvis';

interface NeuralOrbProps {
  state:      OrbState;
  audioLevel: number;
  size?:      number;
}

// ── Shared vertex shader ──────────────────────────────────────
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

// ── Layer 1: Deep glass body — solid dark core with depth ─────
const FRAG_BODY = `
precision highp float;
uniform float uTime;
uniform float uAudio;
uniform float uState;
varying vec3 vNormal;
varying vec3 vViewPosition;
varying vec3 vPosition;

mat3 rotY(float a){ float s=sin(a),c=cos(a); return mat3(c,0,s,0,1,0,-s,0,c); }
mat3 rotX(float a){ float s=sin(a),c=cos(a); return mat3(1,0,0,0,c,-s,0,s,c); }

float hash(vec3 p){ return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453); }
float noise(vec3 p){
  vec3 i=floor(p); vec3 f=fract(p);
  f=f*f*(3.0-2.0*f);
  return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),
                 mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),
             mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),
                 mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);
}

void main() {
  vec3 normal  = normalize(vNormal);
  vec3 viewDir = normalize(vViewPosition);
  float ndotv  = max(dot(normal, viewDir), 0.0);
  float t      = uTime * 0.5;

  // Swirling interior plasma
  vec3 p = rotY(t * 0.3) * rotX(t * 0.2) * vPosition * 2.2;
  float n1 = noise(p);
  float n2 = noise(p * 2.0 + vec3(t * 0.4, -t * 0.3, t * 0.2));
  float plasma = n1 * 0.6 + n2 * 0.4;

  // State-driven interior color
  vec3 cIdle    = vec3(0.18, 0.02, 0.45);
  vec3 cListen  = vec3(0.0,  0.12, 0.55);
  vec3 cThink   = vec3(0.30, 0.0,  0.60);
  vec3 cSpeak   = vec3(0.0,  0.22, 0.35);

  vec3 baseColor;
  if(uState < 0.5)      baseColor = cIdle;
  else if(uState < 1.5) baseColor = cListen;
  else if(uState < 2.5) baseColor = cThink;
  else                  baseColor = cSpeak;

  vec3 brightColor = baseColor * 3.5 + vec3(0.08, 0.04, 0.18);
  vec3 interiorColor = mix(baseColor, brightColor, plasma);

  // Depth — center is darkest, mid-sphere is richest
  float depth = 1.0 - ndotv;
  float midGlow = smoothstep(0.0, 0.5, ndotv) * smoothstep(1.0, 0.5, ndotv);
  interiorColor = mix(interiorColor * 0.15, interiorColor, midGlow * 0.9 + 0.1);
  interiorColor += uAudio * baseColor * 1.5 * midGlow;

  // Solid glass body opacity — fills the hollow completely
  float alpha = 0.82 - ndotv * 0.25;
  alpha = clamp(alpha, 0.55, 0.88);

  gl_FragColor = vec4(interiorColor, alpha);
}
`;

// ── Layer 2: Plasma filaments — swirling lines on surface ────
const FRAG_PLASMA = `
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
  vec3 q = vec3(sin(p1.x*2.0+t*0.4), cos(p1.y*2.0-t*0.3), sin(p1.z*2.0+t*0.5));
  vec3 p2 = rotZ(-t*0.12)*rotX(t*0.08)*(p+q*0.5);
  vec3 r = vec3(sin(p2.y*3.0+t*0.6), cos(p2.z*3.0-t*0.4), sin(p2.x*3.0+t*0.2));
  return sin(r.x*2.5+r.y*1.5)*cos(r.z*2.0);
}

void main() {
  vec3 normal  = normalize(vNormal);
  vec3 viewDir = normalize(vViewPosition);
  float ndotv  = max(dot(normal, viewDir), 0.0);
  float t      = uTime * 0.8;
  vec3 p       = vPosition * 1.8;

  float n1 = liquidNoise(p, t);
  float n2 = liquidNoise(p + vec3(0.5,-0.3,0.2), t*0.85);
  float n3 = liquidNoise(p - vec3(0.3,0.4,-0.5), t*1.15);

  float thick = 0.032 + uAudio * 0.10;
  float band1 = pow(smoothstep(thick,        0.0, abs(n1-0.12)), 2.6);
  float band2 = pow(smoothstep(thick+0.008,  0.0, abs(n2+0.15)), 2.6);
  float band3 = pow(smoothstep(thick*1.1,    0.0, abs(n3-0.25)), 3.0);

  // State-based palette
  vec3 cA, cB, cC;
  if(uState < 0.5){
    cA = vec3(0.95,0.02,0.60); cB = vec3(0.0,0.85,1.0); cC = vec3(0.5,0.0,1.0);
  } else if(uState < 1.5){
    cA = vec3(0.0,0.9,1.0);  cB = vec3(0.0,0.6,1.0);  cC = vec3(0.2,0.0,1.0);
  } else if(uState < 2.5){
    cA = vec3(0.7,0.0,1.0);  cB = vec3(0.4,0.0,0.9);  cC = vec3(0.9,0.1,0.6);
  } else {
    cA = vec3(0.0,1.0,0.6);  cB = vec3(0.0,0.8,0.4);  cC = vec3(0.0,0.5,1.0);
  }

  vec3 col1 = mix(cA, cA*1.3, sin(t+p.z)*0.5+0.5);
  vec3 col2 = mix(cB, cB*1.2, cos(t-p.x)*0.5+0.5);
  vec3 col3 = mix(cC, cC*1.1, sin(t*1.2)*0.5+0.5);

  vec3 finalColor = band1*col1*3.5 + band2*col2*3.0 + band3*col3*2.5;

  float filamentAlpha = band1*0.95 + band2*0.90 + band3*0.85;
  filamentAlpha = clamp(filamentAlpha, 0.0, 1.0);

  gl_FragColor = vec4(finalColor, filamentAlpha);
}
`;

// ── Layer 3: Glass rim + atmosphere ──────────────────────────
const FRAG_RIM = `
precision highp float;
uniform float uTime;
uniform float uAudio;
uniform float uState;
varying vec3 vNormal;
varying vec3 vViewPosition;
varying vec3 vPosition;

void main() {
  vec3 normal  = normalize(vNormal);
  vec3 viewDir = normalize(vViewPosition);
  float ndotv  = max(dot(normal, viewDir), 0.0);

  // Razor-thin outer glass rim
  float rim     = pow(1.0 - ndotv, 5.5);
  float softRim = pow(1.0 - ndotv, 2.2);

  // Diagonal color gradient on rim (magenta → cyan)
  float diag   = dot(normal, normalize(vec3(0.7,-0.7,0.4)))*0.5+0.5;

  vec3 rimA, rimB;
  if(uState < 0.5){
    rimA = vec3(0.95,0.02,0.60); rimB = vec3(0.0,0.95,1.0);
  } else if(uState < 1.5){
    rimA = vec3(0.0,0.8,1.0);   rimB = vec3(0.2,0.4,1.0);
  } else if(uState < 2.5){
    rimA = vec3(0.6,0.0,1.0);   rimB = vec3(0.9,0.1,0.6);
  } else {
    rimA = vec3(0.0,1.0,0.5);   rimB = vec3(0.0,0.6,1.0);
  }

  vec3 rimColor = mix(rimA, rimB, diag);

  // Atmospheric halo just inside the edge
  vec3 atmosColor = mix(rimA * 0.6, rimB * 0.6, 0.5);
  vec3 finalColor = rim * rimColor * 4.5 + softRim * atmosColor * 1.2;
  float alpha = rim * 1.0 + softRim * 0.35 + uAudio * rim * 0.8;
  alpha = clamp(alpha, 0.0, 1.0);

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
    renderer: any;
    uniformsBody: any;
    uniformsPlasma: any;
    uniformsRim: any;
    clock: any;
    meshBody?: any;
    meshPlasma?: any;
    meshRim?: any;
  } | null>(null);

  useEffect(() => { audioRef.current = audioLevel; }, [audioLevel]);
  useEffect(() => { stateRef.current = STATE_NUM[state]; }, [state]);

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

      // ── Layer 1: solid glass body ─────────────────────────
      const geoBody = new THREE.SphereGeometry(1.0, 64, 64);
      const uBody   = { uTime: {value:0}, uAudio: {value:0}, uState: {value:0} };
      const matBody = new THREE.ShaderMaterial({
        vertexShader: VERT, fragmentShader: FRAG_BODY,
        uniforms: uBody, transparent: true, depthWrite: false,
        blending: THREE.NormalBlending, side: THREE.FrontSide,
      });
      const meshBody = new THREE.Mesh(geoBody, matBody);
      meshBody.renderOrder = 0;
      scene.add(meshBody);

      // ── Layer 2: plasma filaments ─────────────────────────
      const geoPlasma = new THREE.SphereGeometry(1.01, 64, 64);
      const uPlasma   = { uTime: {value:0}, uAudio: {value:0}, uState: {value:0} };
      const matPlasma = new THREE.ShaderMaterial({
        vertexShader: VERT, fragmentShader: FRAG_PLASMA,
        uniforms: uPlasma, transparent: true, depthWrite: false,
        blending: THREE.AdditiveBlending, side: THREE.FrontSide,
      });
      const meshPlasma = new THREE.Mesh(geoPlasma, matPlasma);
      meshPlasma.renderOrder = 1;
      scene.add(meshPlasma);

      // ── Layer 3: rim glow (back face first for atmosphere) ─
      const geoRim = new THREE.SphereGeometry(1.02, 64, 64);
      const uRim   = { uTime: {value:0}, uAudio: {value:0}, uState: {value:0} };
      const matRim = new THREE.ShaderMaterial({
        vertexShader: VERT, fragmentShader: FRAG_RIM,
        uniforms: uRim, transparent: true, depthWrite: false,
        blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      });
      const meshRim = new THREE.Mesh(geoRim, matRim);
      meshRim.renderOrder = 2;
      scene.add(meshRim);

      const clock = new THREE.Clock();

      const tick = () => {
        if (!active) return;
        rafId = requestAnimationFrame(tick);
        const t = clock.getElapsedTime();

        [uBody, uPlasma, uRim].forEach(u => {
          u.uTime.value  = t;
          u.uAudio.value = audioRef.current;
          u.uState.value = stateRef.current;
        });

        // Slow organic rotation
        meshBody.rotation.y   = t * 0.08;
        meshPlasma.rotation.y = t * 0.10;
        meshPlasma.rotation.x = Math.sin(t * 0.07) * 0.12;
        meshRim.rotation.y    = t * 0.06;

        renderer.render(scene, camera);
      };
      tick();

      ctx.current = { renderer, uniformsBody: uBody, uniformsPlasma: uPlasma, uniformsRim: uRim, clock, meshBody, meshPlasma, meshRim };
    }

    return () => {
      active = false;
      if (rafId !== null) cancelAnimationFrame(rafId);
      if (ctx.current) {
        const { renderer, meshBody, meshPlasma, meshRim } = ctx.current;
        meshBody?.geometry?.dispose();    meshBody?.material?.dispose();
        meshPlasma?.geometry?.dispose();  meshPlasma?.material?.dispose();
        meshRim?.geometry?.dispose();     meshRim?.material?.dispose();
        renderer?.dispose();
        renderer?.forceContextLoss?.();
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
