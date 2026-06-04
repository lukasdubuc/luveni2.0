// ─────────────────────────────────────────────────────────────
//  J.A.R.V.I.S — Luveni GM | hooks/useSpeechOutput.ts
// ─────────────────────────────────────────────────────────────

import { useCallback, useEffect, useRef } from 'react';

declare global {
  interface Window { 
    jarvisHeartbeat: NodeJS.Timeout | null; 
  }
}

interface UseSpeechOutputOptions {
  onStart?: () => void;
  onBoundary?: (level: number) => void;
  onEnd?: () => void;
}

const MALE_BRITISH_NAMES = [
  'Google UK English Male',
  'Daniel',
  'Microsoft George',
  'Microsoft Ryan',
];

function findBestVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  for (const name of MALE_BRITISH_NAMES) {
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
    setTimeout(() => resolve(speechSynthesis.getVoices()), 3000);
  });
}

let voiceCache: SpeechSynthesisVoice | null | undefined = undefined;

export function useSpeechOutput({ onStart, onBoundary, onEnd }: UseSpeechOutputOptions = {}) {
  const speaking = useRef(false);
  const onStartRef = useRef(onStart);
  const onBoundaryRef = useRef(onBoundary);
  const onEndRef = useRef(onEnd);

  useEffect(() => {
    onStartRef.current = onStart;
    onBoundaryRef.current = onBoundary;
    onEndRef.current = onEnd;
  }, [onStart, onBoundary, onEnd]);

  const doSpeak = useCallback((text: string, voice: SpeechSynthesisVoice | null) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;

    window.speechSynthesis.cancel();
    speaking.current = true;
    if (onStartRef.current) onStartRef.current();

    // Chunking: Split text by punctuation to stay under duration limits
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
    
    // Heartbeat: Prevent browser power-save from suspending the audio thread
    if (window.jarvisHeartbeat) clearInterval(window.jarvisHeartbeat);
    window.jarvisHeartbeat = setInterval(() => {
        window.speechSynthesis.pause();
        window.speechSynthesis.resume();
    }, 3000);

    sentences.forEach((s, index) => {
      const utt = new SpeechSynthesisUtterance(s.trim());
      utt.rate = 0.93;
      utt.pitch = 0.78;
      utt.voice = voice;
      
      utt.onboundary = () => { if (onBoundaryRef.current) onBoundaryRef.current(0.3 + Math.random() * 0.55); };

      if (index === sentences.length - 1) {
        utt.onend = () => {
          if (window.jarvisHeartbeat) clearInterval(window.jarvisHeartbeat);
          speaking.current = false;
          setTimeout(() => { if (onEndRef.current) onEndRef.current(); }, 500);
        };
        utt.onerror = utt.onend;
      }
      window.speechSynthesis.speak(utt);
    });
  }, []);

  const speak = useCallback((text: string) => {
    if (voiceCache !== undefined) {
      doSpeak(text, voiceCache);
    } else {
      loadVoices().then(v => {
        voiceCache = findBestVoice(v);
        doSpeak(text, voiceCache);
      });
    }
  }, [doSpeak]);

  const cancel = useCallback(() => {
    window.speechSynthesis.cancel();
    if (window.jarvisHeartbeat) clearInterval(window.jarvisHeartbeat);
    speaking.current = false;
  }, []);

  return { speak, cancel, isSpeaking: () => speaking.current };
}
