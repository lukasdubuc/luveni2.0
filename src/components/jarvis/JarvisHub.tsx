// ─────────────────────────────────────────────────────────────
//  J.A.R.V.I.S — Luveni GM  |  components/jarvis/JarvisHub.tsx
//  Main entry — wires orb + voice input + Gemini + TTS
// ─────────────────────────────────────────────────────────────

import { useState, useCallback, useRef, useEffect } from 'react';
import NeuralOrb from './NeuralOrb';
import { useVoiceInput } from '../../hooks/useVoiceInput';
import { useSpeechOutput } from '../../hooks/useSpeechOutput';
import { useGemini } from '../../hooks/useGemini';
import type { OrbState } from '../../types/jarvis';
import { AGENTS } from '../../lib/jarvis-config';
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from 'framer-motion';

interface JarvisHubProps {
  geminiApiKey: string;
}

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

export default function JarvisHub({ geminiApiKey }: JarvisHubProps) {
  const [orbState, setOrbState]     = useState<OrbState>('idle');
  const [audioLevel, setAudioLevel] = useState(0);
  const [lastLine, setLastLine]     = useState('');
  const [isReady, setIsReady]       = useState(false);
  const [isMuted, setIsMuted]       = useState(true); // Starts muted on load
  const [telemetry, setTelemetry]   = useState({
    core: false,
    vision: false,
    memory: false
  });
  
  const smoothLevel = useRef(0);
  const rafRef = useRef<number>(0);
  const stateTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const { ask } = useGemini(geminiApiKey);

  // Smooth state transition to debounce VAD state-flickers (fixes flashing text)
  const changeOrbState = useCallback((newState: OrbState) => {
    if (stateTimeoutRef.current) {
      clearTimeout(stateTimeoutRef.current);
      stateTimeoutRef.current = null;
    }

    if (newState === 'idle') {
      // Debounce falling back to Standby to bridge visual gaps in voice engine detection
      stateTimeoutRef.current = setTimeout(() => {
        setOrbState('idle');
      }, 750);
    } else {
      setOrbState(newState);
    }
  }, []);

  useEffect(() => {
    const tick = () => {
      smoothLevel.current += (audioLevel - smoothLevel.current) * 0.25;
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(rafRef.current);
      if (stateTimeoutRef.current) clearTimeout(stateTimeoutRef.current);
    };
  }, [audioLevel]);

  useEffect(() => {
    const checkTelemetry = async () => {
      const coreOnline = !!geminiApiKey && geminiApiKey.length > 10;
      
      let visionOnline = false;
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        visionOnline = devices.some(d => d.kind === 'audioinput') && isReady;
      } catch (e) {
        visionOnline = false;
      }

      let memoryOnline = false;
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          const { error } = await supabase.from('memories').select('count').limit(1);
          if (!error) memoryOnline = true;
        }
      } catch (e) {
        memoryOnline = false;
      }

      setTelemetry({
        core: coreOnline,
        vision: visionOnline,
        memory: memoryOnline
      });
    };

    checkTelemetry();
    const interval = setInterval(checkTelemetry, 5000);
    return () => clearInterval(interval);
  }, [geminiApiKey, isReady]);

  const { speak, cancel } = useSpeechOutput({
    onStart: () => changeOrbState('speaking'),
    onBoundary: (lvl) => { setAudioLevel(lvl); },
    onEnd: () => {
      setAudioLevel(0);
      changeOrbState('idle');
    },
  });

  const handleTranscript = useCallback(
    async (text: string) => {
      if (isMuted) return; // Drop processing if mic receives transcripts while muting
      setLastLine(text);
      changeOrbState('thinking');
      setAudioLevel(0);
      cancel();
      try {
        const reply = await ask(text);
        setLastLine(reply);
        speak(reply);
      } catch (err) {
        console.error('[Jarvis] Gemini error:', err);
        speak('I encountered an issue reaching the neural network, sir.');
      }
    },
    [ask, cancel, speak, changeOrbState, isMuted]
  );

  useVoiceInput({
    onTranscript: (text) => {
      if (isMuted) return; // Drop transcript triggers instantly when muted
      handleTranscript(text);
    },
    onStateChange: (s) => {
      if (isMuted) return; // Drop any asynchronous engine state updates if muted
      if (s === 'idle' && orbState === 'speaking') return;
      changeOrbState(s);
    },
    onLevelChange: (lvl) => {
      if (isMuted) {
        setAudioLevel(0); // Zero out visual feedback pulses immediately
        return;
      }
      setAudioLevel(lvl);
    },
    enabled: isReady && !isMuted,
  });

  const handleActionClick = () => {
    if (!isReady) {
      setIsReady(true);
      setIsMuted(false);
      // Intro code removed - starts listening immediately on initialization
    } else {
      const nextMuted = !isMuted;
      setIsMuted(nextMuted);
      
      if (nextMuted) {
        cancel(); // Silence active TTS output immediately
        setAudioLevel(0);
        smoothLevel.current = 0;
        
        // Hard-reset transition state back to Standby
        if (stateTimeoutRef.current) {
          clearTimeout(stateTimeoutRef.current);
          stateTimeoutRef.current = null;
        }
        setOrbState('idle');
      } else {
        // Force clean start when unmuting
        setOrbState('idle');
      }
    }
  };

  // Conversational display mapping (Idle VAD states map to LISTENING instead of STANDBY when active)
  const displayLabel = (isReady && !isMuted && orbState === 'idle') 
    ? STATE_LABEL['listening'] 
    : STATE_LABEL[orbState];

  const displayColor = (isReady && !isMuted && orbState === 'idle') 
    ? STATE_COLOR['listening'] 
    : STATE_COLOR[orbState];

  return (
    <div style={styles.root}>
      {/* Scope-safe CSS style override for the HTML/Body background. 
          Prevents mobile rubber-banding white borders locally on Safari/Chrome 
          without manual DOM mutation side-effects. */}
      <style dangerouslySetInnerHTML={{ __html: `
        html, body {
          background-color: #000000 !important;
          background: #000000 !important;
        }
      ` }} />

      <div style={styles.scanlines} />
      <div style={styles.topLabel}>J·A·R·V·I·S — LUVENI</div>

      <div style={styles.agentBadges}>
        {AGENTS.map((a: { id: string; name: string }) => {
          const isOnline = telemetry[a.id as keyof typeof telemetry] ?? false;
          return (
            <div
              key={a.id}
              style={{
                ...styles.badge,
                borderColor: isOnline ? 'rgba(0,255,140,0.35)' : 'rgba(255,255,255,0.1)',
                color:       isOnline ? 'rgba(0,255,140,0.7)'  : 'rgba(255,255,255,0.2)',
              }}
            >
              <span style={{ fontSize: 7, marginRight: 6 }}>{isOnline ? '●' : '○'}</span>
              {a.name.toUpperCase()}
            </div>
          );
        })}
      </div>

      <div style={styles.orbWrap}>
        <NeuralOrb state={orbState} audioLevel={smoothLevel.current} size={400} />
        <motion.div 
          animate={{
            boxShadow: `0 0 ${100 + smoothLevel.current * 200}px ${STATE_COLOR[orbState].replace('rgba(', 'rgba(').replace(/,[^,]+\)$/, ',0.4)')}`,
            scale: 1.05 + smoothLevel.current * 0.15
          }}
          style={styles.glowRing} 
        />
      </div>

      <div style={{ ...styles.stateLabel, color: displayColor }}>
        {displayLabel}
      </div>

      <div style={styles.transcriptContainer}>
        <AnimatePresence mode="wait">
          {lastLine && (
            <motion.div
              key={lastLine}
              initial={{ opacity: 0, y: 20, filter: 'blur(15px)', scale: 0.95 }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)', scale: 1 }}
              exit={{ opacity: 0, y: -20, filter: 'blur(15px)', scale: 1.05 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              style={styles.transcript}
            >
              {lastLine}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Merged Initialize & Mute Action Controller */}
      <motion.button
        whileHover={{ scale: 1.06, backgroundColor: 'rgba(255,255,255,0.03)' }}
        whileTap={{ scale: 0.95 }}
        style={{
          ...styles.circularControlBtn,
          borderColor: !isReady 
            ? 'rgba(180,100,255,0.4)' // Purple for Uninitialized
            : isMuted 
              ? 'rgba(255,80,80,0.4)'    // Red for Muted
              : 'rgba(0,255,255,0.4)',  // Cyan for Active
          boxShadow: !isReady
            ? '0 0 20px rgba(180,100,255,0.08)'
            : isMuted
              ? '0 0 20px rgba(255,80,80,0.08)'
              : '0 0 20px rgba(0,255,255,0.08)'
        }}
        onClick={handleActionClick}
        aria-label={!isReady ? "Initialize J.A.R.V.I.S." : isMuted ? "Unmute J.A.R.V.I.S." : "Mute J.A.R.V.I.S."}
      >
        {!isReady ? (
          /* Sleek Initialize/Power Icon */
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" style={{ width: 22, height: 22, color: 'rgba(180,100,255,0.95)' }}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5.636 5.636a9 9 0 1 0 12.728 0M12 3v9" />
          </svg>
        ) : isMuted ? (
          /* Muted State Icon (Slashed Mic) */
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" style={{ width: 22, height: 22, color: 'rgba(255,80,80,0.95)' }}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M2.25 2.25l19.5 19.5M15.364 15.364l4.656-4.656m0 0l2.25 2.25m-2.25-2.25l2.25-2.25m-4.5 4.5l-2.25-2.25M9 10.5v1.5a3 3 0 003 3v0M12 4.5c.828 0 1.5.672 1.5 1.5V9M12 21v-3" />
          </svg>
        ) : (
          /* Active State Icon (Mic On) */
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" style={{ width: 22, height: 22, color: 'rgba(0,255,255,0.95)' }}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V6a3 3 0 016 0v6.75a3 3 0 01-3 3z" />
          </svg>
        )}
      </motion.button>

      <div style={styles.bottomMeta}>
        Gemini 2.5 Flash · Web Speech VAD · Always Listening
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  root: {
    position: 'relative',
    minHeight: '100vh',
    background: '#000000',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '20px',
    overflow: 'hidden',
    fontFamily: "'Courier New', Courier, monospace",
    color: '#fff',
    userSelect: 'none',
  },
  scanlines: {
    position: 'absolute',
    inset: 0,
    backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.06) 2px, rgba(0,0,0,0.06) 4px)',
    pointerEvents: 'none',
    zIndex: 1,
  },
  topLabel: {
    position: 'absolute',
    top: 28,
    fontSize: 10,
    letterSpacing: 9,
    color: 'rgba(255,255,255,0.12)',
    zIndex: 10,
  },
  agentBadges: {
    position: 'absolute',
    top: 24,
    right: 28,
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    alignItems: 'flex-end',
    zIndex: 10,
  },
  badge: {
    fontSize: 9,
    letterSpacing: 2,
    padding: '4px 14px',
    border: '1px solid',
    borderRadius: 9999,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  orbWrap: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 'min(50vh, 400px)',
    height: 'min(50vh, 400px)',
    zIndex: 5,
  },
  glowRing: {
    position: 'absolute',
    inset: '10%',
    borderRadius: '50%',
    pointerEvents: 'none',
    zIndex: 6,
  },
  stateLabel: {
    marginTop: 10,
    fontSize: 12,
    letterSpacing: 10,
    zIndex: 10,
    fontWeight: 'bold',
  },
  transcriptContainer: {
    marginTop: 20,
    height: 80,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
    width: '100%',
    maxWidth: 600,
  },
  transcript: {
    textAlign: 'center',
    fontSize: 16,
    color: '#fff',
    letterSpacing: 1.5,
    fontWeight: 'lighter',
  },
  circularControlBtn: {
    marginTop: 20,
    width: '56px',
    height: '56px',
    borderRadius: '9999px',
    background: 'rgba(13, 13, 30, 0.4)',
    backdropFilter: 'blur(16px)',
    WebkitBackdropFilter: 'blur(16px)',
    border: '1px solid',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'border-color 0.3s ease, box-shadow 0.3s ease',
    zIndex: 20,
    outline: 'none',
  },
  bottomMeta: {
    position: 'absolute',
    bottom: 20,
    fontSize: 8,
    letterSpacing: 2,
    color: 'rgba(255,255,255,0.1)',
  },
};
