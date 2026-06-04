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

interface JarvisHubProps {
  geminiApiKey: string;
  autoStart?: boolean;
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

export default function JarvisHub({ geminiApiKey, autoStart }: JarvisHubProps) {
  const [orbState, setOrbState]      = useState<OrbState>('idle');
  const [audioLevel, setAudioLevel] = useState(0);
  const [lastLine, setLastLine]      = useState('');
  const [lastAiResponse, setLastAiResponse] = useState('');
  const [isReady, setIsReady]        = useState(false);
  const [isLive, setIsLive]          = useState(false);

  const containerRef    = useRef<HTMLDivElement>(null);
  const targetLevelRef  = useRef(0);
  const smoothLevelRef  = useRef(0);
  const stateTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const orbStateRef     = useRef(orbState);

  useEffect(() => { orbStateRef.current = orbState; }, [orbState]);

  const { ask } = useGemini(geminiApiKey);

  const changeOrbState = useCallback((newState: OrbState) => {
    if (stateTimeoutRef.current) { clearTimeout(stateTimeoutRef.current); stateTimeoutRef.current = null; }
    if (newState === 'idle') {
      stateTimeoutRef.current = setTimeout(() => setOrbState('idle'), 750);
    } else {
      setOrbState(newState);
    }
  }, []);

  const { speak, cancel } = useSpeechOutput({
    onStart: () => changeOrbState('speaking'),
    onBoundary: (lvl) => { targetLevelRef.current = lvl; },
    onEnd: () => {
      targetLevelRef.current = 0;
      if (orbStateRef.current === 'speaking') changeOrbState('idle');
    },
  });

  const handleTranscript = useCallback(async (text: string) => {
    setLastLine(text);
    changeOrbState('thinking');
    targetLevelRef.current = 0;
    cancel();
    try {
      const reply = await ask(text);
      setLastLine(reply);
      setLastAiResponse(reply);
      speak(reply);
    } catch (err) {
      console.error('[Jarvis] error:', err);
      speak('I encountered an issue reaching the neural network, sir.');
    }
  }, [ask, cancel, speak, changeOrbState]);

  useVoiceInput({
    onTranscript: (text: any) => { if (isLive) handleTranscript(text); },
    onStateChange: (s: any) => {
      if (!isLive) return;
      if (s === 'listening') { cancel(); targetLevelRef.current = 0; smoothLevelRef.current = 0; }
      if (s === 'idle' && orbState === 'speaking') return;
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

  const initializeJarvis = async () => {
    try {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        const u = new SpeechSynthesisUtterance('');
        u.volume = 0;
        window.speechSynthesis.speak(u);
      }
    } catch (e) {}
    setIsReady(true);
    setIsLive(true);
  };

  const displayLabel = (isReady && isLive && orbState === 'idle') ? STATE_LABEL['listening'] : STATE_LABEL[orbState];
  const displayColor = (isReady && isLive && orbState === 'idle') ? STATE_COLOR['listening'] : STATE_COLOR[orbState];

  return (
    <div ref={containerRef} style={styles.root}>
      <style dangerouslySetInnerHTML={{ __html: `html, body { background-color: #020408 !important; }` }} />
      <div style={styles.orbWrap} onClick={initializeJarvis}>
        <NeuralOrb state={orbState} audioLevel={audioLevel} size={400} />
      </div>
      <div style={{ ...styles.stateLabel, color: displayColor }}>{displayLabel}</div>
      <AnimatePresence>
        {lastLine && (
          <motion.div style={styles.transcript} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            {lastLine}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  root: { height: '100vh', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: '#020408' },
  orbWrap: { cursor: 'pointer', transition: 'transform 0.3s ease' },
  stateLabel: { marginTop: '2rem', fontSize: '1.2rem', fontFamily: 'monospace', letterSpacing: '0.4rem', fontWeight: 'bold' },
  transcript: { marginTop: '1rem', color: 'rgba(255,255,255,0.7)', fontFamily: 'monospace', maxWidth: '600px', textAlign: 'center' }
};
