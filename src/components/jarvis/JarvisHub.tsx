// ─────────────────────────────────────────────────────────────
//  J.A.R.V.I.S — Luveni GM  |  components/jarvis/JarvisHub.tsx
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
  const [orbState, setOrbState]     = useState<OrbState>('idle');
  const [audioLevel, setAudioLevel] = useState(0);
  const [lastLine, setLastLine]     = useState('');
  // NEW: Track last AI response to kill echo loop
  const [lastAiResponse, setLastAiResponse] = useState('');
  const [isReady, setIsReady]       = useState(false);
  const [isLive, setIsLive]         = useState(false);

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
      setLastAiResponse(reply); // Update the Echo-Killer state
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
    lastAiResponse: lastAiResponse, // Pass the echo-killer here
    preventListening: orbState === 'speaking' || orbState === 'thinking',
  });

  // ... (Keep your existing useEffects for animation tick, autoStart, etc.)
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

  useEffect(() => {
    if (!lastLine) return;
    const t = setTimeout(() => setLastLine(''), 15000);
    return () => clearTimeout(t);
  }, [lastLine]);

  useEffect(() => {
    if (!autoStart) return;
    initializeJarvis();
  }, [autoStart]);

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
    if (containerRef.current && !document.fullscreenElement) {
      await containerRef.current.requestFullscreen().catch((err) => console.warn(err));
    }
  };

  // ... (Keep your existing display logic and return JSX)
  const displayLabel = (isReady && isLive && orbState === 'idle') ? STATE_LABEL['listening'] : STATE_LABEL[orbState];
  const displayColor = (isReady && isLive && orbState === 'idle') ? STATE_COLOR['listening'] : STATE_COLOR[orbState];
  const shadowColor = STATE_COLOR[orbState].replace('rgba(', '').replace(/,[^,]+\)$/, '');
  const shadowOpacity = 0.12 + audioLevel * 0.22;
  const shadowSize = 180 + audioLevel * 120;

  return (
    <div ref={containerRef} style={styles.root}>
      <style dangerouslySetInnerHTML={{ __html: `html, body { background-color: #020408 !important; }` }} />
      <div style={styles.orbWrap} onClick={initializeJarvis}>
        <NeuralOrb state={orbState} audioLevel={audioLevel} size={400} />
      </div>
      <div style={{ ...styles.stateLabel, color: displayColor }}>{displayLabel}</div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = { /* Keep your existing styles */ };
