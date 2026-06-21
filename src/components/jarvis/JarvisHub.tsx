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
import VisualStage from './visual/VisualStage';
import type { VisualPayload } from './visual/types';

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

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

// Turn attachments into model-ready inputs: images become base64 data URLs
// (read by the vision model), text-ish files are inlined into the prompt.
async function readAttachments(atts: Attachment[]): Promise<{ images: string[]; fileText: string }> {
  const images: string[] = [];
  const texts: string[] = [];
  for (const a of atts) {
    if (a.kind === 'image') {
      try { images.push(await fileToDataUrl(a.file)); } catch { /* skip unreadable */ }
    } else if (a.file.type.startsWith('text/') || /\.(txt|md|csv|json|log|tsx?|jsx?|html?|css)$/i.test(a.name)) {
      try {
        const txt = await a.file.text();
        texts.push(`--- ${a.name} ---\n${txt.slice(0, 8000)}`);
      } catch { /* skip unreadable */ }
    }
  }
  return { images, fileText: texts.join('\n\n') };
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

  // Desktop-only visual stage ("Astra's screen").
  const [visual, setVisual] = useState<VisualPayload | null>(null);

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

  const handleFinalTranscript = useCallback(async (
    text: string,
    opts?: { images?: string[]; fileText?: string },
  ) => {
    if (isProcessingRef.current || !text) return;
    isProcessingRef.current = true;
    setInterimTranscript('');
    setUserQuery(text);
    changeOrbState('thinking');
    try {
      const { reply, visual: nextVisual } = await ask(text, opts);
      if (!reply) throw new Error('No response received');
      // Stage is desktop-only. A null visual closes any open stage; a new
      // one swaps it in. Mobile never opens it.
      setVisual(isMobile ? null : (nextVisual ?? null));
      respond(reply);
    } catch (err) {
      console.error('[Jarvis] Error:', err);
      const errorMessage = err instanceof Error ? err.message : 'System error, sir.';
      setLastAiResponse(errorMessage);
      if (!mutedRef.current) speak(errorMessage);
      changeOrbState('idle');
      isProcessingRef.current = false;
    }
  }, [ask, speak, changeOrbState, respond, isMobile]);

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
    if (morningBriefDoneRef.current) return;
    morningBriefDoneRef.current = true;
    try {
      if (localStorage.getItem('astra_brief_date') === new Date().toDateString()) return;
      const { isMorning, brief } = await morningBrief();
      if (!isMorning || !brief) return;
      localStorage.setItem('astra_brief_date', new Date().toDateString());
      setLastAiResponse(brief);
      changeOrbState('speaking');
      speak(cleanResponseForSpeech(brief));
    } catch (err) {
      console.error('[Jarvis] Morning brief error:', err);
    }
  }, [morningBrief, speak, changeOrbState]);

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

  const handleSubmit = useCallback(async () => {
    const text = inputValue.trim();
    const atts = attachments;
    if (!text && atts.length === 0) return;
    activateGestureTrust();
    unlockAudio();
    if (!isReady) setIsReady(true);
    setAttachments([]);
    setInputValue('');

    cancel();                        // interrupt any current speech
    isProcessingRef.current = false; // never let a stuck turn block text

    // Read images (→ vision) and text files (→ inline) before dispatching.
    let images: string[] = [];
    let fileText = '';
    if (atts.length) {
      const read = await readAttachments(atts);
      images = read.images;
      fileText = read.fileText;
    }
    atts.forEach((a) => URL.revokeObjectURL(a.url));

    const prompt =
      text ||
      (images.length ? 'Please take a look at this, sir.' : (fileText ? 'Please review this, sir.' : ''));
    if (prompt) handleFinalTranscript(prompt, { images, fileText });
  }, [inputValue, attachments, isReady, unlockAudio, cancel, handleFinalTranscript]);

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

  const orbSize = stageOpen ? 88 : (isMobile ? 260 : 360);
  const accent = STATE_ACCENT[orbState];
  const isBusy = orbState === 'thinking' || orbState === 'speaking';

  // Stage is desktop-only. When open, the whole hub shrinks into a live card
  // in the top-left; tapping the card closes the stage and restores center.
  const stageOpen = !isMobile && !!visual;

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
          background: `radial-gradient(circle 360px at 50% 44%, rgba(${accent}, 0.09) 0%, transparent 72%)`,
        }}
      />

      {/* Desktop visual stage ("Astra's screen") */}
      <AnimatePresence>
        {stageOpen && <VisualStage key="stage" visual={visual!} />}
      </AnimatePresence>

      {/* Hub. When the MacBook stage opens, Astra becomes a small orb that sits
          in the empty space to the LEFT of the laptop — never over it. */}
      <motion.div
        key={stageOpen ? 'astra-staged' : 'astra-full'}
        style={stageOpen ? S.hubStaged : S.hub}
        initial={stageOpen ? { opacity: 0, scale: 0.4 } : false}
        animate={stageOpen ? { opacity: 1, scale: 1, x: '-50%' } : { opacity: 1, scale: 1, x: 0 }}
        transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
        onClick={stageOpen ? () => setVisual(null) : undefined}
        title={stageOpen ? 'Return' : undefined}
      >
        <div style={stageOpen ? S.contentColStaged : { ...S.contentCol, pointerEvents: 'auto' }}>
          <div style={stageOpen ? S.orbWrapStaged : S.orbWrap}
               onClick={() => { if (!isReady) void initializeJarvis(); }}>
            <NeuralOrb state={orbState} audioLevel={audioLevel} size={orbSize} />
          </div>

          <div style={stageOpen ? S.transcriptWrapStaged : S.transcriptWrap}>
            <AnimatePresence mode="wait">
              {displayText && (
                <motion.div key={displayText}
                  initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.28 }}
                  style={stageOpen ? S.transcriptStaged : S.transcript}>
                  {displayText}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {!stageOpen && (
            <>
              <div style={{ ...S.stateLabel, color: `rgb(${accent})` }}>{STATE_LABEL[orbState]}</div>
              <JarvisInputBar
                value={inputValue} onChange={setInputValue} onSubmit={handleSubmit}
                attachments={attachments} onAttach={handleAttach} onRemove={handleRemoveAttachment}
                muted={muted} onToggleMute={handleToggleMute} disabled={isBusy}
                onFocus={() => { if (!isReady) void initializeJarvis(); }}
              />
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  root: {
    position: 'relative',
    height: '100dvh',
    minHeight: '100vh',
    width: '100%',
    overflow: 'hidden',
    boxSizing: 'border-box',
    background: 'var(--background)',
    color: 'var(--foreground)',
  },
  hub: {
    position: 'absolute', inset: 0, zIndex: 20,
    transformOrigin: 'left center',
    transition: 'background 0.4s ease, border-color 0.4s ease, box-shadow 0.4s ease',
  },
  hubStaged: {
    position: 'fixed',
    left: 'calc((100vw - min(76vw, 1200px)) / 4)', // centre of the gap left of the Mac
    top: '13vh',
    zIndex: 30, background: 'transparent', cursor: 'pointer',
  },
  // Card chrome applied while the stage is open (transform handled by framer).
  hubCard: {
    background: 'transparent',
    border: 'none',
    borderRadius: 0,
    boxShadow: 'none',
    overflow: 'visible',
    cursor: 'pointer',
  },
  contentCol: {
    position: 'absolute', inset: 0,
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'flex-end',
    boxSizing: 'border-box',
  },
  contentColStaged: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start',
    gap: 12, textAlign: 'center',
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
  orbWrapStaged: { display: 'flex', justifyContent: 'center', alignItems: 'center', cursor: 'pointer' },
  transcriptWrap: {
    width: '90%', maxWidth: 720, minHeight: 56, margin: '8px auto 4px',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    textAlign: 'center', zIndex: 10, flexShrink: 0, padding: '0 16px', boxSizing: 'border-box',
  },
  transcriptWrapStaged: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    maxWidth: 'calc((100vw - min(76vw, 1200px)) / 2 - 24px)',
  },
  transcript: {
    // Scales down on narrow phones so long greetings never overflow.
    color: 'var(--foreground)', fontSize: 'clamp(1rem, 4.2vw, 1.25rem)', lineHeight: 1.45,
    fontWeight: 300, textTransform: 'none', opacity: 0.92,
  },
  transcriptStaged: { color: 'var(--foreground)', fontSize: '0.92rem', lineHeight: 1.4, fontWeight: 300, opacity: 0.92 },
  stateLabel: {
    fontSize: 11, letterSpacing: '0.5rem', fontWeight: 400, textTransform: 'uppercase',
    marginBottom: 18, zIndex: 10, flexShrink: 0,
  },
};

export default JarvisHub;
