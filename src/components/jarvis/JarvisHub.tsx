// ─────────────────────────────────────────────────────────────
//  J.A.R.V.I.S — Luveni GM | components/jarvis/JarvisHub.tsx
// ─────────────────────────────────────────────────────────────

import { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from "@/integrations/supabase/client";
import NeuralOrb from './NeuralOrb';

// ─────────────────────────────────────────────────────────────
//  TYPES & INTERFACES
// ─────────────────────────────────────────────────────────────
export type OrbState = 'idle' | 'listening' | 'thinking' | 'speaking' | 'error';

export interface JarvisMessage {
  role: 'user' | 'model';
  parts: { text: string }[];
  timestamp: number;
}

interface StoreSnapshot {
  revenue_today_cents: number;
  revenue_week_cents: number;
  revenue_month_cents: number;
  orders_total: number;
  orders_paid: number;
  orders_pending: number;
  orders_failed: number;
  leads_total: number;
  products_published: number;
  products_total: number;
  recent_orders: { email: string; amount_cents: number; status: string; created_at: string }[];
  top_products: { title: string; revenue: number; units: number }[];
}

interface UseGeminiOptions {
  googleToken?: string | null;
  storeSnapshot?: StoreSnapshot | null;
}

interface UseVoiceInputOptions {
  onInterim: (text: string) => void;
  onTranscript: (text: string) => void;
  onStateChange: (state: string) => void;
  onLevelChange: (level: number) => void;
  enabled: boolean;
  cancelSpeech: () => void;
}

interface UseSpeechOutputOptions {
  onStart?: () => void;
  onBoundary?: (level: number) => void;
  onEnd?: () => void;
}

// Minimal Web Speech API types (browser-only)
declare global {
  interface SpeechRecognition extends EventTarget {
    continuous: boolean;
    interimResults: boolean;
    lang: string;
    onresult: ((e: any) => void) | null;
    onerror: ((e: Event) => void) | null;
    onend: (() => void) | null;
    start(): void;
    stop(): void;
  }
}

// ─────────────────────────────────────────────────────────────
//  CONSTANTS & HELPER FUNCTIONS (Hoisted at Module Level)
// ─────────────────────────────────────────────────────────────

const STATE_LABEL: Record<OrbState, string> = {
  idle: 'STANDBY', listening: 'LISTENING', thinking: 'PROCESSING', speaking: 'RESPONDING', error: 'MIC ERROR',
};

const STATE_COLOR: Record<OrbState, string> = {
  idle: 'rgba(0,180,255,0.6)', listening: 'rgba(0,255,255,1.0)', thinking: 'rgba(180,100,255,1.0)', speaking: 'rgba(0,255,180,0.95)', error: 'rgba(255,80,80,1.0)',
};

const BRITISH_VOICES = [
  'Microsoft Ryan Online (Natural) - English (United Kingdom)',
  'Microsoft Sonia Online (Natural) - English (United Kingdom)',
  'Microsoft Thomas Online (Natural) - English (United Kingdom)',
  'Google UK English Male',
  'Google UK English Female',
  'Daniel',
  'Hazel',
  'Siri',
  'Microsoft Susan',
  'Microsoft George',
  'Microsoft Ryan',
];

const globalActiveUtterances: SpeechSynthesisUtterance[] = [];
let sharedAudioContext: AudioContext | null = null;
let voiceCache: SpeechSynthesisVoice | null | undefined = undefined;

const ELEVENLABS_API_KEY = 
  (typeof import.meta !== 'undefined' && (import.meta.env?.ELEVENLABS_API_KEY || import.meta.env?.GOOGLE_API_KEY)) || 
  (typeof process !== 'undefined' && (process.env?.ELEVENLABS_API_KEY || process.env?.GOOGLE_API_KEY)) || 
  '';

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

function sanitizeTextForSpeech(rawText: string): string {
  return rawText
    .replace(/J\.A\.R\.V\.I\.S\.?/gi, "Jarvis")
    .replace(/\*\*/g, '')
    .replace(/\*/g, '')
    .replace(/^#+\s+/gm, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/`/g, '')
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function chunkText(text: string, maxLength = 150): string[] {
  if (text.length <= maxLength) return [text];
  const chunks: string[] = [];
  let remaining = text;
  while (remaining.length > 0) {
    if (remaining.length <= maxLength) {
      chunks.push(remaining);
      break;
    }
    let splitIndex = -1;
    const breakPoints = ['. ', '! ', '? ', '; ', ', '];
    for (const punct of breakPoints) {
      const idx = remaining.lastIndexOf(punct, maxLength);
      if (idx > splitIndex) {
        splitIndex = idx + punct.length - 1;
      }
    }
    if (splitIndex === -1) {
      const idx = remaining.lastIndexOf(' ', maxLength);
      if (idx > 0) splitIndex = idx;
    }
    if (splitIndex === -1) {
      splitIndex = maxLength;
    }
    chunks.push(remaining.substring(0, splitIndex).trim());
    remaining = remaining.substring(splitIndex).trim();
  }
  return chunks.filter(Boolean);
}

function findBestVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  const isMobile = detectMobileDevice();
  if (isMobile) {
    const englishVoices = voices.filter(v => {
      const lang = v.lang.toLowerCase().replace('_', '-');
      return lang.startsWith('en-au') || lang.startsWith('en-gb');
    });
    if (englishVoices.length > 0) {
      const qualityKeywords = ['premium', 'enhanced', 'natural', 'siri'];
      for (const keyword of qualityKeywords) {
        const match = englishVoices.find(v => v.name.toLowerCase().includes(keyword));
        if (match) return match;
      }
      const maleKeywords = ['ryan', 'george', 'thomas', 'guy', 'daniel', 'arthur', 'oliver', 'harry', 'male'];
      for (const keyword of maleKeywords) {
        const match = englishVoices.find(v => v.name.toLowerCase().includes(keyword));
        if (match) return match;
      }
      return englishVoices[0];
    }
  }
  const gbVoices = voices.filter(v => {
    const lang = v.lang.toLowerCase().replace('_', '-');
    return lang.startsWith('en-gb');
  });
  if (gbVoices.length === 0) {
    return voices.find(v => v.lang.toLowerCase().startsWith('en-au')) ?? 
           voices.find(v => v.lang.toLowerCase().startsWith('en')) ?? 
           null;
  }
  const premiumDesktop = ['natural', 'premium', 'enhanced'];
  for (const keyword of premiumDesktop) {
    const match = gbVoices.find(v => v.name.toLowerCase().includes(keyword));
    if (match) return match;
  }
  const maleKeywords = ['ryan', 'george', 'thomas', 'guy', 'daniel', 'arthur', 'oliver', 'harry', 'male'];
  for (const keyword of maleKeywords) {
    const match = gbVoices.find(v => v.name.toLowerCase().includes(keyword));
    if (match) return match;
  }
  return gbVoices[0];
}

function loadVoices(): Promise<SpeechSynthesisVoice[]> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      resolve([]);
      return;
    }
    const voices = speechSynthesis.getVoices();
    if (voices.length > 0) {
      resolve(voices);
      return;
    }
    const handler = () => resolve(speechSynthesis.getVoices());
    speechSynthesis.addEventListener('voiceschanged', handler, { once: true });
    setTimeout(() => resolve(speechSynthesis.getVoices()), 1500);
  });
}

