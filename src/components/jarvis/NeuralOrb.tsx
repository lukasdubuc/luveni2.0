// ─────────────────────────────────────────────────────────────
//  J.A.R.V.I.S — Luveni GM  |  components/jarvis/NeuralOrb.tsx
// ─────────────────────────────────────────────────────────────

import { useEffect, useRef, useState } from 'react';
import type { OrbState } from '../../types/jarvis';

interface NeuralOrbProps {
  state:      OrbState;
  audioLevel: number;
  size?:      number;
}

// ── Vertex Shader (GLSL ES 1.00 Compliant Particle System) ──
const VERT = `
precision highp float;
attribute vec3  aBasePos;
attribute float aPhase;
attribute float aRadius;
attribute float aLayer;
attribute float aHue;

uniform float uTime;
uniform float uAudio;
uniform float uState;
uniform float uTransition;
uniform float uPixelRatio;
uniform float uMuted;

varying vec3  vColor;
varying float vAlpha;
varying float vAudio;

float hash(float n){ return fract(sin(n)*43758.5453); }

float noise(vec3 p){
  vec3 i=floor(p); vec3 f=fract(p);
  f=f*f*(vec3(3.0)-2.0*f); // Promoted scalar subtraction for GLSL ES 1.00 compatibility
  float n=i.x+i.y*57.0+i.z*113.0;
  return mix(
    mix(mix(hash(n),hash(n+1.0),f.x),mix(hash(n+57.0),hash(n+58.0),f.x),f.y),
    mix(mix(hash(n+113.0),hash(n+114.0),f.x),mix(hash(n+170.0),hash(n+171.0),f.x),f.y),
    f.z);
}

void main(){
  float t=uTime; float audio=uAudio; float st=uState;
  vAudio=audio;

  float rotSpeed = 0.2 + audio * 0.3;
  float cosR = cos(t*rotSpeed); float sinR = sin(t*rotSpeed);
  mat3 rotY = mat3(cosR,0.0,sinR, 0.0,1.0,0.0, -sinR,0.0,cosR);
  vec3 pos = rotY * aBasePos;

  float ns=1.4, na=0.0, os=1.0, sp=1.0;

  if(st<0.5){
    na=0.05+sin(t*0.6+aPhase)*0.025; os=1.0+sin(t*0.5)*0.02; sp=0.4;
  } else if(st<1.5){
    na=0.08+audio*0.9; os=1.0+audio*0.3; sp=1.5+audio*4.0;
  } else if(st<2.5){
    na=0.2+sin(t*3.5+aPhase*2.0)*0.1; os=1.08+sin(t*5.0)*0.06; sp=3.5; ns=4.0;
  } else if(st<3.5){
    na=0.12+audio*0.7+sin(t*8.0+aPhase)*0.08; os=1.0+audio*0.35; sp=2.5+audio*2.5;
  } else {
    na=0.3+sin(t*12.0+aPhase*3.0)*0.18; os=0.9; sp=7.0;
  }

  float n=noise(pos*ns+t*sp*0.18)*2.0-1.0;
  pos+=normalize(pos)*n*na*aRadius;

  float ang=t*(0.008+aLayer*0.005)*sp+aPhase;
  float s=sin(ang),c=cos(ang);
  mat3 ry=mat3(c,0.0,s, 0.0,1.0,0.0, -s,0.0,c);
  if(aLayer>0.15) pos=ry*pos;
  pos*=os;

  vec3 cIA=vec3(0.05,0.55,1.0),  cIB=vec3(0.45,0.15,1.0);
  vec3 cLA=vec3(0.0,1.0,1.0),   cLB=vec3(0.0,0.45,1.0);
  vec3 cTA=vec3(0.9,0.2,1.0),   cTB=vec3(0.25,0.0,0.85);
  vec3 cSA=vec3(0.0,1.0,0.65),  cSB=vec3(0.1,0.85,1.0);
  vec3 cEA=vec3(1.0,0.08,0.15), cEB=vec3(1.0,0.45,0.0);

  vec3 gI=mix(cIA,cIB,aHue), gL=mix(cLA,cLB,aHue), gT=mix(cTA,cTB,aHue);
  vec3 gS=mix(cSA,cSB,aHue), gE=mix(cEA,cEB,aHue);

  float tr=clamp(uTransition,0.0,1.0);
  vec3 col;
  if(st<0.5)      col=gI;
  else if(st<1.5) col=mix(gI,gL,tr);
  else if(st<2.5) col=mix(gL,gT,tr);
  else if(st<3.5) col=mix(gT,gS,tr);
  else            col=mix(gS,gE,tr);

  float bright=1.5+abs(n)*1.0+audio*2.0;

  // Render transitions: state calculations vs soft, translucent white cloud
  vec3 activeColor = col * bright;
  vec3 standbyColor = vec3(0.88, 0.92, 1.0) * (0.6 + abs(n) * 0.4);
  vec3 mixedColor = mix(activeColor, standbyColor, uMuted);

  vColor = mixedColor;
  vAlpha = mix(0.2+aLayer*0.2+audio*0.3, 0.08+aLayer*0.12, uMuted);

  vec4 mv=modelViewMatrix*vec4(pos,1.0);
  gl_Position=projectionMatrix*mv;

  float sz=(6.0+aLayer*6.0+audio*25.0)*(300.0/-mv.z)*uPixelRatio;
  gl_PointSize=clamp(sz,2.0,60.0);
}
`;

