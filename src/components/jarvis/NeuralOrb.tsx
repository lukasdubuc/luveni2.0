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

// ── Fragment Shader (Simplex 3D Noise & Fresnels for Siri-style Plasma) ──
const FRAG = `
precision highp float;
uniform float uTime;
uniform float uAudio;
uniform float uState;

varying vec3 vNormal;
varying vec3 vViewPosition;
varying vec3 vPosition;

// ── Classic 3D Simplex Noise algorithm ──
vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
float mod289(float x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

float snoise(vec3 v) {
  const vec2 C = vec2(1.0/6.0, 1.0/3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);

  vec3 i  = floor(v + dot(v, C.yyy) );
  vec3 x0 =   v - i + dot(i, C.xxx) ;

  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min( g.xyz, l.zxy );
  vec3 i2 = max( g.xyz, l.zxy );

  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;

  i = mod289(i);
  vec4 p = permute( permute( permute(
             i.z + vec4(0.0, i1.z, i2.z, 1.0 ))
           + i.y + vec4(0.0, i1.y, i2.y, 1.0 ))
           + i.x + vec4(0.0, i1.x, i2.x, 1.0 ));

  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;

  vec4 j = p - 49.0 * floor(p * ns.z);

  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_ );

  vec4 x = x_ *ns.x + ns.yyyy;
  vec4 y = y_ *ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);

  vec4 b0 = vec4( x.xy, y.xy );
  vec4 b1 = vec4( x.zw, y.zw );

  vec4 s0 = floor(b0)*2.0 + 1.0;
  vec4 s1 = floor(b1)*2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));

  vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy ;
  vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww ;

  vec3 p0 = vec3(a0.xy,h.x);
  vec3 p1 = vec3(a0.zw,h.y);
  vec3 p2 = vec3(a1.xy,h.z);
  vec3 p3 = vec3(a1.zw,h.w);

  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
  p0 *= norm.x;
  p1 *= norm.y;
  p2 *= norm.z;
  p3 *= norm.w;

  vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
  m = m * m;
  return 42.0 * dot( m*m, vec4( dot(p0,x0), dot(p1,x1),
                                dot(p2,x2), dot(p3,x3) ) );
}

void main() {
  vec3 normal = normalize(vNormal);
  vec3 viewDir = normalize(vViewPosition);

  // Rim Fresnel
  float fresnel = pow(1.0 - max(dot(normal, viewDir), 0.0), 3.0);

  // Dynamic moving noise coordinate spaces
  float t = uTime * 0.4;
  vec3 noisePos1 = vPosition * 2.2 + vec3(0.0, t, t * 0.4);
  vec3 noisePos2 = vPosition * 2.8 - vec3(t * 0.2, 0.0, t);

  float n1 = snoise(noisePos1);
  float n2 = snoise(noisePos2);

  // Compute sinusoids modulated by simplex noise to produce clean wispy ribbon layers
  float wave1 = sin(vPosition.y * 12.0 + n1 * 4.0 + t * 2.2);
  float wave2 = cos(vPosition.x * 10.0 + n2 * 5.0 - t * 1.8);

  // Aesthetic colors: electric pink, neon cyan, deep magenta/violet
  vec3 colorPink   = vec3(0.92, 0.05, 0.58);
  vec3 colorBlue   = vec3(0.05, 0.35, 0.98);
  vec3 colorPurple = vec3(0.48, 0.0, 0.92);
  vec3 colorCyan   = vec3(0.0, 0.88, 1.0);

  // Soft ribbon widths
  float line1 = smoothstep(0.12, 0.0, abs(wave1 - 0.15));
  float line2 = smoothstep(0.14, 0.0, abs(wave2 + 0.1));

  vec3 ribbonColor1 = mix(colorPink, colorPurple, n1 * 0.5 + 0.5);
  vec3 ribbonColor2 = mix(colorBlue, colorCyan, n2 * 0.5 + 0.5);

  // Combine edge rim fresnel glow with inner neon plasma bands
  vec3 rimColor = mix(colorPurple, colorCyan, fresnel);
  vec3 finalColor = vec3(0.0);
  
  finalColor += line1 * ribbonColor1 * (1.6 + uAudio * 3.0);
  finalColor += line2 * ribbonColor2 * (1.6 + uAudio * 3.0);
  finalColor += fresnel * rimColor * 2.5;

  // Opacity: Sphere shell is mostly transparent, edges and waves are luminous
  float alpha = fresnel * 0.7 + line1 * 0.85 + line2 * 0.85;
  alpha = clamp(alpha, 0.0, 0.95);

  // Render a subtle dark core backing to prevent complete transparency
  float centerDarkness = smoothstep(0.85, 0.0, dot(normal, viewDir));
  finalColor = mix(finalColor, vec3(0.02, 0.01, 0.05), centerDarkness * 0.35);

  gl_FragColor = vec4(finalColor, alpha);
}
`;

const STATE_NUM: Record<OrbState, number> = {
  idle:0, listening:1, thinking:2, speaking:3, error:4,
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
    renderer: any; uniforms: any; clock: any; raf: number;
    geometry?: any; material?: any;
  } | null>(null);

  useEffect(() => { audioRef.current = audioLevel; }, [audioLevel]);

  // ── Boot WebGL once ────────────────────────────────────────
  useEffect(() => {
    if (!mountRef.current) return;
    let dead = false;

    loadThree()
      .then(() => { if (!dead && mountRef.current) boot(); })
      .catch(e => console.error('[NeuralOrb]', e));

    function boot() {
      const THREE = (window as any).THREE;
      const el    = mountRef.current!;

      el.querySelector('canvas')?.remove();

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
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

      // 1.0-radius sphere representing the dynamic plasma boundary
      const geo = new THREE.SphereGeometry(1.0, 64, 64);

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
        blending:    THREE.NormalBlending,
      });

      const mesh = new THREE.Mesh(geo, mat);
      scene.add(mesh);

      const clock = new THREE.Clock();

      const tick = () => {
        const id = requestAnimationFrame(tick);
        const t  = clock.getElapsedTime();
        uniforms.uTime.value  = t;
        uniforms.uAudio.value = audioRef.current;

        if (ctx.current) {
          ctx.current.raf = id;
        }
        renderer.render(scene, camera);
      };
      tick();

      ctx.current = { renderer, uniforms, clock, raf: 0, geometry: geo, material: mat };
    }

    return () => {
      dead = true;
      if (ctx.current) {
        cancelAnimationFrame(ctx.current.raf);
        ctx.current.geometry?.dispose();
        ctx.current.material?.dispose();
        ctx.current.renderer.dispose();
        mountRef.current?.querySelector('canvas')?.remove();
        ctx.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size]);

  // ── State updates ──────────────────────────────────────────
  useEffect(() => {
    if (!ctx.current) return;
    ctx.current.uniforms.uState.value = STATE_NUM[state];
  }, [state]);

  return (
    <div className="relative w-full h-[60vh] flex items-center justify-center overflow-visible">
      {/* ── Outer mounting container with zero background-gradient colors forcing clipping ── */}
      <div
        ref={mountRef}
        style={{
          position: 'relative',
          width:    `${size}px`,
          height:   `${size}px`,
          overflow: 'visible',
        }}
      />
    </div>
  );
}