// ─────────────────────────────────────────────────────────────
//  INTEGRATED CUSTOM HOOKS
// ─────────────────────────────────────────────────────────────

function useGemini(options: UseGeminiOptions = {}) {
  const history = useRef<{ role: "user" | "assistant"; content: string }[]>([]);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const ask = useCallback(
    async (userText: string, onChunk?: (text: string) => void): Promise<string> => {
      const { googleToken, storeSnapshot } = optionsRef.current;
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
      history.current.push({ role: "user", content: userText });
      try {
        const { data, error } = await supabase.functions.invoke<{ reply?: string }>(
          "jarvis-brain",
          {
            body: {
              tool: "chat",
              args: {
                userText,
                history: history.current.slice(0, -1),
                storeSnapshot: storeSnapshot || null,
                googleToken: googleToken || null,
                timezone,
              },
            },
          },
        );
        if (error) throw error;
        const reply = data?.reply || "No response received.";
        history.current.push({ role: "assistant", content: reply });
        onChunk?.(reply);
        return reply;
      } catch (e) {
        const error = e instanceof Error ? e : new Error(String(e));
        console.error("[Jarvis] Edge function error:", error.message);
        throw error;
      }
    },
    [],
  );

  const reset = useCallback(() => {
    history.current = [];
  }, []);

  return { ask, reset };
}

