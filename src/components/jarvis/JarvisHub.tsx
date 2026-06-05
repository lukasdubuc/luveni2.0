// ─────────────────────────────────────────────────────────────
//  J.A.R.V.I.S — Luveni GM | components/jarvis/JarvisHub.tsx
// ─────────────────────────────────────────────────────────────

import { useState, useCallback, useRef, useEffect } from 'react';
import NeuralOrb from './NeuralOrb';
import { useVoiceInput } from '../../hooks/useVoiceInput';
import { useSpeechOutput } from '../../hooks/useSpeechOutput';
import { useGemini } from '../../hooks/useGemini';
import type { OrbState } from '../../types/jarvis';
import { motion, AnimatePresence } from 'framer-motion';

const STATE_LABEL: Record<OrbState, string> = {
  idle: 'STANDBY', listening: 'LISTENING', thinking: 'PROCESSING', speaking: 'RESPONDING', error: 'MIC ERROR',
};

const STATE_COLOR: Record<OrbState, string> = {
  idle: 'rgba(0,180,255,0.6)', listening: 'rgba(0,255,255,1.0)', thinking: 'rgba(180,100,255,1.0)', speaking: 'rgba(0,255,180,0.95)', error: 'rgba(255,80,80,1.0)',
};

const isIOS = typeof window !== 'undefined' && 
  (/iPad|iPhone|iPod/.test(navigator.userAgent) || 
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));

// Mathematically perfect, seamless tiling 3D isometric cube vector pattern
const svgPattern = `
<svg width="120" height="138.56" viewBox="0 0 120 138.56" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="top" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#14161d"/>
      <stop offset="100%" stop-color="#0a0c10"/>
    </linearGradient>
    <linearGradient id="left" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#07080b"/>
      <stop offset="100%" stop-color="#020304"/>
    </linearGradient>
    <linearGradient id="right" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#101116"/>
      <stop offset="100%" stop-color="#050608"/>
    </linearGradient>
    <g id="c">
      <polygon points="60,0 120,34.64 60,69.28 0,34.64" fill="url(#top)" stroke="#0a0c10" stroke-width="0.3"/>
      <polygon points="0,34.64 60,69.28 60,138.56 0,103.92" fill="url(#left)" stroke="#020304" stroke-width="0.3"/>
      <polygon points="60,69.28 120,34.64 120,103.92 60,138.56" fill="url(#right)" stroke="#050608" stroke-width="0.3"/>
    </g>
  </defs>
  <use href="#c" x="0" y="0"/>
  <use href="#c" x="0" y="138.56"/>
  <use href="#c" x="0" y="-138.56"/>
  <use href="#c" x="60" y="69.28"/>
  <use href="#c" x="60" y="-69.28"/>
  <use href="#c" x="-60" y="69.28"/>
  <use href="#c" x="-60" y="-69.28"/>
</svg>
`;

