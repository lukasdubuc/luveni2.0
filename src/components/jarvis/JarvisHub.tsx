// ─────────────────────────────────────────────────────────────
//  J.A.R.V.I.S — Luveni GM | components/jarvis/JarvisHub.tsx
//
//  Phase 1 overhaul: Perplexity-grade orb, an always-visible
//  theme-aware command bar (attach + mute/voice toggle), a clean
//  centred output area, and full light/dark theming driven by the
//  site's existing CSS-variable system (no more hardcoded dark).
// ─────────────────────────────────────────────────────────────

import { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGemini } from '@/hooks/useGemini';
import { useVoiceInput } from '@/hooks/useVoiceInput';
import { useSpeechOutput } from '@/hooks/useSpeechOutput';
import NeuralOrb from './NeuralOrb';
import JarvisInputBar, { type Attachment } from './JarvisInputBar';

export type OrbState = 'idle' | 'listening' | 'thinking' | 'speaking' | 'error';

const STATE_LABEL: Record<OrbState, string> = {
  idle: 'STANDBY', listening: 'LISTENING', thinking: 'PROCESSING', speaking: 'RESPONDING', error: 'MIC ERROR',
};

// Accent per state — used only for the soft glow + the state label, so it reads
// in both themes without fighting the theme background.
const STATE_ACCENT: Record<OrbState, string> = {
  idle: '90, 170, 255', listening: '60, 200, 255', thinking: '180, 110, 255', speaking: '60, 230, 170', error: '255, 90, 80',
};

