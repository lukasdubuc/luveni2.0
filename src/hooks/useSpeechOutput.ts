// ─────────────────────────────────────────────────────────────
//  J.A.R.V.I.S — Luveni GM  |  hooks/useSpeechOutput.ts
//  Cross-platform male British voice — desktop + iOS + Android
// ─────────────────────────────────────────────────────────────

import { useCallback, useEffect, useRef } from 'react';

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

    speechSynthesis.cancel();
    speaking.current = true;

    const utt = new SpeechSynthesisUtterance(text);
    utt.rate = 0.93;
    utt.pitch = 0.78;
    utt.voice = voice;

    utt.onstart = () => onStartRef.current?.();
    utt.onboundary = () => onBoundaryRef.current?.(0.3 + Math.random() * 0.55);
    
    const handleEnd = () => {
      speaking.current = false;
      onEndRef.current?.();
    };

    utt.onend = handleEnd;
    utt.onerror = handleEnd;

    speechSynthesis.speak(utt);
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
    speechSynthesis.cancel();
    speaking.current = false;
  }, []);

  return { speak, cancel, isSpeaking: () => speaking.current };
}
