// ─────────────────────────────────────────────────────────────
// J.A.R.V.I.S — Luveni GM | components/jarvis/JarvisHub.tsx
// ─────────────────────────────────────────────────────────────

import { useState, useCallback, useRef, useEffect } from 'react';
import NeuralOrb from './NeuralOrb';
import { useVoiceInput } from '../../hooks/useVoiceInput';
import { useSpeechOutput } from '../../hooks/useSpeechOutput';
import { useGemini } from '../../hooks/useGemini';
import type { OrbState } from '../../types/jarvis';
import { motion, AnimatePresence } from 'framer-motion';

// --- CONSTANTS ---
const STATE_LABEL: Record<OrbState, string> = {
  idle:      'STANDBY',
  listening: 'LISTENING',
  thinking:  'PROCESSING',
  speaking:  'RESPONDING',
  error:     'MIC ERROR',
};

const STATE_COLOR: Record<OrbState, string> = {
  idle:      'rgba(0,180,255,0.6)',
  listening: 'rgba(0,255,255,1.0)',
  thinking:  'rgba(180,100,255,1.0)',
  speaking:  'rgba(0,255,180,0.95)',
  error:     'rgba(255,80,80,1.0)',
};

export default function JarvisHub({ geminiApiKey, autoStart }: { geminiApiKey: string, autoStart?: boolean }) {
  // --- STATE ---
  const [orbState, setOrbState]      = useState<OrbState>('idle');
  const [audioLevel, setAudioLevel] = useState(0);
  const [lastLine, setLastLine]      = useState('');
  const [lastAiResponse, setLastAiResponse] = useState('');
  const [isReady, setIsReady]        = useState(false);
  const [isLive, setIsLive]          = useState(false);

  // --- REFS ---
  const containerRef    = useRef<HTMLDivElement>(null);
  const targetLevelRef  = useRef(0);
  const smoothLevelRef  = useRef(0);
  const stateTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const orbStateRef     = useRef(orbState);

  // --- EFFECT: Sync State ---
  useEffect(() => { 
    orbStateRef.current = orbState; 
  }, [orbState]);

  // --- EFFECT: Fix background flash and set body background globally ---
  useEffect(() => {
    // These styles target the actual document body before React renders
    document.documentElement.style.backgroundColor = '#020408';
    document.body.style.backgroundColor = '#020408';
    document.body.style.margin = '0';
    document.body.style.padding = '0';
    document.body.style.overflow = 'hidden'; // Ensure background doesn't shift on overscroll
  }, []);

  const { ask } = useGemini(geminiApiKey);

  const changeOrbState = useCallback((newState: OrbState) => {
    if (stateTimeoutRef.current) { clearTimeout(stateTimeoutRef.current); stateTimeoutRef.current = null; }
    if (newState === 'idle') {
      stateTimeoutRef.current = setTimeout(() => setOrbState('idle'), 750);
    } else {
      setOrbState(newState);
    }
  }, []);

  // --- AUDIO OUTPUT ---
  const { speak, cancel } = useSpeechOutput({
    onStart: () => changeOrbState('speaking'),
    onBoundary: (lvl) => { targetLevelRef.current = lvl; },
    onEnd: () => {
      targetLevelRef.current = 0;
      if (orbStateRef.current === 'speaking') changeOrbState('idle');
    },
  });

  // --- TRANSCRIPT HANDLER ---
  const handleTranscript = useCallback(async (text: string) => {
    // Only cancel if we are currently speaking, not if we are just idling
    if (orbStateRef.current === 'speaking') cancel();
    
    setLastLine(text);
    changeOrbState('thinking');
    targetLevelRef.current = 0;
    
    try {
      const reply = await ask(text);
      setLastLine(reply);
      setLastAiResponse(reply);
      speak(reply);
    } catch (err) {
      console.error('[Jarvis] Error:', err);
      changeOrbState('idle');
    }
  }, [ask, cancel, speak, changeOrbState]);

  // --- VOICE INPUT HOOK ---
  useVoiceInput({
    onTranscript: (text: any) => { if (isLive) handleTranscript(text); },
    onStateChange: (s: any) => {
      if (!isLive) return;
      if (s === 'listening') { cancel(); targetLevelRef.current = 0; smoothLevelRef.current = 0; }
      changeOrbState(s);
    },
    onLevelChange: (lvl: any) => {
      if (!isLive) { targetLevelRef.current = 0; return; }
      targetLevelRef.current = lvl;
    },
    enabled: isReady && isLive,
    isSpeaking: orbState === 'speaking',
    lastAiResponse: lastAiResponse,
    preventListening: orbState === 'speaking' || orbState === 'thinking',
  });

  // --- ANIMATION TICK ---
  useEffect(() => {
    let rafId: number;
    const tick = () => {
      smoothLevelRef.current += (targetLevelRef.current - smoothLevelRef.current) * 0.15;
      if (Math.abs(smoothLevelRef.current) < 0.001) smoothLevelRef.current = 0;
      setAudioLevel(smoothLevelRef.current);
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(rafId); if (stateTimeoutRef.current) clearTimeout(stateTimeoutRef.current); };
  }, []);

  // --- INITIALIZATION ---
  const initializeJarvis = async () => {
    setIsReady(true);
    setIsLive(true);
    // Ensure we don't trigger the synth if not needed
    try {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    } catch (e) {}
  };

  const displayLabel = (isReady && isLive && orbState === 'idle') ? STATE_LABEL['listening'] : STATE_LABEL[orbState];
  const displayColor = (isReady && isLive && orbState === 'idle') ? STATE_COLOR['listening'] : STATE_COLOR[orbState];

  return (
    <div ref={containerRef} style={styles.root}>
      {/* Strict CSS injection ensures background is black for mobile header and footer.
        The #root background stops the white flash before React mounts.
      */}
      <style dangerouslySetInnerHTML={{ __html: `
        #root, html, body { 
          background-color: #020408 !important; 
          height: 100%;
          width: 100%;
          margin: 0;
          padding: 0;
          overflow: hidden;
        }
      ` }} />
      
      <div style={styles.orbWrap} onClick={initializeJarvis}>
        <NeuralOrb state={orbState} audioLevel={audioLevel} size={400} />
      </div>

      <div style={styles.transcriptContainer}>
        <AnimatePresence mode="wait">
          {lastLine && (
            <motion.div key={lastLine} style={styles.transcript}>
              {lastLine}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* State label positioned bottom center for clear mobile formatting */}
      <div style={{ ...styles.stateLabel, color: displayColor }}>
        {displayLabel}
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
    background: '#020408',
    padding: '20px',
    boxSizing: 'border-box'
  },
  orbWrap: { 
    cursor: 'pointer', 
    display: 'flex', 
    justifyContent: 'center' 
  },
  stateLabel: { 
    marginTop: 'auto', // Pushes it towards the bottom of the screen
    marginBottom: '20px',
    fontSize: '12px', 
    fontFamily: "'Inter', sans-serif", 
    letterSpacing: '0.6rem', 
    fontWeight: 300, 
    textTransform: 'uppercase',
    zIndex: 10,
  },
  transcriptContainer: {
    // Fixed height and positioned middle center ensures zero overlap with label
    position: 'absolute',
    top: '60%', 
    left: '50%',
    transform: 'translate(-50%, -50%)',
    width: '100%',
    maxWidth: '800px',
    height: '150px', // Provides ample room for multiple lines
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
    zIndex: 5,
  },
  transcript: { 
    color: '#fff', 
    fontSize: '1.5rem', 
    fontFamily: "'Inter', sans-serif", 
    lineHeight: 1.4 
  }
};
