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

// Named Export to prevent TanStack Router import failures
export function JarvisHub({ geminiApiKey, autoStart }: { geminiApiKey: string, autoStart?: boolean }) {
  const [orbState, setOrbState] = useState<OrbState>('idle');
  const [lastLine, setLastLine] = useState('');
  const [lastAiResponse, setLastAiResponse] = useState('');
  const [isReady, setIsReady] = useState(false);
  const [isLive, setIsLive] = useState(false);

  // Using any prevents NodeJS.Timeout vs browser window.setTimeout type conflicts
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
        // Delay transitioning back to 'idle' by 1000ms to allow audio feedback/echo to clear
        setTimeout(() => {
          if (orbStateRef.current === 'speaking') {
            changeOrbState('idle');
          }
        }, 1000);
      }
    },
  });

  const handleTranscript = useCallback(async (text: string) => {
    // STRICT FIREWALL: Ignore transcripts if Jarvis is busy thinking or speaking
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

      // STATE PROTECTION: Ignore microphone-terminated callbacks while Jarvis is speaking
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

    // 1. Speak SYNCHRONOUSLY immediately to satisfy iOS Safari gesture constraints
    try {
      const s = new SpeechSynthesisUtterance("System online.");
      s.volume = 1; 
      window.speechSynthesis.speak(s);
    } catch (e) { 
      console.error("Audio unlock failed", e); 
    }

    setIsReady(true);
    setIsLive(true);
    
    // 2. Resume Web Audio context asynchronously
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

  return (
    <div 
      style={styles.root} 
      onClick={initializeJarvis}
      onTouchStart={initializeJarvis}
    >
      <style dangerouslySetInnerHTML={{ __html: `body { background-color: #020408 !important; margin: 0; overflow: hidden; }`}} />
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
  root: { height: '100vh', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px', boxSizing: 'border-box' },
  orbWrap: { cursor: 'pointer', display: 'flex', justifyContent: 'center' },
  stateLabel: { marginTop: 'auto', marginBottom: '20px', fontSize: '12px', fontFamily: "'Inter', sans-serif", letterSpacing: '0.6rem', fontWeight: 300, textTransform: 'uppercase', zIndex: 10 },
  transcriptContainer: { position: 'absolute', top: '70%', left: '50%', transform: 'translate(-50%, -50%)', width: '90%', maxWidth: '800px', textAlign: 'center', zIndex: 5 },
  transcript: { color: '#fff', fontSize: '1.5rem', fontFamily: "'Inter', sans-serif", lineHeight: 1.4 }
};

// Default Export to prevent TanStack Router import failures
export default JarvisHub;
