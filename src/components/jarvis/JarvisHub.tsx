// ─────────────────────────────────────────────────────────────
//  J.A.R.V.I.S — Luveni GM | components/jarvis/JarvisHub.tsx
// ─────────────────────────────────────────────────────────────

import { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGemini } from '@/hooks/useGemini';
import { useVoiceInput } from '@/hooks/useVoiceInput';
import { useSpeechOutput } from '@/hooks/useSpeechOutput';
import NeuralOrb from './NeuralOrb';

export type OrbState = 'idle' | 'listening' | 'thinking' | 'speaking' | 'error';

const STATE_LABEL: Record<OrbState, string> = {
  idle: 'STANDBY', listening: 'LISTENING', thinking: 'PROCESSING', speaking: 'RESPONDING', error: 'MIC ERROR',
};

const STATE_COLOR: Record<OrbState, string> = {
  idle: 'rgba(0,180,255,0.6)', listening: 'rgba(0,255,255,1.0)', thinking: 'rgba(180,100,255,1.0)', speaking: 'rgba(0,255,180,0.95)', error: 'rgba(255,80,80,1.0)',
};

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

const styles: Record<string, React.CSSProperties> = {
  root: {
    height: '100dvh',
    minHeight: '100vh',
    width: '100%', 
    display: 'flex', 
    flexDirection: 'column', 
    alignItems: 'center', 
    justifyContent: 'space-between', 
    padding: '20px', 
    boxSizing: 'border-box', 
    position: 'relative', 
    overflow: 'hidden' 
  },
  orbWrap: { 
    cursor: 'pointer', 
    display: 'flex', 
    justifyContent: 'center', 
    alignItems: 'center',
    flex: '1 1 auto', 
    maxHeight: '50vh', 
    zIndex: 5 
  },
  stateLabel: { 
    marginTop: 'auto', 
    marginBottom: '20px', 
    fontSize: '12px', 
    fontFamily: "'Inter', sans-serif", 
    letterSpacing: '0.6rem', 
    fontWeight: 300, 
    textTransform: 'uppercase', 
    zIndex: 10,
    flexShrink: 0
  },
  transcriptContainer: { 
    width: '90%', 
    maxWidth: '800px', 
    textAlign: 'center', 
    zIndex: 10, 
    margin: '20px auto',
    minHeight: '48px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0
  },
  transcript: { color: '#fff', fontSize: '1.4rem', fontFamily: "'Inter', sans-serif", lineHeight: 1.5, fontWeight: 300, cursor: 'pointer', opacity: 0.9 },
  textInput: {
    width: '100%',
    background: 'transparent',
    border: 'none',
    outline: 'none',
    color: '#fff',
    fontSize: '1.4rem',
    fontFamily: "'Inter', sans-serif",
    fontWeight: 300,
    textAlign: 'center',
    padding: '10px 0',
    boxSizing: 'border-box',
    borderBottom: '1px solid rgba(255, 255, 255, 0.15)',
    caretColor: 'rgba(0, 180, 255, 0.8)',
    resize: 'none',
    overflowY: 'hidden',
    minHeight: '40px',
    lineHeight: 1.5,
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
  orbShadow: { position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 1, transition: 'background 0.3s ease' }
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

export function JarvisHub({ autoStart }: { autoStart?: boolean }) {
  const [orbState, setOrbState] = useState<OrbState>('idle');
  const [userQuery, setUserQuery] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [lastAiResponse, setLastAiResponse] = useState('');
  const [isReady, setIsReady] = useState(false);
  const [isLive, setIsLive] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  const [isTextInputActive, setIsTextInputActive] = useState(false);
  const [textInputValue, setTextInputValue] = useState('');
  
  const stateTimeoutRef = useRef<any>(null);
  const orbStateRef = useRef(orbState);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const isProcessingRef = useRef(false);

  useEffect(() => { orbStateRef.current = orbState; }, [orbState]);
  useEffect(() => { setIsMobile(detectMobileDevice()); }, []);

  useEffect(() => {
    if (isTextInputActive && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.style.height = 'auto';
      inputRef.current.style.height = `${inputRef.current.scrollHeight}px`;
    }
  }, [isTextInputActive]);

  useEffect(() => {
    if (isMobile) return;
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      if (
        activeEl &&
        (activeEl.tagName === 'INPUT' ||
          activeEl.tagName === 'TEXTAREA' ||
          activeEl.getAttribute('contenteditable') === 'true')
      ) {
        return;
      }
      if (e.ctrlKey || e.metaKey || e.altKey || e.key === 'Escape' || e.key === 'Tab') {
        return;
      }
      if (e.key.length === 1 && !isTextInputActive) {
        if (e.key === ' ') {
          e.preventDefault();
        }
        setIsTextInputActive(true);
        setTextInputValue(e.key);
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [isTextInputActive, isMobile]);

  const { ask } = useGemini();

  const changeOrbState = useCallback((newState: OrbState) => {
    if (stateTimeoutRef.current) clearTimeout(stateTimeoutRef.current);
    setOrbState(newState);
  }, []);
  
  const { speak, cancel, unlock: unlockAudio, currentSubtitle } = useSpeechOutput({
    onStart: () => changeOrbState('speaking'),
    onEnd: () => {
      if (orbStateRef.current === 'speaking' || orbStateRef.current === 'thinking') {
        changeOrbState('idle');
        setUserQuery('');
        isProcessingRef.current = false;
      }
    },
  });

  const handleFinalTranscript = useCallback(async (text: string) => {
    if (isProcessingRef.current || !text) {
      return;
    }
    isProcessingRef.current = true;
    setInterimTranscript('');
    setUserQuery(text);
    changeOrbState('thinking');
    try {
      const reply = await ask(text);
      if (!reply) throw new Error("No response received");
      setLastAiResponse(reply);
      
      // CRITICAL SPEED FIX: Transition to 'speaking' immediately upon data resolution
      // so your text reply displays with 0 milliseconds of delay.
      changeOrbState('speaking');

      const cleanReply = cleanResponseForSpeech(reply);
      speak(cleanReply);
    } catch (err) {
      console.error('[Jarvis] Error:', err);
      const errorMessage = err instanceof Error ? err.message : "System error, sir.";
      setLastAiResponse(errorMessage);
      speak(errorMessage);
      changeOrbState('idle');
      isProcessingRef.current = false;
    }
  }, [ask, speak, changeOrbState]);

  useVoiceInput({
    onInterim: (text: string) => {
      if (isLive) setInterimTranscript(text);
    },
    onTranscript: (text: string) => { 
      if (isLive) {
        cancel();
        handleFinalTranscript(text);
      }
    },
    onStateChange: (s: string) => {
      if (!isLive) return;
      if (s === 'listening') { cancel(); }
      if ((s === 'idle' || s === 'listening') && (orbStateRef.current === 'speaking' || orbStateRef.current === 'thinking')) {
        return;
      }
      changeOrbState(s as OrbState);
    },
    onLevelChange: () => {},
    enabled: isReady && isLive && !isTextInputActive && (orbState === 'idle' || orbState === 'listening'),
    cancelSpeech: cancel
  });

  const initializeJarvis = useCallback(async () => {
    if (isReady) return;
    try {
      const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtx();
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }
      setIsReady(true);
      setIsLive(true);
      unlockAudio(); 
    } catch (e) { 
      console.error("[Jarvis] Audio context resume failed.", e); 
      setIsReady(true);
      setIsLive(true);
    }
  }, [isReady, unlockAudio]);

  useEffect(() => { 
    if (autoStart && !isMobile) {
      // Direct call omitted to respect browser strict security policies.
    }
  }, [autoStart, isMobile]);

  const handleOrbClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isReady) {
      initializeJarvis();
      return;
    }
    unlockAudio(); 
    setIsTextInputActive(false);
  };

  const handleContainerClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isReady) {
      initializeJarvis();
      return;
    }
    unlockAudio(); 
    if (orbState !== 'thinking' && orbState !== 'speaking') {
      setIsTextInputActive(true);
    }
  };

  const handleTextAreaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setTextInputValue(e.target.value);
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
      inputRef.current.style.height = `${inputRef.current.scrollHeight}px`;
    }
  };

  const submitCommand = (queryText: string) => {
    const query = queryText.trim();
    setIsTextInputActive(false);
    setTextInputValue('');
    if (query) {
      unlockAudio(); 
      handleFinalTranscript(query);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    submitCommand(textInputValue);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      e.currentTarget.blur();
      submitCommand(textInputValue);
    } else if (e.key === 'Escape') {
      setIsTextInputActive(false);
    }
  };

  const shadowColor = STATE_COLOR[orbState].replace('rgba(', '').replace(/,[^,]+\)$/, '');

  let displayText = '';
  if (orbState === 'thinking') {
    displayText = "Thinking...";
  } else if (orbState === 'speaking') {
    displayText = currentSubtitle || lastAiResponse;
  } else if (orbState === 'error') {
    displayText = "Microphone error. Ensure permissions are allowed or open this page directly in a new browser tab.";
  } else if (interimTranscript) {
    displayText = interimTranscript;
  } else if (lastAiResponse) {
    displayText = lastAiResponse;
  } else if (userQuery) {
    displayText = userQuery;
  } else if (isLive) {
    displayText = "Click or start speaking, sir...";
  } else {
    displayText = "Click to initialize J.A.R.V.I.S.";
  }

  const orbSize = isMobile ? 280 : 400;

  return (
    <div 
      style={styles.root} 
      onClick={!isReady ? initializeJarvis : undefined}
    >
      <style dangerouslySetInnerHTML={{ __html: `body { background-color: #020408 !important; margin: 0; overflow: hidden; }`}} />
      <div style={styles.gridBg} />
      <div style={{
        ...styles.orbShadow,
        background: `radial-gradient(circle 350px at 50% 50%, rgba(${shadowColor}, 0.12) 0%, transparent 100%)`,
      }} />
      
      <div style={{ flex: '0 0 40px' }} />

      <div style={styles.orbWrap} onClick={handleOrbClick}>
        <NeuralOrb state={orbState} audioLevel={0} size={orbSize} />
      </div>
      
      <div style={styles.transcriptContainer}>
        {isTextInputActive ? (
          <form style={{ width: '100%' }} onSubmit={handleFormSubmit}>
            <textarea
              ref={inputRef}
              value={textInputValue}
              onChange={handleTextAreaChange}
              onBlur={() => setIsTextInputActive(false)}
              onKeyDown={handleKeyDown}
              placeholder="Type your command, sir..."
              rows={1}
              style={styles.textInput}
            />
          </form>
        ) : (
          <div onClick={handleContainerClick} style={{ width: '100%' }}>
            <AnimatePresence mode="wait">
              {displayText && (
                <motion.div 
                  key={displayText} 
                  initial={{ opacity: 0, y: 5 }} 
                  animate={{ opacity: 1, y: 0 }} 
                  exit={{ opacity: 0, y: -5 }} 
                  style={styles.transcript}
                >
                  {displayText}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>

      <div style={{ ...styles.stateLabel, color: orbState === 'idle' && isLive ? STATE_COLOR['listening'] : STATE_COLOR[orbState] }}>
        {orbState === 'idle' && isLive ? STATE_LABEL['listening'] : STATE_LABEL[orbState]}
      </div>
    </div>
  );
}

export default JarvisHub;
