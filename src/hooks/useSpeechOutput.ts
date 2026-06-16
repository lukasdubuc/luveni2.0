// ─────────────────────────────────────────────────────────────
//  J.A.R.V.I.S — Luveni GM | hooks/useSpeechOutput.ts
// ─────────────────────────────────────────────────────────────

import { useState, useCallback, useEffect, useRef } from 'react';

interface UseSpeechOutputOptions {
  onStart?: () => void;
  onBoundary?: (level: number) => void;
  onEnd?: () => void;
}

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

function detectMobileDevice() {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  return (
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

const globalActiveUtterances: SpeechSynthesisUtterance[] = [];

// Vite client-side security bridge: Support both VITE_ and standard env prefixes
const ELEVENLABS_API_KEY = 
  (typeof import.meta !== 'undefined' && (import.meta.env?.VITE_ELEVENLABS_API_KEY || import.meta.env?.ELEVENLABS_API_KEY)) || 
  (typeof process !== 'undefined' && (process.env?.VITE_ELEVENLABS_API_KEY || process.env?.ELEVENLABS_API_KEY)) || 
  '';

// Upgraded matching engine: prioritizes premium Siri and Enhanced system voices on Apple devices
function findBestVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  const isMobile = detectMobileDevice();
  
  // Look for British English first, then fallback to general English
  const gbVoices = voices.filter(v => {
    const lang = v.lang.toLowerCase().replace('_', '-');
    return lang.startsWith('en-gb');
  });

  const anyEnVoices = voices.filter(v => {
    const lang = v.lang.toLowerCase().replace('_', '-');
    return lang.startsWith('en');
  });

  const candidatePool = gbVoices.length > 0 ? gbVoices : anyEnVoices;
  if (candidatePool.length === 0) {
    return voices[0] || null;
  }

  // 1. Prioritize Siri and Enhanced quality system voices (crucial for macOS/iOS)
  const premiumKeywords = ['natural', 'siri', 'enhanced', 'premium'];
  for (const keyword of premiumKeywords) {
    const match = candidatePool.find(v => v.name.toLowerCase().includes(keyword));
    if (match) return match;
  }

  // 2. Fallback to British / Male names
  const maleKeywords = ['ryan', 'george', 'thomas', 'guy', 'daniel', 'arthur', 'oliver', 'harry', 'male'];
  for (const keyword of maleKeywords) {
    const match = candidatePool.find(v => v.name.toLowerCase().includes(keyword));
    if (match) return match;
  }

  return candidatePool[0];
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

/**
 * Clean and format text before speaking. Removes markdown tags, asterisks, 
 * links, and raw URLs so J.A.R.V.I.S. speaks in natural, fluid sentences.
 */
function sanitizeTextForSpeech(rawText: string): string {
  return rawText
    // Remove phonetic acronym spelling bugs
    .replace(/J\.A\.R\.V\.I\.S\.?/gi, "Jarvis")
    // Remove double asterisks (markdown bold)
    .replace(/\*\*/g, '')
    // Remove single asterisks (markdown italic or bullet points)
    .replace(/\*/g, '')
    // Remove markdown headers (e.g. # Header -> Header)
    .replace(/^#+\s+/gm, '')
    // Remove markdown link syntax [Display Text](https://url) -> just displays and speaks "Display Text"
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    // Remove inline code backticks
    .replace(/`/g, '')
    // Remove HTML tags if present
    .replace(/<[^>]*>/g, '')
    // Clean up empty lines or multiple consecutive spaces
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Splits text into small, readable chunks (max 150 characters) to target
 * approximately 2-3 display lines per visual subtitle.
 */
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

let voiceCache: SpeechSynthesisVoice | null | undefined = undefined;

export function useSpeechOutput({ onStart, onBoundary, onEnd }: UseSpeechOutputOptions = {}) {
  const [currentSubtitle, setCurrentSubtitle] = useState("");
  const [isMobile, setIsMobile] = useState(false);
  const onStartRef = useRef(onStart);
  const onBoundaryRef = useRef(onBoundary);
  const onEndRef = useRef(onEnd);

  const activeAudiosRef = useRef<HTMLAudioElement[]>([]);
  const audioIntervalRef = useRef<any>(null);
  
  // Keep track of scheduled timeouts to allow clean cancellation
  const speechTimeoutRef = useRef<any>(null);
  // Failsafe watchdog timer to prevent browser audio freezes
  const failsafeTimeoutRef = useRef<any>(null);
  // Keep track of active session ids to drop stale async callbacks
  const activeSessionId = useRef<number>(0);

  // Shared unlocked Audio context for iOS Safari async playback
  const unlockedAudioRef = useRef<HTMLAudioElement | null>(null);

  // Synchronous and stateful representation of active speech
  const speaking = useRef(false);
  const [isSpeakingState, setIsSpeakingState] = useState(false);

  const setSpeaking = (val: boolean) => {
    speaking.current = val;
    setIsSpeakingState(val);
  };

  useEffect(() => {
    onStartRef.current = onStart;
    onBoundaryRef.current = onBoundary;
    onEndRef.current = onEnd;
  }, [onStart, onBoundary, onEnd]);

  useEffect(() => {
    setIsMobile(detectMobileDevice());
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.speechSynthesis && voiceCache === undefined) {
      loadVoices().then(v => {
        voiceCache = findBestVoice(v);
      });
    }
  }, []);

  // AUTOMATIC AUDIO & SPEECH PRIMING (Autoplay Bypass)
  // Automatically primes the Web Audio, Speech synthesis, and HTML5 Audio engines on the page's very first interaction.
  useEffect(() => {
    if (typeof window === 'undefined') return;

    let unlocked = false;

    const unlock = () => {
      if (unlocked) return;
      try {
        // 1. Prime SpeechSynthesis with a quiet, real word ("ready").
        // Mobile browsers (specifically iOS Safari) reject volume=0 or empty-string utterances,
        // failing to wake up the physical hardware node. A low-volume, actual word forces it to wake.
        if (window.speechSynthesis) {
          const silentUtt = new SpeechSynthesisUtterance("ready");
          silentUtt.volume = 0.05; // extremely quiet but present
          silentUtt.rate = 1.0;
          
          const immediateVoices = window.speechSynthesis.getVoices();
          const voice = findBestVoice(immediateVoices);
          if (voice) {
            silentUtt.voice = voice;
            silentUtt.lang = voice.lang;
          } else {
            silentUtt.lang = 'en-GB';
          }
          
          window.speechSynthesis.speak(silentUtt);
        }

        // 2. Unlock HTML5 Audio context for iOS Safari asynchronous playback (ElevenLabs)
        const audio = new Audio();
        audio.src = "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA"; // short silent base64 wave
        audio.play().then(() => {
          audio.pause();
        }).catch((e) => {
          console.warn("[Speech Engine] Audio gesture unlock failed:", e);
        });
        unlockedAudioRef.current = audio;

        // 3. Unlock Web Audio Context if present in window
        const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtxClass) {
          const dummyContext = new AudioCtxClass();
          if (dummyContext.state === 'suspended') {
            dummyContext.resume();
          }
        }

        unlocked = true;

        // Cleanup event listeners immediately upon first trigger
        window.removeEventListener('click', unlock);
        window.removeEventListener('touchstart', unlock);
        window.removeEventListener('keydown', unlock);
      } catch (e) {
        console.warn("[Speech Engine] Failed to prime audio drivers:", e);
      }
    };

    window.addEventListener('click', unlock, { passive: true });
    window.addEventListener('touchstart', unlock, { passive: true });
    window.addEventListener('keydown', unlock, { passive: true });

    return () => {
      window.removeEventListener('click', unlock);
      window.removeEventListener('touchstart', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, []);

  const clearWatchdog = () => {
    if (failsafeTimeoutRef.current) {
      clearTimeout(failsafeTimeoutRef.current);
      failsafeTimeoutRef.current = null;
    }
  };

  const startWatchdog = (index: number, callback: () => void) => {
    clearWatchdog();
    // 8-second watchdog: if an utterance is stuck, automatically bypasses to keep context running
    failsafeTimeoutRef.current = setTimeout(() => {
      console.warn(`[Speech Engine] Watchdog activated: chunk ${index} timed out.`);
      callback();
    }, 8000);
  };

  const endSpeechCleanup = useCallback(() => {
    setSpeaking(false);
    setCurrentSubtitle("");
    if (onEndRef.current) {
      onEndRef.current();
    }
  }, []);

  const cancel = useCallback((isTransitioning = false) => {
    // Clear any pending speak delays immediately
    if (speechTimeoutRef.current) {
      clearTimeout(speechTimeoutRef.current);
      speechTimeoutRef.current = null;
    }

    clearWatchdog();

    // Invalidate the session ID so previous callback routines stop executing
    activeSessionId.current += 1;

    // Disconnect event handlers from previous utterances before canceling.
    // This blocks the browser's native cancel events from firing stale onerror/onend calls.
    globalActiveUtterances.forEach(utt => {
      utt.onstart = null;
      utt.onend = null;
      utt.onerror = null;
      utt.onboundary = null;
    });
    globalActiveUtterances.length = 0;

    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }

    activeAudiosRef.current.forEach(audio => {
      audio.pause();
      audio.currentTime = 0;
    });
    activeAudiosRef.current = [];

    if (audioIntervalRef.current) {
      clearInterval(audioIntervalRef.current);
      audioIntervalRef.current = null;
    }

    // Only set speaking to false if we are NOT transitioning to a new speech session!
    if (!isTransitioning) {
      setSpeaking(false);
      setCurrentSubtitle("");
      if (onEndRef.current) {
        onEndRef.current();
      }
    }
  }, []);

  const doSpeakNative = useCallback((text: string, voice: SpeechSynthesisVoice | null) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;

    const currentSession = activeSessionId.current;

    speechTimeoutRef.current = setTimeout(() => {
      if (currentSession !== activeSessionId.current) return;

      // Clean the incoming text of any markdown, links, or visual formatting artifacts
      const cleanText = sanitizeTextForSpeech(text);
      const chunks = chunkText(cleanText, 150);
      
      if (chunks.length === 0) {
        setSpeaking(false);
        setCurrentSubtitle("");
        if (onEndRef.current) {
          onEndRef.current();
        }
        return;
      }

      globalActiveUtterances.length = 0;

      const speakChunk = (index: number) => {
        if (currentSession !== activeSessionId.current) return;
        if (!speaking.current) return;
        
        if (index >= chunks.length) {
          setSpeaking(false);
          setCurrentSubtitle("");
          if (onEndRef.current) onEndRef.current();
          return;
        }

        const rawChunk = chunks[index].trim();
        if (!rawChunk) {
          speakChunk(index + 1);
          return;
        }

        const utt = new SpeechSynthesisUtterance(rawChunk);
        
        utt.rate = isMobile ? 1.0 : 0.93;
        utt.pitch = isMobile ? 1.0 : 0.78;
        
        // Strict Voice-Language Binding: Avoids iOS driver crashes due to mismatched voice properties
        if (activeVoice) {
          utt.voice = activeVoice;
          utt.lang = activeVoice.lang;
        } else {
          utt.lang = isMobile ? 'en-AU' : 'en-GB';
        }

        globalActiveUtterances.push(utt);

        utt.onstart = () => {
          if (currentSession !== activeSessionId.current) return;
          setCurrentSubtitle(rawChunk);
          
          // Reinforce active watchdog on actual successful speech startup
          startWatchdog(index, () => {
            if (currentSession !== activeSessionId.current) return;
            speakChunk(index + 1);
          });
        };

        utt.onboundary = () => {
          if (currentSession !== activeSessionId.current) return;
          if (onBoundaryRef.current) onBoundaryRef.current(0.3 + Math.random() * 0.55);
        };

        utt.onend = () => {
          if (currentSession !== activeSessionId.current) return;
          clearWatchdog();
          speakChunk(index + 1);
        };

        utt.onerror = () => {
          if (currentSession !== activeSessionId.current) return;
          clearWatchdog();
          speakChunk(index + 1); // Failsafe fallback
        };

        // Watchdog Activation: Start the 8-second watchdog synchronously BEFORE sending
        // the utterance to standard browser synthesis. This prevents iOS Safari from hanging
        // if it silently discards the speech request without dispatching native events.
        startWatchdog(index, () => {
          if (currentSession !== activeSessionId.current) return;
          speakChunk(index + 1);
        });

        window.speechSynthesis.speak(utt);
      };

      // Query voices live immediately before starting audio playback to bypass empty-list startup bugs
      let activeVoice = voice;
      if (!activeVoice) {
        const liveVoices = window.speechSynthesis.getVoices();
        activeVoice = findBestVoice(liveVoices);
        if (activeVoice) voiceCache = activeVoice;
      }

      speakChunk(0);
    }, 250); 
  }, [isMobile]);

  // ElevenLabs Engine (active if key is configured)
  const doSpeakElevenLabs = useCallback(async (text: string) => {
    const currentSession = activeSessionId.current;

    speechTimeoutRef.current = setTimeout(async () => {
      if (currentSession !== activeSessionId.current) return;

      // Clean the incoming text of any markdown, links, or visual formatting artifacts
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

        // Verify the session has not changed during the network delay
        if (currentSession !== activeSessionId.current) {
          audioUrls.forEach(url => URL.revokeObjectURL(url));
          return;
        }

        let currentIndex = 0;

        const playNext = () => {
          if (currentSession !== activeSessionId.current) return;

          if (!speaking.current || currentIndex >= audioUrls.length) {
            setSpeaking(false);
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

          // Workaround for Safari Mobile: reuse the audio context unlocked inside the user click gesture
          const audio = unlockedAudioRef.current || new Audio();
          if (!unlockedAudioRef.current) {
            unlockedAudioRef.current = audio;
          }

          audio.src = audioUrls[currentIndex];
          activeAudiosRef.current.push(audio);

          if (audioIntervalRef.current) clearInterval(audioIntervalRef.current);
          audioIntervalRef.current = setInterval(() => {
            if (currentSession !== activeSessionId.current) return;
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

          audio.play().catch((err) => {
            console.warn("[Speech Engine] Playback failed, bypassing chunk:", err);
            currentIndex++;
            playNext();
          });
        };

        playNext();

      } catch (error) {
        console.warn('[Speech Engine] ElevenLabs failed, falling back:', error);
        if (currentSession === activeSessionId.current) {
          doSpeakNative(text, voiceCache || null);
        }
      }
    }, 250);
  }, [doSpeakNative]);

  const speak = useCallback((text: string) => {
    // Synchronously declare start of active speech immediately.
    // This blocks speech recognition instantly on the main thread and closes the microphone 
    // before the 250ms asynchronous setup delays execute, preventing feedback cut-offs.
    const wasSpeaking = speaking.current;
    cancel(true);
    setSpeaking(true);
    if (!wasSpeaking && onStartRef.current) {
      onStartRef.current();
    }

    if (ELEVENLABS_API_KEY) {
      doSpeakElevenLabs(text);
      return;
    }

    // Force a fresh check of current browser voices every time speech is triggered
    const immediateVoices = typeof window !== 'undefined' && window.speechSynthesis 
      ? window.speechSynthesis.getVoices() 
      : [];
    
    const voice = findBestVoice(immediateVoices);
    if (voice) {
      voiceCache = voice;
    }

    doSpeakNative(text, voice);
  }, [cancel, doSpeakNative, doSpeakElevenLabs]);

  return { 
    speak, 
    cancel: () => cancel(false), // External triggers are treated as manual cancels
    isSpeaking: () => isSpeakingState, // Stateful return for seamless component synchronization
    currentSubtitle 
  };
}
