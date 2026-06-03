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
  const [telemetry, setTelemetry]   = useState({
    core: false,
    vision: false,
    memory: false
  });
  
  const smoothLevel = useRef(0);
  const rafRef = useRef<number>(0);

  const { ask } = useGemini(geminiApiKey);

  useEffect(() => {
    const tick = () => {
      smoothLevel.current += (audioLevel - smoothLevel.current) * 0.25;
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
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
    onStart: () => setOrbState('speaking'),
    onBoundary: (lvl) => { setAudioLevel(lvl); },
    onEnd: () => {
      setAudioLevel(0);
      setOrbState('idle');
    },
  });

  const handleTranscript = useCallback(
    async (text: string) => {
      setLastLine(text);
      setOrbState('thinking');
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
    [ask, cancel, speak]
  );

  useVoiceInput({
    onTranscript: handleTranscript,
    onStateChange: (s) => {
      if (s === 'idle' && orbState === 'speaking') return;
      setOrbState(s);
    },
    onLevelChange: (lvl) => { setAudioLevel(lvl); },
    enabled: isReady,
  });

  return (
    <div style={styles.root}>
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
              <span style={{ fontSize: 7, marginRight: 5 }}>{isOnline ? '●' : '○'}</span>
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

      <div style={{ ...styles.stateLabel, color: STATE_COLOR[orbState] }}>
        {STATE_LABEL[orbState]}
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

      {!isReady && (
        <button
          style={styles.activateBtn}
          onClick={() => setIsReady(true)}
        >
          INITIALISE JARVIS
        </button>
      )}

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
    padding: '3px 10px',
    border: '1px solid',
    borderRadius: 2,
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
  activateBtn: {
    marginTop: 20,
    padding: '12px 30px',
    fontSize: 14,
    letterSpacing: 6,
    background: 'rgba(0,180,255,0.08)',
    border: '1px solid rgba(0,200,255,0.5)',
    color: '#fff',
    cursor: 'pointer',
    zIndex: 20,
    textTransform: 'uppercase',
  },
  bottomMeta: {
    position: 'absolute',
    bottom: 20,
    fontSize: 8,
    letterSpacing: 2,
    color: 'rgba(255,255,255,0.1)',
  },
};
