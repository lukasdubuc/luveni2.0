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
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    globalActiveUtterances.length = 0;
    speaking.current = false;
    setCurrentSubtitle(""); // Instantly clear subtitle on cancel
  }, []);

  const doSpeak = useCallback((text: string, voice: SpeechSynthesisVoice | null) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;

    cancel();

    // 250ms settling time allows hardware and browser sound pipelines to clear completely
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

        // Keep references alive in the global module array to bypass garbage collection issues
        globalActiveUtterances.push(utt);

        // Synchronize subtitle text dynamically with the exact start of playback
        utt.onstart = () => {
          setCurrentSubtitle(rawChunk);
        };

        utt.onboundary = () => {
          if (onBoundaryRef.current) onBoundaryRef.current(0.3 + Math.random() * 0.55);
        };

        // Handle the final speech element
        if (index === chunks.length - 1) {
          utt.onend = () => {
            globalActiveUtterances.length = 0;
            speaking.current = false;
            setCurrentSubtitle(""); // Instantly clear subtitles upon final completion
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

        // Queue natively into browser SpeechSynthesis
        window.speechSynthesis.speak(utt);
      });
    }, 250); 
  }, [cancel]);

  const speak = useCallback((text: string) => {
    if (isMobile) {
      doSpeak(text, null);
      return;
    }

    if (voiceCache !== undefined) {
      doSpeak(text, voiceCache);
    } else {
      const immediateVoices = window.speechSynthesis?.getVoices() || [];
      if (immediateVoices.length > 0) {
        voiceCache = findBestVoice(immediateVoices);
        doSpeak(text, voiceCache);
      } else {
        loadVoices().then(v => {
          voiceCache = findBestVoice(v);
          doSpeak(text, voiceCache);
        });
      }
    }
  }, [doSpeak]);

  return { 
    speak, 
    cancel, 
    isSpeaking: () => speaking.current,
    currentSubtitle 
  };
}