// ── Fragment Shader ───────────────────────────────────────────
const FRAG = `
precision highp float;
varying vec3  vColor;
varying float vAlpha;
varying float vAudio;

void main(){
  vec2 uv=gl_PointCoord*2.0-vec2(1.0); // Promoted scalar subtraction for GLSL ES 1.00 compatibility
  float d=dot(uv,uv);
  if(d>1.0) discard;
  float soft=exp(-d*0.8);
  gl_FragColor=vec4(vColor*(1.5+vAudio*1.5), soft*vAlpha*2.5);
}
`;

const STATE_NUM: Record<OrbState, number> = {
  idle:0, listening:1, thinking:2, speaking:3, error:4,
};

const STATE_LABEL: Record<OrbState, string> = {
  idle:      'STANDBY',
  listening: 'LISTENING',
  thinking:  'PROCESSING',
  speaking:  'RESPONDING',
  error:     'ERROR',
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
export default function NeuralOrb({ state, audioLevel, size = 330 }: NeuralOrbProps) {
  const mountRef   = useRef<HTMLDivElement>(null);
  const audioRef   = useRef(0);
  const isMutedRef = useRef(true);
  
  // State-driven initialization structures
  const [isInitialized, setIsInitialized] = useState(false);
  const [isMuted, setIsMuted] = useState(true);

  const ctx = useRef<{
    renderer: any; uniforms: any; clock: any; raf: number; tStart: number;
    geometry?: any; material?: any;
  } | null>(null);

  useEffect(() => { audioRef.current   = audioLevel; }, [audioLevel]);
  useEffect(() => { isMutedRef.current = isMuted;    }, [isMuted]);

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

      // HD Screen optimization
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
      const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
      camera.position.z = 3.2;

      // Particle count scaled up to 150,000
      const N  = 150000;
      const bp = new Float32Array(N * 3);
      const ph = new Float32Array(N);
      const ra = new Float32Array(N);
      const la = new Float32Array(N);
      const hu = new Float32Array(N);

      for (let i = 0; i < N; i++) {
        const layer = Math.floor(Math.random() * 5);
        const ln    = layer / 4;
        const r     = 0.75 + ln * 0.6 + Math.random() * 0.15;
        const u     = Math.random(), v = Math.random();
        const th    = 2 * Math.PI * u;
        const phi   = Math.acos(2 * v - 1);
        bp[i*3]   = r * Math.sin(phi) * Math.cos(th);
        bp[i*3+1] = r * Math.sin(phi) * Math.sin(th);
        bp[i*3+2] = r * Math.cos(phi);
        ph[i] = Math.random() * Math.PI * 2;
        ra[i] = r;
        la[i] = ln;
        hu[i] = (bp[i*3+1] / r + 1.0) * 0.5;
      }

      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(bp.slice(), 3));
      geo.setAttribute('aBasePos', new THREE.BufferAttribute(bp, 3));
      geo.setAttribute('aPhase',   new THREE.BufferAttribute(ph, 1));
      geo.setAttribute('aRadius',  new THREE.BufferAttribute(ra, 1));
      geo.setAttribute('aLayer',   new THREE.BufferAttribute(la, 1));
      geo.setAttribute('aHue',     new THREE.BufferAttribute(hu, 1));

      const uniforms = {
        uTime:       { value: 0 },
        uAudio:      { value: 0 },
        uState:      { value: 0 },
        uTransition: { value: 1 },
        uPixelRatio: { value: dpr },
        uMuted:      { value: !isInitialized || isMutedRef.current ? 1.0 : 0.0 }
      };

      const mat = new THREE.ShaderMaterial({
        vertexShader:   VERT,
        fragmentShader: FRAG,
        uniforms,
        transparent: true,
        depthWrite:  false,
        blending:    THREE.AdditiveBlending,
      });

      const pts = new THREE.Points(geo, mat);
      pts.frustumCulled = false;
      scene.add(pts);

      const clock = new THREE.Clock();
      const TDUR  = 0.65;

      const tick = () => {
        const id = requestAnimationFrame(tick);
        const t  = clock.getElapsedTime();
        uniforms.uTime.value  = t;
        uniforms.uAudio.value = isMutedRef.current ? 0 : audioRef.current;

        // Smooth transition lerp logic between colors
        const targetMuted = isMutedRef.current ? 1.0 : 0.0;
        uniforms.uMuted.value += (targetMuted - uniforms.uMuted.value) * 0.08;

        if (ctx.current) {
          uniforms.uTransition.value = Math.min(1, (t - ctx.current.tStart) / TDUR);
          ctx.current.raf = id;
        }
        renderer.render(scene, camera);
      };
      tick();

      ctx.current = { renderer, uniforms, clock, raf: 0, tStart: 0, geometry: geo, material: mat };
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

  // ── State transitions ──────────────────────────────────────
  useEffect(() => {
    if (!ctx.current) return;
    const { uniforms, clock } = ctx.current;
    const next = STATE_NUM[state];
    if (uniforms.uState.value !== next) {
      uniforms.uState.value      = next;
      ctx.current.tStart         = clock.getElapsedTime();
      uniforms.uTransition.value = 0;
    }
  }, [state]);

  const isSystemActive = isInitialized && !isMuted;

  return (
    <div 
      className="relative w-full h-[60vh] flex flex-col items-center justify-center overflow-visible"
      style={{
        fontFamily: "'Helvetica Neue', Arial, sans-serif",
        color: '#ffffff',
        userSelect: 'none',
      }}
    >
      {/* ── Global Typography & CSS Overrides ── */}
      <style dangerouslySetInnerHTML={{__html: `
        html, body, .jarvis-root {
          font-family: 'Helvetica Neue', Arial, sans-serif !important;
        }
        @keyframes subtlePulse {
          0%, 100% {
            transform: scale(1);
          }
          50% {
            transform: scale(1.05);
          }
        }
        .ethereal-button {
          transition: box-shadow 0.3s cubic-bezier(0.4, 0, 0.2, 1), border-color 0.3s ease;
        }
        .ethereal-button:hover {
          box-shadow: 0 0 16px rgba(255, 255, 255, 0.45);
          border-color: rgba(255, 255, 255, 0.6);
        }
      `}} />

      {/* ── Glowing Orb Component (With Radial Gradient and Motion Scale Pulse) ── */}
      <div
        ref={mountRef}
        style={{
          position:     'relative',
          width:        `${size}px`,
          height:       `${size}px`,
          borderRadius: '50%',
          background:   'radial-gradient(circle, rgba(138,43,226,1) 0%, rgba(0,0,255,1) 50%, rgba(255,0,255,1) 100%)',
          mixBlendMode: 'screen',
          filter:       'blur(40px)',
          animation:    'subtlePulse 4.2s infinite ease-in-out',
          overflow:     'visible',
          flexShrink:   0,
        }}
      />

      {/* ── Single Standby/State Text Line (Secondary low opacity layout) ── */}
      <div style={{
        marginTop:     28,
        fontSize:      11,
        fontWeight:    500,
        letterSpacing: '0.4em',
        color:         '#ffffff',
        opacity:       0.25,
        textTransform: 'uppercase',
        lineHeight:    1,
        textAlign:     'center',
        overflow:      'visible',
      }}>
        {!isInitialized || isMuted ? 'STANDBY' : STATE_LABEL[state]}
      </div>

      {/* ── Main Hairline-Bordered Initialize Button (Full opacity white text) ── */}
      <button
        onClick={() => {
          if (!isInitialized) {
            setIsInitialized(true);
            setIsMuted(false);
          } else {
            setIsMuted(!isMuted);
          }
        }}
        className="ethereal-button"
        style={{
          marginTop:       24,
          padding:         '12px 32px',
          background:      'transparent',
          border:          '1px solid rgba(255,255,255,0.3)',
          color:           '#ffffff',
          opacity:         1,
          cursor:          'pointer',
          outline:         'none',
          fontSize:        '11px',
          fontWeight:      600,
          letterSpacing:   '0.2em',
          textTransform:   'uppercase',
          borderRadius:    '2px',
        }}
      >
        {!isInitialized || isMuted ? 'INITIALISE' : 'DEACTIVATE'}
      </button>

      {/* ── Backdrop-filter glassmorphism system info readout (Hidden by default, shown when active) ── */}
      <div
        style={{
          display:         isSystemActive ? 'block' : 'none',
          position:        'absolute',
          bottom:          '5%',
          padding:         '8px 16px',
          background:      'rgba(255, 255, 255, 0.02)',
          border:          '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius:    '4px',
          backdropFilter:  'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          fontFamily:      'Consolas, "Andale Mono", "Courier New", monospace',
          fontSize:        '10px',
          color:           'rgba(255, 255, 255, 0.7)',
          letterSpacing:   '0.15em',
          textTransform:   'uppercase',
          textAlign:       'center',
          boxShadow:       '0 4px 24px rgba(0, 0, 0, 0.2)',
        }}
      >
        SYS_STATUS: ACTIVE // FEED_IN: {audioLevel.toFixed(3)} // STATE: {STATE_LABEL[state]}
      </div>

    </div>
  );
}