function useVoiceInput({ 
  onInterim,
  onTranscript, 
  onStateChange, 
  onLevelChange, 
  enabled, 
  cancelSpeech
}: UseVoiceInputOptions) {
  const recognitionRef = useRef<any>(null);
  const restartTimeoutRef = useRef<any>(null);
  const enabledRef = useRef(enabled);

  useEffect(() => { enabledRef.current = enabled; }, [enabled]);

  const startRecognition = useCallback(() => {
    if (!enabledRef.current || recognitionRef.current) return;
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      onStateChange('error');
      return;
    }
    const rec = new SpeechRecognition();
    rec.continuous = true;
    rec.interimResults = true; 
    rec.lang = 'en-US';
    rec.onstart = () => {
      onStateChange('listening');
    };
    rec.onresult = (event: any) => {
      cancelSpeech();
      let interim = '';
      let final = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          final += event.results[i][0].transcript;
        } else {
          interim += event.results[i][0].transcript;
        }
      }
      onInterim(interim);
      if (final.trim()) {
        onTranscript(final.trim());
      }
    };
    rec.onend = () => {
      recognitionRef.current = null;
      if (enabledRef.current) {
        restartTimeoutRef.current = setTimeout(() => {
          if (enabledRef.current && !recognitionRef.current) {
            startRecognition();
          }
        }, 100);
      }
    };
    rec.onerror = (event: any) => {
        console.error("Speech recognition error", event.error);
        if (event.error === 'no-speech' || event.error === 'network') {
            // Recoverable
        } else {
            onStateChange('error');
        }
    };
    try { 
      rec.start(); 
      recognitionRef.current = rec; 
    } catch (e) { 
      console.error("Failed to start recognition", e);
      recognitionRef.current = null;
    }
  }, [onInterim, onTranscript, onStateChange, cancelSpeech]);

  useEffect(() => {
    if (enabled) {
      if (!recognitionRef.current) {
        startRecognition();
      }
    } else {
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch (e) {}
        recognitionRef.current = null;
      }
      if (restartTimeoutRef.current) clearTimeout(restartTimeoutRef.current);
    }
    return () => {
      if (restartTimeoutRef.current) clearTimeout(restartTimeoutRef.current);
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch (e) {}
        recognitionRef.current = null;
      }
    };
  }, [enabled, startRecognition]);

  return null;
}

