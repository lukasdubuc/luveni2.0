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

const ELEVENLABS_API_KEY = 
  (typeof import.meta !== 'undefined' && (import.meta.env?.VITE_ELEVENLABS_API_KEY || import.meta.env?.ELEVENLABS_API_KEY || import.meta.env?.GOOGLE_API_KEY)) || 
  (typeof process !== 'undefined' && (process.env?.VITE_ELEVENLABS_API_KEY || process.env?.ELEVENLABS_API_KEY || process.env?.GOOGLE_API_KEY)) || 
  '';

function findBestVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  const isMobile = detectMobileDevice();
  const isAppleDevice = typeof navigator !== 'undefined' && /mac|iphone|ipad|ipod/i.test(navigator.platform || navigator.userAgent);

  const candidatePool = voices.filter(v => {
    const lang = v.lang.toLowerCase().replace('_', '-');
    const isEn = lang.startsWith('en');
    if (isAppleDevice && v.name.toLowerCase().includes('google')) {
      return false;
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

  const cancel = useCallback((isTransitioning = false) => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      try {
        // Essential Mac browser fix: resume speech thread before canceling to unlock stale queues
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

  const doSpeakNative = useCallback((text: string, voice: SpeechSynthesisVoice | null) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;

    cancel(true); // Stop any active utterances securely without triggering premature onEnd mic openings

    let activeVoice = voice;
    if (!activeVoice) {
      const liveVoices = window.speechSynthesis.getVoices();
      activeVoice = findBestVoice(liveVoices);
      if (activeVoice) voiceCache = activeVoice;
    }

    setTimeout(() => {
      // Begin the session, but only set speaking state inside the actual browser execution hooks below
      speaking.current = true;

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
        
        utt.rate = isMobile ? 1.0 : 0.93;
        utt.pitch = isMobile ? 1.0 : 0.78;
        
        const isSafari = typeof navigator !== 'undefined' && /safari/i.test(navigator.userAgent) && !/chrome/i.test(navigator.userAgent);

        if (activeVoice && !isSafari) {
          utt.voice = activeVoice;
        }
        utt.lang = activeVoice ? activeVoice.lang : (isMobile ? 'en-AU' : 'en-GB');

        globalActiveUtterances.push(utt);

        // macOS Safeguard: If browser silences/queues speech due to gesture policy,
        // cancel the lock after 1.5 seconds so J.A.R.V.I.S. never freezes the UI.
        const failsafeTimeout = setTimeout(() => {
          if (speaking.current && !window.speechSynthesis.speaking) {
            console.warn("[Speech Output] Mac browser locked the speech queue. Releasing interface block.");
            endSpeechCleanup();
          }
        }, 1500);

        utt.onstart = () => {
          clearTimeout(failsafeTimeout);
          setCurrentSubtitle(rawChunk);
          if (onStartRef.current) onStartRef.current();
        };

        utt.onboundary = () => {
          if (onBoundaryRef.current) onBoundaryRef.current(0.3 + Math.random() * 0.55);
        };

        utt.onend = () => {
          clearTimeout(failsafeTimeout);
          speakChunk(index + 1);
        };

        utt.onerror = () => {
          clearTimeout(failsafeTimeout);
          speakChunk(index + 1);
        };

        try {
          window.speechSynthesis.speak(utt);
        } catch (e) {
          clearTimeout(failsafeTimeout);
          console.warn("[Speech Output] Synchronous speak error handled safely:", e);
          speakChunk(index + 1);
        }
      };

      speakChunk(0);
    }, 250); 
  }, [cancel, isMobile, endSpeechCleanup]);

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

    const immediateVoices = typeof window !== 'undefined' && window.speechSynthesis ? window.speechSynthesis.getVoices() : [];
    const voice = findBestVoice(immediateVoices);
    if (voice) {
      voiceCache = voice;
    }

    doSpeakNative(text, voice);
  }, [doSpeakNative, doSpeakElevenLabs]);

  return { speak, cancel, isSpeaking: () => speaking.current, currentSubtitle };
}