export function JarvisHub({ geminiApiKey, autoStart }: { geminiApiKey: string, autoStart?: boolean }) {
  const [orbState, setOrbState] = useState<OrbState>('idle');
  const [lastLine, setLastLine] = useState('');
  const [lastAiResponse, setLastAiResponse] = useState('');
  const [isReady, setIsReady] = useState(false);
  const [isLive, setIsLive] = useState(false);

  const stateTimeoutRef = useRef<any>(null);
  const orbStateRef = useRef(orbState);

  useEffect(() => { orbStateRef.current = orbState; }, [orbState]);

  const { ask } = useGemini(geminiApiKey);

  const changeOrbState = useCallback((newState: OrbState) => {
    if (stateTimeoutRef.current) clearTimeout(stateTimeoutRef.current);
    if (newState === 'idle') {
      stateTimeoutRef.current = setTimeout(() => setOrbState('idle'), 750);
    } else {
      setOrbState(newState);
    }
  }, []);

  const { speak, cancel } = useSpeechOutput({
    onStart: () => changeOrbState('speaking'),
    onEnd: () => {
      if (orbStateRef.current === 'speaking') {
        setTimeout(() => {
          if (orbStateRef.current === 'speaking') {
            changeOrbState('idle');
          }
        }, 1000);
      }
    },
  });

  const handleTranscript = useCallback(async (text: string) => {
    if (orbStateRef.current === 'thinking' || orbStateRef.current === 'speaking') {
      return;
    }

    window.speechSynthesis.cancel();
    setLastLine("Thinking...");
    changeOrbState('thinking');
    
    try {
      const reply = await ask(text);
      if (!reply) throw new Error("No response received");
      setLastLine(reply);
      setLastAiResponse(reply);
      speak(reply);
    } catch (err) {
      console.error('[Jarvis] Error:', err);
      setLastLine("System error, sir.");
      speak("System error, sir.");
      changeOrbState('idle');
    }
  }, [ask, speak, changeOrbState]);

  useVoiceInput({
    onTranscript: (text: string) => { if (isLive) handleTranscript(text); },
    onStateChange: (s: string) => {
      if (!isLive) return;
      if (s === 'listening') { cancel(); }

      if ((s === 'idle' || s === 'listening') && (orbStateRef.current === 'speaking' || orbStateRef.current === 'thinking')) {
        return;
      }

      changeOrbState(s as OrbState);
    },
    onLevelChange: () => {},
    enabled: isReady && isLive,
    isSpeaking: orbState === 'speaking',
    lastAiResponse,
    preventListening: orbState === 'speaking' || orbState === 'thinking',
  });

  const initializeJarvis = async () => {
    if (isReady) return;

    try {
      const s = new SpeechSynthesisUtterance("System online.");
      s.volume = 1; 
      window.speechSynthesis.speak(s);
    } catch (e) { 
      console.error("Audio unlock failed", e); 
    }

    setIsReady(true);
    setIsLive(true);
    
    try {
      const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtx();
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }
    } catch (e) { 
      console.error("Audio context resume failed", e); 
    }
  };

  useEffect(() => { 
    if (autoStart && !isIOS) {
      initializeJarvis(); 
    }
  }, [autoStart]);

  // Extract color values dynamically for localized glow shadows
  const shadowColor = STATE_COLOR[orbState].replace('rgba(', '').replace(/,[^,]+\)$/, '');

  return (
    <div 
      style={styles.root} 
      onClick={initializeJarvis}
      onTouchStart={initializeJarvis}
    >
      <style dangerouslySetInnerHTML={{ __html: `body { background-color: #020408 !important; margin: 0; overflow: hidden; }`}} />
      
      {/* 4K Seamless Isometric Geometry Grid */}
      <div style={styles.gridBg} />

      {/* Dynamic ambient orb glow layer that projects onto the 3D isometric blocks */}
      <div style={{
        ...styles.orbShadow,
        background: `radial-gradient(circle 350px at 50% 50%, rgba(${shadowColor}, 0.12) 0%, transparent 100%)`,
      }} />

      <div style={styles.orbWrap}>
        <NeuralOrb state={orbState} audioLevel={0} size={400} />
      </div>
      <div style={styles.transcriptContainer}>
        <AnimatePresence mode="wait">
          {lastLine && <motion.div key={lastLine} initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} style={styles.transcript}>{lastLine}</motion.div>}
        </AnimatePresence>
      </div>
      <div style={{ ...styles.stateLabel, color: orbState === 'idle' && isLive ? STATE_COLOR['listening'] : STATE_COLOR[orbState] }}>
        {orbState === 'idle' && isLive ? STATE_LABEL['listening'] : STATE_LABEL[orbState]}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  root: { 
    height: '100vh', 
    width: '100%', 
    display: 'flex', 
    flexDirection: 'column', 
    alignItems: 'center', 
    justifyContent: 'center', 
    padding: '20px', 
    boxSizing: 'border-box',
    position: 'relative',
    overflow: 'hidden'
  },
  gridBg: {
    position: 'absolute',
    inset: 0,
    backgroundImage: `
      radial-gradient(circle at 50% 50%, rgba(2, 4, 8, 0.15) 0%, rgba(2, 4, 8, 0.98) 95%),
      url("data:image/svg+xml,${encodeURIComponent(svgPattern.trim())}")
    `,
    backgroundSize: '100% 100%, 120px 138.56px',
    backgroundPosition: 'center, 0 0',
    pointerEvents: 'none',
    zIndex: 0,
  },
  orbShadow: {
    position: 'absolute',
    inset: 0,
    pointerEvents: 'none',
    zIndex: 1,
    transition: 'background 0.3s ease',
  },
  orbWrap: { cursor: 'pointer', display: 'flex', justifyContent: 'center', zIndex: 5 },
  stateLabel: { marginTop: 'auto', marginBottom: '20px', fontSize: '12px', fontFamily: "'Inter', sans-serif", letterSpacing: '0.6rem', fontWeight: 300, textTransform: 'uppercase', zIndex: 10 },
  transcriptContainer: { position: 'absolute', top: '70%', left: '50%', transform: 'translate(-50%, -50%)', width: '90%', maxWidth: '800px', textAlign: 'center', zIndex: 5 },
  transcript: { color: '#fff', fontSize: '1.5rem', fontFamily: "'Inter', sans-serif", lineHeight: 1.4 }
};

export default JarvisHub;
