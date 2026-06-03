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

// ── Vertex Shader ─────────────────────────────────────────────
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

varying vec3  vColor;
varying float vAlpha;
varying float vAudio;

float hash(float n){ return fract(sin(n)*43758.5453); }

float noise(vec3 p){
  vec3 i=floor(p); vec3 f=fract(p);
  f=f*f*(3.0-2.0*f);
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
  vColor=col*bright;
  vAlpha=0.2+aLayer*0.2+audio*0.3;

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
  vec2 uv=gl_PointCoord*2.0-1.0;
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

const LABEL_COLOUR: Record<OrbState, string> = {
  idle:      'rgba(0,180,255,0.55)',
  listening: 'rgba(0,230,255,0.92)',
  thinking:  'rgba(200,140,255,0.92)',
  speaking:  'rgba(0,255,160,0.92)',
  error:     'rgba(255,80,100,0.92)',
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

function IconUnmuted() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none"
      stroke="rgba(0,212,255,0.95)" strokeWidth="1.7"
      strokeLinecap="round" strokeLinejoin="round">
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
    </svg>
  );
}

function IconMuted() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none"
      stroke="rgba(160,170,190,0.65)" strokeWidth="1.7"
      strokeLinecap="round" strokeLinejoin="round">
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
      <line x1="23" y1="9" x2="17" y2="15"/>
      <line x1="17" y1="9" x2="23" y2="15"/>
    </svg>
  );
}

// ── Component ─────────────────────────────────────────────────
export default function NeuralOrb({ state, audioLevel, size = 500 }: NeuralOrbProps) {
  const mountRef   = useRef<HTMLDivElement>(null);
  const audioRef   = useRef(0);
  const isMutedRef = useRef(true);
  const [isMuted, setIsMuted] = useState(true);

  const ctx = useRef<{
    renderer: any; uniforms: any; clock: any; raf: number; tStart: number;
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

      // Remove any leftover canvas from a previous mount
      el.querySelector('canvas')?.remove();

      const dpr = window.devicePixelRatio || 1;

      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      // Tell Three to render at native resolution
      renderer.setPixelRatio(dpr);
      // Logical CSS size — Three internally multiplies by dpr for the backing store
      renderer.setSize(size, size);
      renderer.setClearColor(0x000000, 0);

      const canvas = renderer.domElement as HTMLCanvasElement;

      // ── Critical: force the CSS display size to match exactly ──
      // Without this, on retina screens the canvas DOM element is
      // size*dpr pixels wide/tall which breaks our wrapper clip.
      canvas.style.width        = `${size}px`;
      canvas.style.height       = `${size}px`;
      canvas.style.display      = 'block';
      // No borderRadius or clipPath on the canvas itself —
      // the parent wrapper handles the circle clipping.
      el.appendChild(canvas);

      const scene  = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
      camera.position.z = 3.2;

      const N  = 80000;
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
        hu[i] = (bp[i*3+1] / r + 1) * 0.5;
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
        if (ctx.current) {
          uniforms.uTransition.value = Math.min(1, (t - ctx.current.tStart) / TDUR);
          ctx.current.raf = id;
        }
        renderer.render(scene, camera);
      };
      tick();

      ctx.current = { renderer, uniforms, clock, raf: 0, tStart: 0 };
    }

    return () => {
      dead = true;
      if (ctx.current) {
        cancelAnimationFrame(ctx.current.raf);
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

  // ── Sizes ──────────────────────────────────────────────────
  const btnSize = 64; // fixed clean size regardless of orb size

  return (
    <div style={{
      display:       'flex',
      flexDirection: 'column',
      alignItems:    'center',
      userSelect:    'none',
      // No gap here — we control spacing with explicit margins below
    }}>

      {/* ── Orb wrapper: clips canvas into a perfect circle ── */}
      <div
        ref={mountRef}
        style={{
          width:        size,
          height:       size,
          borderRadius: '50%',
          // overflow:hidden is what actually clips — no white bg,
          // because the canvas already has alpha:true + clearColor(0,0,0,0)
          overflow:     'hidden',
          flexShrink:   0,
          // No background here — transparent so page bg shows through
          // until WebGL boots. Avoids the white circle flash.
          background:   'transparent',
        }}
      />

      {/* ── State label ── */}
      <div style={{
        marginTop:     20,
        fontFamily:    '"SF Mono","Fira Code","Courier New",monospace',
        fontSize:      11,
        fontWeight:    500,
        letterSpacing: '0.38em',
        color:         LABEL_COLOUR[state],
        textTransform: 'uppercase',
        transition:    'color 0.4s ease',
        lineHeight:    1,
        textAlign:     'center',
      }}>
        {STATE_LABEL[state]}
      </div>

      {/* ── Spacer between label and button ── */}
      <div style={{ height: 32 }} />

      {/* ── Single mute / unmute button ── */}
      <button
        onClick={() => setIsMuted(m => !m)}
        aria-label={isMuted ? 'Unmute Jarvis' : 'Mute Jarvis'}
        title={isMuted ? 'Go live with Jarvis' : 'Mute Jarvis'}
        style={{
          width:           btnSize,
          height:          btnSize,
          borderRadius:    '50%',
          border:          isMuted
            ? '1.5px solid rgba(160,170,200,0.2)'
            : '1.5px solid rgba(0,212,255,0.55)',
          background:      isMuted
            ? 'rgba(12,18,32,0.85)'
            : 'rgba(0,212,255,0.07)',
          backdropFilter:  'blur(14px)',
          WebkitBackdropFilter: 'blur(14px)',
          cursor:          'pointer',
          display:         'flex',
          alignItems:      'center',
          justifyContent:  'center',
          transition:      'all 0.35s cubic-bezier(0.4,0,0.2,1)',
          boxShadow:       isMuted
            ? 'none'
            : '0 0 24px rgba(0,212,255,0.3), inset 0 0 14px rgba(0,212,255,0.05)',
          outline:         'none',
          flexShrink:      0,
          padding:         0,
        }}
      >
        {isMuted ? <IconMuted /> : <IconUnmuted />}
      </button>

      {/* ── Hint label under button ── */}
      <div style={{
        marginTop:     10,
        fontFamily:    '"SF Mono","Fira Code","Courier New",monospace',
        fontSize:      9,
        letterSpacing: '0.28em',
        color:         isMuted
          ? 'rgba(100,120,145,0.5)'
          : 'rgba(0,212,255,0.45)',
        textTransform: 'uppercase',
        transition:    'color 0.35s ease',
        lineHeight:    1,
        textAlign:     'center',
      }}>
        {isMuted ? 'MUTED  ·  CLICK TO GO LIVE' : 'LIVE  ·  CLICK TO MUTE'}
      </div>

    </div>
  );
}