function detectMobileDevice() {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  return (
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

function cleanResponseForSpeech(rawText: string): string {
  return rawText
    .replace(/\*\*/g, '')
    .replace(/\*/g, '')
    .replace(/`/g, '')
    .replace(/^#+\s+/gm, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

let gestureAudioCtx: AudioContext | null = null;
let gestureAudioEl: HTMLAudioElement | null = null;

const SILENT_WAV =
  'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQQAAAAAAA==';

function activateGestureTrust() {
  try {
    const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!gestureAudioCtx) gestureAudioCtx = new AudioCtx();
    if (gestureAudioCtx.state === 'suspended') gestureAudioCtx.resume();
    const buffer = gestureAudioCtx.createBuffer(1, 1, 22050);
    const source = gestureAudioCtx.createBufferSource();
    source.buffer = buffer;
    source.connect(gestureAudioCtx.destination);
    source.start(0);

    if (!gestureAudioEl) {
      gestureAudioEl = new Audio(SILENT_WAV);
      gestureAudioEl.volume = 0;
    }
    gestureAudioEl.currentTime = 0;
    gestureAudioEl.play().catch((e) => console.warn('[Jarvis] <audio> gesture unlock failed:', e));
  } catch (e) {
    console.warn('[Jarvis] Gesture trust activation failed silently:', e);
  }
}

export function JarvisHub({ autoStart }: { autoStart?: boolean }) {
  const [orbState, setOrbState] = useState<OrbState>('idle');
  const [userQuery, setUserQuery] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [lastAiResponse, setLastAiResponse] = useState('');
  const [isReady, setIsReady] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);

  // Text-only mode: mic off + no spoken replies. Voice mode is the default.
  const [muted, setMuted] = useState(false);

  // Command bar state.
  const [inputValue, setInputValue] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);

  const stateTimeoutRef = useRef<any>(null);
  const orbStateRef = useRef(orbState);
  const isProcessingRef = useRef(false);
  const mutedRef = useRef(muted);
  const localSpeakingRef = useRef(false);

  useEffect(() => { orbStateRef.current = orbState; }, [orbState]);
  useEffect(() => { mutedRef.current = muted; }, [muted]);
  useEffect(() => { setIsMobile(detectMobileDevice()); }, []);

  // Browser autoplay/mic policies forbid initialising audio without a user
  // gesture, so autoStart only marks intent — the first interaction wires it up.
  useEffect(() => { if (autoStart) { /* intentional no-op: gesture-gated */ } }, [autoStart]);

  // Revoke object URLs on unmount.
  useEffect(() => () => { attachments.forEach(a => URL.revokeObjectURL(a.url)); }, [attachments]);

  const { ask, morningBrief } = useGemini();
  const morningBriefDoneRef = useRef(false);

  const changeOrbState = useCallback((newState: OrbState) => {
    if (stateTimeoutRef.current) clearTimeout(stateTimeoutRef.current);
    setOrbState(newState);
  }, []);

  const { speak, cancel, unlock: unlockAudio, currentSubtitle } = useSpeechOutput({
    onStart: () => { localSpeakingRef.current = true; changeOrbState('speaking'); },
    onBoundary: (level) => setAudioLevel(level),
    onEnd: () => {
      localSpeakingRef.current = false;
      setAudioLevel(0);
      if (orbStateRef.current === 'speaking' || orbStateRef.current === 'thinking') {
        // Small debounce lets SpeechRecognition shut down cleanly before idle.
        setTimeout(() => {
          if (localSpeakingRef.current) return;
          changeOrbState('idle');
          setUserQuery('');
          isProcessingRef.current = false;
        }, 400);
      }
    },
  });

  // Either speak the reply, or (in text-only mode) just surface it and settle.
  const respond = useCallback((reply: string) => {
    setLastAiResponse(reply);
    if (mutedRef.current) {
      changeOrbState('idle');
      setUserQuery('');
      isProcessingRef.current = false;
      return;
    }
    changeOrbState('speaking');
    speak(cleanResponseForSpeech(reply));
  }, [changeOrbState, speak]);

  const handleFinalTranscript = useCallback(async (text: string) => {
    if (isProcessingRef.current || !text) return;
    isProcessingRef.current = true;
    setInterimTranscript('');
    setUserQuery(text);
    changeOrbState('thinking');
    try {
      const reply = await ask(text);
      if (!reply) throw new Error('No response received');
      respond(reply);
    } catch (err) {
      console.error('[Jarvis] Error:', err);
      const errorMessage = err instanceof Error ? err.message : 'System error, sir.';
      setLastAiResponse(errorMessage);
      if (!mutedRef.current) speak(errorMessage);
      changeOrbState('idle');
      isProcessingRef.current = false;
    }
  }, [ask, speak, changeOrbState, respond]);

  useVoiceInput({
    onInterim: (text: string) => { if (!mutedRef.current) setInterimTranscript(text); },
    onTranscript: (text: string) => {
      if (mutedRef.current) return;
      cancel();
      handleFinalTranscript(text);
    },
    onStateChange: (s: string) => {
      if (mutedRef.current) return;
      if (s === 'listening') cancel();
      if ((s === 'idle' || s === 'listening') && (orbStateRef.current === 'speaking' || orbStateRef.current === 'thinking')) return;
      changeOrbState(s as OrbState);
    },
    onLevelChange: () => {},
    enabled: isReady && !muted && (orbState === 'idle' || orbState === 'listening'),
    cancelSpeech: cancel,
  });

  // Fires once after audio is unlocked; the edge function decides if it's morning.
  const maybePlayMorningBrief = useCallback(async () => {
    if (morningBriefDoneRef.current || mutedRef.current) return;
    morningBriefDoneRef.current = true;
    try {
      const { isMorning, brief } = await morningBrief();
      if (!isMorning || !brief) return;
      respond(brief);
    } catch (err) {
      console.error('[Jarvis] Morning brief error:', err);
    }
  }, [morningBrief, respond]);

  const initializeJarvis = useCallback(async () => {
    if (isReady) return;
    activateGestureTrust();
    unlockAudio();
    try {
      const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtx();
      if (ctx.state === 'suspended') await ctx.resume();
    } catch (e) {
      console.error('[Jarvis] Audio context resume failed.', e);
    }
    setIsReady(true);
    void maybePlayMorningBrief();
  }, [isReady, unlockAudio, maybePlayMorningBrief]);

  // ── Command bar handlers ──
  const handleAttach = useCallback((files: FileList | null) => {
    if (!files?.length) return;
    const next: Attachment[] = Array.from(files).map((file) => ({
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      file,
      url: URL.createObjectURL(file),
      name: file.name,
      kind: file.type.startsWith('image/') ? 'image' : 'file',
    }));
    setAttachments((prev) => [...prev, ...next]);
  }, []);

  const handleRemoveAttachment = useCallback((id: string) => {
    setAttachments((prev) => {
      const target = prev.find((a) => a.id === id);
      if (target) URL.revokeObjectURL(target.url);
      return prev.filter((a) => a.id !== id);
    });
  }, []);

  const handleSubmit = useCallback(() => {
    const text = inputValue.trim();
    if (!text && attachments.length === 0) return;
    activateGestureTrust();
    unlockAudio();
    if (!isReady) setIsReady(true);

    // Phase 1: attachments are captured but not yet read by the brain.
    // Phase 1.5 wires vision here. Clear them so the seam stays clean.
    attachments.forEach((a) => URL.revokeObjectURL(a.url));
    setAttachments([]);
    setInputValue('');

    if (text) handleFinalTranscript(text);
  }, [inputValue, attachments, isReady, unlockAudio, handleFinalTranscript]);

  const handleToggleMute = useCallback(() => {
    setMuted((m) => {
      const next = !m;
      if (next) cancel();          // muting → stop any current speech
      else if (!isReady) void initializeJarvis(); // unmuting → ensure audio is live
      return next;
    });
  }, [cancel, isReady, initializeJarvis]);

  // ── Derived display ──
  let displayText = '';
  if (orbState === 'thinking') {
    displayText = 'Thinking…';
  } else if (orbState === 'speaking') {
    displayText = currentSubtitle || lastAiResponse;
  } else if (orbState === 'error') {
    displayText = 'Microphone error. Allow permissions or use text-only mode.';
  } else if (interimTranscript) {
    displayText = interimTranscript;
  } else if (lastAiResponse) {
    displayText = lastAiResponse;
  } else if (userQuery) {
    displayText = userQuery;
  } else if (isReady && !muted) {
    displayText = 'Listening, sir…';
  } else {
    displayText = 'Astra at your service, sir.';
  }

  const orbSize = isMobile ? 260 : 360;
  const accent = STATE_ACCENT[orbState];
  const isBusy = orbState === 'thinking' || orbState === 'speaking';

  return (
    <div className="admin-page" style={S.root}>
      {/* Theme-aware background: clean radial wash + faint grid that reads in
          both light and dark via the --background / --border variables. */}
      <div style={S.bgWash} />
      <div style={S.bgGrid} />
      {/* Soft accent glow behind the orb. */}
      <div
        style={{
          ...S.orbGlow,
          background: `radial-gradient(circle 420px at 50% 42%, rgba(${accent}, 0.16) 0%, transparent 70%)`,
        }}
      />

      {/* Orb */}
      <div
        style={S.orbWrap}
        onClick={() => { if (!isReady) void initializeJarvis(); }}
      >
        <NeuralOrb state={orbState} audioLevel={audioLevel} size={orbSize} />
      </div>

      {/* Output / transcript */}
      <div style={S.transcriptWrap}>
        <AnimatePresence mode="wait">
          {displayText && (
            <motion.div
              key={displayText}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.28 }}
              style={S.transcript}
            >
              {displayText}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* State label */}
      <div style={{ ...S.stateLabel, color: `rgb(${accent})` }}>
        {STATE_LABEL[orbState]}
      </div>

      {/* Command bar */}
      <JarvisInputBar
        value={inputValue}
        onChange={setInputValue}
        onSubmit={handleSubmit}
        attachments={attachments}
        onAttach={handleAttach}
        onRemove={handleRemoveAttachment}
        muted={muted}
        onToggleMute={handleToggleMute}
        disabled={isBusy}
        onFocus={() => { if (!isReady) void initializeJarvis(); }}
      />
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  root: {
    position: 'relative',
    height: '100dvh',
    minHeight: '100vh',
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'flex-end',
    overflow: 'hidden',
    boxSizing: 'border-box',
    background: 'var(--background)',
    color: 'var(--foreground)',
  },
  bgWash: {
    position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0,
    background:
      'radial-gradient(circle at 50% 35%, color-mix(in srgb, var(--foreground) 4%, transparent) 0%, transparent 60%), var(--background)',
  },
  bgGrid: {
    position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0,
    backgroundImage:
      'linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg, var(--border) 1px, transparent 1px)',
    backgroundSize: '46px 46px',
    opacity: 0.35,
    maskImage: 'radial-gradient(circle at 50% 42%, #000 0%, transparent 72%)',
    WebkitMaskImage: 'radial-gradient(circle at 50% 42%, #000 0%, transparent 72%)',
  },
  orbGlow: { position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 1, transition: 'background 0.4s ease' },
  orbWrap: {
    display: 'flex', justifyContent: 'center', alignItems: 'center',
    flex: '1 1 auto', minHeight: 0, marginTop: 24, zIndex: 5, cursor: 'pointer',
  },
  transcriptWrap: {
    width: '90%', maxWidth: 720, minHeight: 56, margin: '8px auto 4px',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    textAlign: 'center', zIndex: 10, flexShrink: 0, padding: '0 16px', boxSizing: 'border-box',
  },
  transcript: {
    color: 'var(--foreground)', fontSize: '1.25rem', lineHeight: 1.45, fontWeight: 300,
    textTransform: 'none', opacity: 0.92,
  },
  stateLabel: {
    fontSize: 11, letterSpacing: '0.5rem', fontWeight: 400, textTransform: 'uppercase',
    marginBottom: 18, zIndex: 10, flexShrink: 0,
  },
};

export default JarvisHub;
