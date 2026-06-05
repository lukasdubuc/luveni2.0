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

const isMobile = typeof window !== 'undefined' && 
  (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || 
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));

const globalActiveUtterances: SpeechSynthesisUtterance[] = [];

const ELEVENLABS_API_KEY = 
  (typeof import.meta !== 'undefined' && (import.meta.env?.ELEVENLABS_API_KEY || import.meta.env?.GOOGLE_API_KEY)) || 
  (typeof process !== 'undefined' && (process.env?.ELEVENLABS_API_KEY || process.env?.GOOGLE_API_KEY)) || 
  '';

// Upgraded matching engine: scans dynamically for your downloaded "Enhanced" or "Premium" iPhone accessibility voices
function findBestVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  if (isMobile) {
    // Look for high-quality English (Australian or British) voices on mobile
    const englishVoices = voices.filter(v => {
      const lang = v.lang.toLowerCase().replace('_', '-');
      return lang.startsWith('en-au') || lang.startsWith('en-gb');
    });

    if (englishVoices.length > 0) {
      // 1. Strictly prioritize any downloaded high-quality 'premium' or 'enhanced' voices first
      const qualityKeywords = ['premium', 'enhanced', 'natural', 'siri'];
      for (const keyword of qualityKeywords) {
        const match = englishVoices.find(v => v.name.toLowerCase().includes(keyword));
        if (match) return match;
      }

      // 2. Fallback to male voices
      const maleKeywords = ['ryan', 'george', 'thomas', 'guy', 'daniel', 'arthur', 'oliver', 'harry', 'male'];
      for (const keyword of maleKeywords) {
        const match = englishVoices.find(v => v.name.toLowerCase().includes(keyword));
        if (match) return match;
      }

      return englishVoices[0];
    }
  }

  // Standard Desktop / Fallback (British English)
  const gbVoices = voices.filter(v => {
    const lang = v.lang.toLowerCase().replace('_', '-');
    return lang.startsWith('en-gb');
  });

  if (gbVoices.length === 0) {
    return voices.find(v => v.lang.toLowerCase().startsWith('en-au')) ?? 
           voices.find(v => v.lang.toLowerCase().startsWith('en')) ?? 
           null;
  }

  // Prioritize high-quality voices on desktop
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

    speaking.current = false;
    setCurrentSubtitle(""); 
  }, []);

  const doSpeakNative = useCallback((text: string, voice: SpeechSynthesisVoice | null) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;

    cancel();

    // Query voices live immediately before starting audio playback to bypass empty-list startup bugs
    let activeVoice = voice;
    if (!activeVoice) {
      const liveVoices = window.speechSynthesis.getVoices();
      activeVoice = findBestVoice(liveVoices);
      if (activeVoice) voiceCache = activeVoice;
    }

    setTimeout(() => {
      speaking.current = true;
      if (onStartRef.current) onStartRef.current();

      // Clean the incoming text of any markdown, links, or visual formatting artifacts
      const cleanText = sanitizeTextForSpeech(text);
      const chunks = chunkText(cleanText, 150);
      
      globalActiveUtterances.length = 0;

      chunks.forEach((chunk, index) => {
        const rawChunk = chunk.trim();
        if (!rawChunk) return;

        const utt = new SpeechSynthesisUtterance(rawChunk);
        
        utt.rate = isMobile ? 1.0 : 0.93;
        utt.pitch = isMobile ? 1.0 : 0.78;
        
        // Match lang parameters to avoid mobile audio driver crashes
        utt.lang = activeVoice ? activeVoice.lang : (isMobile ? 'en-AU' : 'en-GB');
        if (activeVoice) utt.voice = activeVoice;

        globalActiveUtterances.push(utt);

        utt.onstart = () => {
          setCurrentSubtitle(rawChunk);
        };

        utt.onboundary = () => {
          if (onBoundaryRef.current) onBoundaryRef.current(0.3 + Math.random() * 0.55);
        };

        if (index === chunks.length - 1) {
          utt.onend = () => {
            globalActiveUtterances.length = 0;
            speaking.current = false;
            setCurrentSubtitle("");
            if (onEndRef.current) onEndRef.current();
          };
        }

        utt.onerror = () => {
          if (index === chunks.length - 1) {
            globalActiveUtterances.length = 0;
            speaking.current = false;
            setCurrentSubtitle("");
            if (onEndRef.current) onEndRef.current();
          }
        };

        window.speechSynthesis.speak(utt);
      });
    }, 250); 
  }, [cancel]);

  // ElevenLabs Engine (active if key is configured)
  const doSpeakElevenLabs = useCallback(async (text: string) => {
    cancel();

    setTimeout(async () => {
      speaking.current = true;
      if (onStartRef.current) onStartRef.current();

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

    // Force a fresh check of current browser voices every time speech is triggered
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
