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
  'Google UK English Female',
  'Google UK English Male',
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

// Resolves key from Lovable's database/secrets injection or standard environment configurations safely
const GOOGLE_API_KEY = 
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_GOOGLE_API_KEY) || 
  (typeof process !== 'undefined' && process.env?.VITE_GOOGLE_API_KEY) || 
  '';

function findBestVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  for (const name of BRITISH_VOICES) {
    const v = voices.find(v => v.name === name);
    if (v) return v;
  }
  return voices.find(v => v.lang.startsWith('en-GB')) ?? null;
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

  // References to track active Google TTS audio playbacks to allow absolute cancellation
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
    // 1. Clear native SpeechSynthesis fallback
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    globalActiveUtterances.length = 0;

    // 2. Stop and clear any ongoing Google TTS audio playback streams
    activeAudiosRef.current.forEach(audio => {
      audio.pause();
      audio.currentTime = 0;
    });
    activeAudiosRef.current = [];

    // 3. Clear simulated boundary visualizer timers
    if (audioIntervalRef.current) {
      clearInterval(audioIntervalRef.current);
      audioIntervalRef.current = null;
    }

    speaking.current = false;
    setCurrentSubtitle(""); // Instantly clear subtitle on cancel
  }, []);

  // Native SpeechSynthesis fallback core
  const doSpeakNative = useCallback((text: string, voice: SpeechSynthesisVoice | null) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;

    cancel();

    setTimeout(() => {
      speaking.current = true;
      if (onStartRef.current) onStartRef.current();

      const phoneticallyCleanText = text.replace(/J\.A\.R\.V\.I\.S\.?/gi, "Jarvis");
      const chunks = chunkText(phoneticallyCleanText, 150);
      
      globalActiveUtterances.length = 0;

      chunks.forEach((chunk, index) => {
        const rawChunk = chunk.trim();
        if (!rawChunk) return;

        const utt = new SpeechSynthesisUtterance(rawChunk);
        
        utt.rate = isMobile ? 1.0 : 0.93;
        utt.pitch = isMobile ? 1.0 : 0.78;
        
        if (voice) utt.voice = voice;

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

  // Google Cloud Text-to-Speech Engine integration
  const doSpeakGoogle = useCallback(async (text: string) => {
    cancel();

    setTimeout(async () => {
      speaking.current = true;
      if (onStartRef.current) onStartRef.current();

      const phoneticallyCleanText = text.replace(/J\.A\.R\.V\.I\.S\.?/gi, "Jarvis");
      const chunks = chunkText(phoneticallyCleanText, 150);

      try {
        // Fetch audio payloads for all chunks in parallel to prevent sound delays
        const audioPromises = chunks.map(async (chunk) => {
          const response = await fetch(`https://texttospeech.googleapis.com/v1/text:synthesize?key=${GOOGLE_API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              input: { text: chunk },
              voice: { languageCode: 'en-GB', name: 'en-GB-Neural2-B' },
              audioConfig: { audioEncoding: 'MP3' },
            }),
          });
          
          if (!response.ok) throw new Error(`Google TTS status code: ${response.status}`);
          const data = await response.json();
          return data.audioContent; // Base64 string payload
        });

        const base64Contents = await Promise.all(audioPromises);

        // Convert Base64 strings to memory Blob URLs
        const audioUrls = base64Contents.map(base64 => {
          const binaryString = window.atob(base64);
          const len = binaryString.length;
          const bytes = new Uint8Array(len);
          for (let i = 0; i < len; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          const blob = new Blob([bytes.buffer], { type: 'audio/mp3' });
          return URL.createObjectURL(blob);
        });

        // Play the compiled chunks sequentially to preserve subtitle timing
        let currentIndex = 0;

        const playNext = () => {
          if (!speaking.current || currentIndex >= audioUrls.length) {
            // Queue playback completed
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

          // Simulate speech boundary pulses to drive your orb visualizer organically
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
            // Autoplay safety bypass
            currentIndex++;
            playNext();
          });
        };

        playNext();

      } catch (error) {
        console.error('[Speech Engine] Google TTS generation failed, using native fallback:', error);
        // Fall back seamlessly to browser speech synthesis so the system never hangs
        doSpeakNative(text, voiceCache || null);
      }
    }, 250);
  }, [cancel, doSpeakNative]);

  const speak = useCallback((text: string) => {
    // If the Google Cloud Key is configured in Lovable's Database, prioritize it
    if (GOOGLE_API_KEY) {
      doSpeakGoogle(text);
      return;
    }

    // Default WebSpeech Fallback
    if (isMobile) {
      doSpeakNative(text, null);
      return;
    }

    if (voiceCache !== undefined) {
      doSpeakNative(text, voiceCache);
    } else {
      const immediateVoices = window.speechSynthesis?.getVoices() || [];
      if (immediateVoices.length > 0) {
        voiceCache = findBestVoice(immediateVoices);
        doSpeakNative(text, voiceCache);
      } else {
        loadVoices().then(v => {
          voiceCache = findBestVoice(v);
          doSpeakNative(text, voiceCache);
        });
      }
    }
  }, [doSpeakNative, doSpeakGoogle]);

  return { 
    speak, 
    cancel, 
    isSpeaking: () => speaking.current,
    currentSubtitle 
  };
}