function useSpeechOutput({ onStart, onBoundary, onEnd }: UseSpeechOutputOptions = {}) {
  const [currentSubtitle, setCurrentSubtitle] = useState("");
  const speaking = useRef(false);
  const onStartRef = useRef(onStart);
  const onBoundaryRef = useRef(onBoundary);
  const onEndRef = useRef(onEnd);
  const activeAudiosRef = useRef<HTMLAudioElement[]>([]);
  const audioIntervalRef = useRef<any>(null);

  useEffect(() => {
    onStartRef.current = onStart;
    onBoundaryRef.current = onBoundary;
    onEndRef.current = onEnd;
  }, [onStart, onBoundary, onEnd]);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.speechSynthesis && voiceCache === undefined) {
      loadVoices().then(v => {
        voiceCache = findBestVoice(v);
      });
    }
  }, []);
  
  const endSpeechCleanup = useCallback(() => {
    speaking.current = false;
    setCurrentSubtitle("");
    if (onEndRef.current) {
      onEndRef.current();
    }
  }, []);

  const cancel = useCallback(() => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    globalActiveUtterances.length = 0;
    activeAudiosRef.current.forEach(audio => {
      audio.pause();
      audio.currentTime = 0;
    });
    activeAudiosRef.current = [];
    if (audioIntervalRef.current) {
      clearInterval(audioIntervalRef.current);
      audioIntervalRef.current = null;
    }
    endSpeechCleanup();
  }, [endSpeechCleanup]);

  const doSpeakNative = useCallback((text: string, voice: SpeechSynthesisVoice | null) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    cancel();
    let activeVoice = voice;
    if (!activeVoice) {
      const liveVoices = window.speechSynthesis.getVoices();
      activeVoice = findBestVoice(liveVoices);
      if (activeVoice) voiceCache = activeVoice;
    }
    setTimeout(() => {
      speaking.current = true;
      if (onStartRef.current) onStartRef.current();
      const cleanText = sanitizeTextForSpeech(text);
      const chunks = chunkText(cleanText, 150);
      if (chunks.length === 0) {
        endSpeechCleanup();
        return;
      }
      globalActiveUtterances.length = 0;
      const speakChunk = (index: number) => {
        if (!speaking.current) return;
        if (index >= chunks.length) {
          endSpeechCleanup();
          return;
        }
        const rawChunk = chunks[index].trim();
        if (!rawChunk) {
          speakChunk(index + 1);
          return;
        }
        const utt = new SpeechSynthesisUtterance(rawChunk);
        const isMobile = detectMobileDevice();
        utt.rate = isMobile ? 1.0 : 0.93;
        utt.pitch = isMobile ? 1.0 : 0.78;
        utt.lang = activeVoice ? activeVoice.lang : (isMobile ? 'en-AU' : 'en-GB');
        if (activeVoice) utt.voice = activeVoice;
        globalActiveUtterances.push(utt);
        utt.onstart = () => {
          setCurrentSubtitle(rawChunk);
        };
        utt.onboundary = () => {
          if (onBoundaryRef.current) onBoundaryRef.current(0.3 + Math.random() * 0.55);
        };
        utt.onend = () => {
          speakChunk(index + 1);
        };
        utt.onerror = () => {
          speakChunk(index + 1);
        };
        window.speechSynthesis.speak(utt);
      };
      speakChunk(0);
    }, 250); 
  }, [cancel, endSpeechCleanup]);

  const doSpeakElevenLabs = useCallback(async (text: string) => {
    cancel();
    setTimeout(async () => {
      speaking.current = true;
      if (onStartRef.current) onStartRef.current();
      const cleanText = sanitizeTextForSpeech(text);
      const chunks = chunkText(cleanText, 150);
      try {
        const VOICE_ID = 'pNInz6obpgDQGcFbJwr1';
        const audioPromises = chunks.map(async (chunk) => {
          const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'xi-api-key': ELEVENLABS_API_KEY,
            },
            body: JSON.stringify({
              text: chunk,
              model_id: 'eleven_turbo_v2_5',
              voice_settings: {
                stability: 0.5,
                similarity_boost: 0.75,
              },
            }),
          });
          if (!response.ok) throw new Error(`ElevenLabs error: ${response.status}`);
          const blob = await response.blob();
          return URL.createObjectURL(blob);
        });
        const audioUrls = await Promise.all(audioPromises);
        let currentIndex = 0;
        const playNext = () => {
          if (!speaking.current || currentIndex >= audioUrls.length) {
            speaking.current = false;
            setCurrentSubtitle("");
            if (audioIntervalRef.current) {
              clearInterval(audioIntervalRef.current);
              audioIntervalRef.current = null;
            }
            if (onEndRef.current) onEndRef.current();
            return;
          }
          const rawChunk = chunks[currentIndex];
          setCurrentSubtitle(rawChunk);
          const audio = new Audio(audioUrls[currentIndex]);
          activeAudiosRef.current.push(audio);
          if (audioIntervalRef.current) clearInterval(audioIntervalRef.current);
          audioIntervalRef.current = setInterval(() => {
            if (onBoundaryRef.current && speaking.current) {
              onBoundaryRef.current(0.3 + Math.random() * 0.55);
            }
          }, 80);
          audio.onended = () => {
            URL.revokeObjectURL(audioUrls[currentIndex]);
            currentIndex++;
            playNext();
          };
          audio.onerror = () => {
            URL.revokeObjectURL(audioUrls[currentIndex]);
            currentIndex++;
            playNext();
          };
          audio.play().catch(() => {
            currentIndex++;
            playNext();
          });
        };
        playNext();
      } catch (error) {
        console.warn('[Speech Engine] ElevenLabs failed, falling back:', error);
        doSpeakNative(text, voiceCache || null);
      }
    }, 250);
  }, [cancel, doSpeakNative]);

  const speak = useCallback((text: string) => {
    if (ELEVENLABS_API_KEY) {
      doSpeakElevenLabs(text);
      return;
    }
    const immediateVoices = typeof window !== 'undefined' && window.speechSynthesis 
      ? window.speechSynthesis.getVoices() 
      : [];
    const voice = findBestVoice(immediateVoices);
    if (voice) {
      voiceCache = voice;
    }
    doSpeakNative(text, voice);
  }, [doSpeakNative, doSpeakElevenLabs]);

  return { 
    speak, 
    cancel, 
    isSpeaking: () => speaking.current,
    currentSubtitle 
  };
}

// ─────────────────────────────────────────────────────────────
//  MAIN COMPONENT: JARVISHUB
// ─────────────────────────────────────────────────────────────

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
  
  const { speak, cancel, currentSubtitle } = useSpeechOutput({
    onStart: () => changeOrbState('speaking'),
    onEnd: () => {
      if (orbStateRef.current === 'speaking') {
        changeOrbState('idle');
        setUserQuery('');
      }
    },
  });

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
    enabled: isReady && isLive && !isTextInputActive,
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
    } catch (e) { 
      console.error("[Jarvis] Audio context resume failed.", e); 
      setIsReady(true);
      setIsLive(true);
    }
  }, [isReady]);

  useEffect(() => { 
    if (autoStart && !isMobile) {
      // Direct call omitted to respect browser strict security policies.
    }
  }, [autoStart, isMobile]);

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

      <div style={styles.orbWrap}>
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
export type OrbState = 'idle' | 'listening' | 'thinking' | 'speaking' | 'error';

export interface JarvisMessage {
  role: 'user' | 'model';
  parts: { text: string }[];
  timestamp: number;
}
