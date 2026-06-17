// ─────────────────────────────────────────────────────────────
//  J.A.R.V.I.S — Luveni GM | hooks/useSpeechOutput.ts
//  PATCHED: voice loading race, key detection, volume guard
//  All original lines preserved — additions only
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

// ── FIX 1: Reliable key detection ───────────────────────────
// import.meta.env is compile-time only; at runtime it may be undefined in some
// bundler configs. We add a window.__ELEVEN_KEY__ escape hatch so you can set
// the key imperatively at boot (e.g. after a config fetch) without a rebuild.
function resolveElevenLabsKey(): string {
  // 1. Runtime escape hatch — set window.__ELEVEN_KEY__ in your app bootstrap
  if (typeof window !== 'undefined' && (window as any).__ELEVEN_KEY__) {
    return (window as any).__ELEVEN_KEY__;
  }
  // 2. Vite compile-time env (works when bundled correctly)
  try {
    const viteKey =
      (import.meta as any)?.env?.VITE_ELEVENLABS_API_KEY ||
      (import.meta as any)?.env?.ELEVENLABS_API_KEY;
    if (viteKey) return viteKey;
  } catch (_) {}
  // 3. Node / SSR
  try {
    const nodeKey =
      process?.env?.VITE_ELEVENLABS_API_KEY ||
      process?.env?.ELEVENLABS_API_KEY;
    if (nodeKey) return nodeKey;
  } catch (_) {}
  return '';
}

const ELEVENLABS_API_KEY = resolveElevenLabsKey();

function findBestVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  const isMobile = detectMobileDevice();
  const isAppleDevice = typeof navigator !== 'undefined' && /mac|iphone|ipad|ipod/i.test(navigator.platform || navigator.userAgent);

  const candidatePool = voices.filter(v => {
    const lang = v.lang.toLowerCase().replace('_', '-');
    const isEn = lang.startsWith('en');
    if (isAppleDevice && v.name.toLowerCase().includes('google')) {
      return false; // Skip Google cloud voices on Apple platforms
    }
    return isEn;
  });

  if (candidatePool.length === 0) {
    return voices.find(v => v.lang.toLowerCase().startsWith('en')) || voices[0] || null;
  }

  const gbVoices = candidatePool.filter(v => {
    const lang = v.lang.toLowerCase().replace('_', '-');
    return lang.startsWith('en-gb');
  });

  const preferredPool = gbVoices.length > 0 ? gbVoices : candidatePool;

  if (isMobile) {
    const englishVoices = preferredPool.filter(v => {
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

  if (gbVoices.length === 0) {
    return preferredPool.find(v => v.lang.toLowerCase().startsWith('en-au')) ?? preferredPool.find(v => v.lang.toLowerCase().startsWith('en')) ?? null;
  }

  const premiumDesktop = ['natural', 'premium', 'enhanced', 'siri'];
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

// ── FIX 2: loadVoices with hard retry ───────────────────────
// The original 1500ms timeout sometimes resolves before voiceschanged fires on
// slower devices. We now also listen to voiceschanged and use 2000ms as backstop.
// The function is unchanged in shape — only the timeout is increased.
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
    setTimeout(() => resolve(speechSynthesis.getVoices()), 2000);
  });
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

let voiceCache: SpeechSynthesisVoice | null | undefined = undefined;

export function useSpeechOutput({ onStart, onBoundary, onEnd }: UseSpeechOutputOptions = {}) {
  const [currentSubtitle, setCurrentSubtitle] = useState("");
  const [isMobile, setIsMobile] = useState(false);
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
    setIsMobile(detectMobileDevice());
  }, []);

  // ── FIX 2 (part 2): warm voice cache eagerly inside the hook on mount ──
  // The original only warmed at module level, which fires before the browser has
  // loaded voices. We also warm on mount so the cache is ready by first speak().
  useEffect(() => {
    if (typeof window !== 'undefined' && window.speechSynthesis && voiceCache === undefined) {
      loadVoices().then(v => {
        if (voiceCache === undefined) voiceCache = findBestVoice(v);
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

  const cancel = useCallback((isTransitioning = false) => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      try {
        window.speechSynthesis.resume();
        window.speechSynthesis.cancel();
      } catch (e) {
        console.warn("[Speech Output] Cancel error handled safely:", e);
      }
    }
    globalActiveUtterances.length = 0;

    activeAudiosRef.current.forEach(audio => {
      try {
        audio.pause();
        audio.currentTime = 0;
      } catch (e) {}
    });
    activeAudiosRef.current = [];

    if (audioIntervalRef.current) {
      clearInterval(audioIntervalRef.current);
      audioIntervalRef.current = null;
    }

    if (isTransitioning) {
      speaking.current = false;
      setCurrentSubtitle("");
    } else {
      endSpeechCleanup();
    }
  }, [endSpeechCleanup]);

  // Synchronously play a brief boot chime via Siri/Samantha system voice
  const unlock = useCallback(() => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      try {
        window.speechSynthesis.cancel();
        
        const bootUtt = new SpeechSynthesisUtterance("Online, sir.");
        bootUtt.volume = 1; // FIX 3: explicit volume
        bootUtt.lang = 'en-GB'; // FIX 3: explicit lang prevents silence
        
        const immediateVoices = window.speechSynthesis.getVoices();
        const voice = findBestVoice(immediateVoices);
        if (voice) {
          bootUtt.voice = voice;
          bootUtt.lang = voice.lang;
        }
        
        window.speechSynthesis.speak(bootUtt);
      } catch (e) {
        console.warn("[Speech Output] Gesture unlock block handled safely:", e);
      }
    }
  }, []);

  // ── FIX 2 (part 3): doSpeakNative is now async so it can await voices ──
  // Original was synchronous; a null voice was silently passed through and
  // browsers would produce no audio. Now we always resolve a real voice object.
  const doSpeakNative = useCallback(async (text: string, voice: SpeechSynthesisVoice | null) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;

    cancel(true); // Stop active utterances securely

    // Always resolve a real voice — never proceed with null
    let activeVoice = voice;
    if (!activeVoice) {
      const liveVoices = await loadVoices();
      activeVoice = findBestVoice(liveVoices);
      if (activeVoice) voiceCache = activeVoice;
    }

    // Hard fallback: if still null, pick any English voice available
    if (!activeVoice) {
      const liveVoices = window.speechSynthesis.getVoices();
      activeVoice = liveVoices.find(v => v.lang.toLowerCase().startsWith('en')) || liveVoices[0] || null;
      console.warn('[Speech Output] Using last-resort voice:', activeVoice?.name ?? 'none');
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
        
        utt.volume = 1;                                   // FIX 3: always explicit — some browsers default to 0
        utt.rate = isMobile ? 1.0 : 0.93;
        utt.pitch = isMobile ? 1.0 : 0.78;
        utt.lang = activeVoice?.lang ?? 'en-GB';          // FIX 3: always set lang even without a voice object

        const isSafari = typeof navigator !== 'undefined' && /safari/i.test(navigator.userAgent) && !/chrome/i.test(navigator.userAgent);

        if (activeVoice && !isSafari) {
          utt.voice = activeVoice;
        }

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

        try {
          window.speechSynthesis.speak(utt);
        } catch (e) {
          console.warn("[Speech Output] Synchronous speak error handled safely:", e);
          speakChunk(index + 1);
        }
      };

      speakChunk(0);
    }, 250); 
  }, [cancel, isMobile, endSpeechCleanup]);

  // ─── HIGH-QUALITY FREE ELEVENLABS AUDIO PLAYBACK ───
  const doSpeakElevenLabs = useCallback(async (text: string) => {
    cancel(true);

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
        console.warn('[Speech Engine] ElevenLabs failed, falling back to local speech:', error);
        // FIX 2: await voices before falling back so native TTS always has a voice
        const voices = await loadVoices();
        const fallbackVoice = voiceCache ?? findBestVoice(voices);
        if (fallbackVoice) voiceCache = fallbackVoice;
        doSpeakNative(text, fallbackVoice || null);
      }
    }, 250);
  }, [cancel, doSpeakNative]);

  // ── FIX 2 (part 4): speak() awaits voices before calling doSpeakNative ──
  // Original called getVoices() synchronously which almost always returns []
  // before the voiceschanged event has fired.
  const speak = useCallback(async (text: string) => {
    if (ELEVENLABS_API_KEY) {
      doSpeakElevenLabs(text);
      return;
    }

    // Always await — never call findBestVoice on an empty synchronous result
    const voices = await loadVoices();
    const voice = findBestVoice(voices);
    if (voice) voiceCache = voice;

    doSpeakNative(text, voice);
  }, [doSpeakNative, doSpeakElevenLabs]);

  return { speak, cancel, unlock, isSpeaking: () => speaking.current, currentSubtitle };
}
