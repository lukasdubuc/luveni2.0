// ─────────────────────────────────────────────────────────────
//  J.A.R.V.I.S — Luveni GM  |  components/jarvis/JarvisHub.tsx
// ─────────────────────────────────────────────────────────────

import { useState, useCallback, useRef, useEffect } from 'react';
import NeuralOrb from './NeuralOrb';
import { useVoiceInput } from '../../hooks/useVoiceInput';
import { useSpeechOutput } from '../../hooks/useSpeechOutput';
import { useGemini } from '../../hooks/useGemini';
import type { OrbState } from '../../types/jarvis';
import { supabase } from "@/integrations/supabase/client";
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
  const [isReady, setIsReady]       = useState(false);
  const [isLive, setIsLive]         = useState(false);

  const containerRef    = useRef<HTMLDivElement>(null);
  const targetLevelRef  = useRef(0);
  const smoothLevelRef  = useRef(0);
  const stateTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const orbStateRef     = useRef(orbState);

  useEffect(() => { orbStateRef.current = orbState; }, [orbState]);

  useEffect(() => {
    if (!lastLine) return;
    const t = setTimeout(() => setLastLine(''), 15000);
    return () => clearTimeout(t);
  }, [lastLine]);

  // autoStart logic adjusted to trigger Live Mode
  useEffect(() => {
    if (!autoStart) return;
    warmUpMobileSpeech();
    setIsReady(true);
    setIsLive(true);
  }, [autoStart]);

  const { ask } = useGemini(geminiApiKey);

  const changeOrbState = useCallback((newState: OrbState) => {
    if (stateTimeoutRef.current) { clearTimeout(stateTimeoutRef.current); stateTimeoutRef.current = null; }
    if (newState === 'idle') {
      stateTimeoutRef.current = setTimeout(() => setOrbState('idle'), 750);
    } else {
      setOrbState(newState);
    }
  }, []);

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
    preventListening: orbState === 'speaking' || orbState === 'thinking',
  });

  const warmUpMobileSpeech = () => {
    try {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        const u = new SpeechSynthesisUtterance('');
        u.volume = 0;
        window.speechSynthesis.speak(u);
      }
    } catch (e) {}
  };

  const toggleLiveMode = async () => {
    warmUpMobileSpeech();
    setIsReady(true);
    if (!document.fullscreenElement) {
      await containerRef.current?.requestFullscreen().catch(() => {});
      setIsLive(true);
    } else {
      await document.exitFullscreen().catch(() => {});
      setIsLive(false);
    }
  };

  const displayLabel = (isReady && isLive && orbState === 'idle') ? STATE_LABEL['listening'] : STATE_LABEL[orbState];
  const displayColor = (isReady && isLive && orbState === 'idle') ? STATE_COLOR['listening'] : STATE_COLOR[orbState];

  const shadowColor = STATE_COLOR[orbState].replace('rgba(', '').replace(/,[^,]+\)$/, '');
  const shadowOpacity = 0.12 + audioLevel * 0.22;
  const shadowSize = 180 + audioLevel * 120;

  return (
    <div ref={containerRef} style={styles.root}>
      <style dangerouslySetInnerHTML={{ __html: `
        html, body { background-color: #020408 !important; margin: 0; padding: 0; }
        @media (min-width: 769px) { .jarvis-transcript { font-size: 12px !important; letter-spacing: 10px !important; } }
        @media (max-width: 768px) { .jarvis-transcript { font-size: 16px !important; letter-spacing: 1.5px !important; } }
        :fullscreen { background: #020408 !important; }
        :-webkit-full-screen { background: #020408 !important; }
      ` }} />

      <div style={styles.gridBg} />
      <div style={{
        ...styles.orbShadow,
        background: `radial-gradient(ellipse ${shadowSize}px ${shadowSize * 0.55}px at 50% 52%, rgba(${shadowColor},${shadowOpacity}) 0%, transparent 70%)`,
      }} />
      <div style={styles.scanlines} />

      <div style={{ ...styles.orbWrap, cursor: 'pointer' }} onClick={toggleLiveMode}>
        <NeuralOrb state={orbState} audioLevel={audioLevel} size={400} />
        <motion.div
          animate={{
            boxShadow: `0 0 ${100 + audioLevel * 200}px ${STATE_COLOR[orbState].replace(/,[^,]+\)$/, ',0.4)')}`,
            scale: 1.05 + audioLevel * 0.15
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
              className="jarvis-transcript"
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
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  root: {
    position: 'fixed',
    inset: 0,
    background: '#020408',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '20px',
    overflow: 'hidden',
    fontFamily: "'Courier New', Courier, monospace",
    color: '#fff',
    userSelect: 'none',
    zIndex: 9999,
  },
  gridBg: {
    position: 'absolute',
    inset: 0,
    backgroundImage: `
      linear-gradient(rgba(0,160,255,0.13) 1px, transparent 1px),
      linear-gradient(90deg, rgba(0,160,255,0.13) 1px, transparent 1px),
      linear-gradient(rgba(0,160,255,0.05) 1px, transparent 1px),
      linear-gradient(90deg, rgba(0,160,255,0.05) 1px, transparent 1px)
    `,
    backgroundSize: '40px 40px, 40px 40px, 10px 10px, 10px 10px',
    backgroundPosition: '0 0',
    imageRendering: 'pixelated' as const,
    pointerEvents: 'none',
    zIndex: 0,
  },
  orbShadow: {
    position: 'absolute',
    inset: 0,
    pointerEvents: 'none',
    zIndex: 1,
    transition: 'background 0.15s ease',
  },
  scanlines: {
    position: 'absolute',
    inset: 0,
    backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.04) 2px, rgba(0,0,0,0.04) 4px)',
    pointerEvents: 'none',
    zIndex: 2,
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
    color: '#fff',
    fontWeight: 'lighter',
    lineHeight: 1.6,
  },
};
