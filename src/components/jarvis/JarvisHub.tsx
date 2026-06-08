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

function detectMobileDevice() {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  return (
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

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

/**
 * Removes markdown bold/italics, bullet marks, headers, and bracketed links
 * so that J.A.R.V.I.S. speaks in clear, conversational English and subtitles remain clean.
 */
function cleanResponseForSpeech(rawText: string): string {
  return rawText
    .replace(/\*\*/g, '') // Remove double asterisks (bold)
    .replace(/\*/g, '')   // Remove single asterisks (italics/bullets)
    .replace(/`/g, '')    // Remove backticks
    .replace(/^#+\s+/gm, '') // Remove headers
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Clean markdown links [text](url) -> text
    .replace(/\s+/g, ' ') // Clean double spaces
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

  // States for keyboard text command interaction
  const [isTextInputActive, setIsTextInputActive] = useState(false);
  const [textInputValue, setTextInputValue] = useState('');
  
  const stateTimeoutRef = useRef<any>(null);
  const orbStateRef = useRef(orbState);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { orbStateRef.current = orbState; }, [orbState]);
  useEffect(() => { setIsMobile(detectMobileDevice()); }, []);

  // Adjust and focus text area when initialized or changed
  useEffect(() => {
    if (isTextInputActive && inputRef.current) {
      inputRef.current.focus();
      // Ensure height is calculated correctly on first render
      inputRef.current.style.height = 'auto';
      inputRef.current.style.height = `${inputRef.current.scrollHeight}px`;
    }
  }, [isTextInputActive]);

  // INSTANT "JUST TYPE" INTERFACE (Desktop Web Only)
  useEffect(() => {
    if (isMobile) return; // Completely disabled on mobile to prevent virtual keyboard popups and layout bugs

    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is already typing in an input, textarea, or editable container
      const activeEl = document.activeElement;
      if (
        activeEl &&
        (activeEl.tagName === 'INPUT' ||
          activeEl.tagName === 'TEXTAREA' ||
          activeEl.getAttribute('contenteditable') === 'true')
      ) {
        return;
      }

      // Ignore command key modifications (Ctrl+C, Cmd+R, Alt, Escape, Tab, etc.)
      if (e.ctrlKey || e.metaKey || e.altKey || e.key === 'Escape' || e.key === 'Tab') {
        return;
      }

      // Capture single alphanumeric characters, symbols, or spacing inputs
      if (e.key.length === 1 && !isTextInputActive) {
        if (e.key === ' ') {
          e.preventDefault(); // Prevents page scrolling down on space keypress
        }
        
        setIsTextInputActive(true);
        setTextInputValue(e.key); // Inserts their first typed letter directly
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
  
  const handleFinalTranscript = useCallback(async (text: string) => {
    if (orbStateRef.current === 'thinking' || orbStateRef.current === 'speaking' || !text) {
      return;
    }
    
    setInterimTranscript('');
    setUserQuery(text);
    changeOrbState('thinking');
    
    try {
      const reply = await ask(text);
      if (!reply) throw new Error("No response received");
      setLastAiResponse(reply);
      
      const cleanReply = cleanResponseForSpeech(reply);
      speak(cleanReply);
    } catch (err) {
      console.error('[Jarvis] Error:', err);
      const errorMessage = "System error, sir.";
      setLastAiResponse(errorMessage);
      speak(errorMessage);
      changeOrbState('idle');
    }
  }, [ask, speak, changeOrbState]);
  
  // Binds the dynamically chunked visual subtitles
  const { speak, cancel, currentSubtitle } = useSpeechOutput({
    onStart: () => changeOrbState('speaking'),
    onEnd: () => {
      if (orbStateRef.current === 'speaking') {
        changeOrbState('idle');
        setUserQuery('');
      }
    },
  });

  // Stops microphone capture while typing commands
  useVoiceInput({
    onInterim: (text: string) => {
      if (isLive) setInterimTranscript(text);
    },
    onTranscript: (text: string) => { 
      if (isLive) {
        cancel(); // Interrupts any ongoing speech immediately
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
    enabled: isReady && isLive && !isTextInputActive,
    cancelSpeech: cancel
  });

  const initializeJarvis = useCallback(async () => {
    if (isReady) return;
    
    // Unlocks browser audio context. Must be tied to a user gesture.
    try {
      const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtx();
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }
      // This is a silent unlock, no speech needed.
      setIsReady(true);
      setIsLive(true);
      console.log("[Jarvis] Audio context unlocked. System is live.");
    } catch (e) { 
      console.error("[Jarvis] Audio context resume failed. This can happen if the user has not interacted with the page yet.", e); 
      // Still try to go live, some browsers are more permissive.
      setIsReady(true);
      setIsLive(true);
    }
  }, [isReady]);

  useEffect(() => { 
    if (autoStart && !isMobile) {
      // We don't call initializeJarvis directly to respect autoplay policies.
      // The UI will guide the user to click once.
    }
  }, [autoStart, isMobile]);

  // Handle opening text input when clicking the subtitle/placeholder block
  const handleContainerClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isReady) {
      initializeJarvis();
      return;
    }
    if (orbState !== 'thinking' && orbState !== 'speaking') {
      setIsTextInputActive(true);
    }
  };

  // Auto-grow height function for multiline textbox
  const handleTextAreaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setTextInputValue(e.target.value);
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
      inputRef.current.style.height = `${inputRef.current.scrollHeight}px`;
    }
  };

  // Central submission handler to avoid duplicate calls and race conditions
  const submitCommand = (queryText: string) => {
    const query = queryText.trim();
    setIsTextInputActive(false);
    setTextInputValue('');
    if (query) {
      handleFinalTranscript(query);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    submitCommand(textInputValue);
  };

  // Keyboard navigation listener (Enter submits, Shift+Enter makes newline)
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      e.currentTarget.blur(); // Dismisses mobile keyboard layout cleanly
      submitCommand(textInputValue);
    } else if (e.key === 'Escape') {
      setIsTextInputActive(false);
    }
  };

  const shadowColor = STATE_COLOR[orbState].replace('rgba(', '').replace(/,[^,]+\)$/, '');

  // Determine standard contextual visual string display
  let displayText = '';
  if (orbState === 'thinking') {
    displayText = "Thinking...";
  } else if (orbState === 'speaking') {
    displayText = currentSubtitle;
  } else if (interimTranscript) {
    displayText = interimTranscript;
  } else if (userQuery) {
    displayText = userQuery;
  } else if (isLive) {
    displayText = "Click or start speaking, sir...";
  } else {
    displayText = "Click to initialize J.A.R.V.I.S.";
  }

  // Adjust orb radius to cleanly support compact mobile viewports without overflowing
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
      
      {/* Dynamic space block at top of viewport layout */}
      <div style={{ flex: '0 0 40px' }} />

      {/* Center flex-grow wrapper for the visual core */}
      <div style={styles.orbWrap}>
        <NeuralOrb state={orbState} audioLevel={0} size={orbSize} />
      </div>
      
      {/* Standard document-flow container to naturally stack text/inputs below the orb */}
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
    maxHeight: '50vh', // Keeps visual footprint bounded
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
  
  // Repositioned out of position: absolute to flow naturally and prevent obstruction
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

export default JarvisHub;
