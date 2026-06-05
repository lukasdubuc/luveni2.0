// ─────────────────────────────────────────────────────────────
//  J.A.R.V.I.S — Luveni GM | hooks/useSpeechOutput.ts
// ─────────────────────────────────────────────────────────────

import { useCallback, useEffect, useRef } from 'react';

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

// Universal mobile check
const isMobile = typeof window !== 'undefined' && 
  (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || 
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));

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

let voiceCache: SpeechSynthesisVoice | null | undefined = undefined;

export function useSpeechOutput({ onStart, onBoundary, onEnd }: UseSpeechOutputOptions = {}) {
  const speaking = useRef(false);
  const onStartRef = useRef(onStart);
  const onBoundaryRef = useRef(onBoundary);
  const onEndRef = useRef(onEnd);

  const activeUtterancesRef = useRef<SpeechSynthesisUtterance[]>([]);

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
    activeUtterancesRef.current = [];
    speaking.current = false;
  }, []);

  const doSpeak = useCallback((text: string, voice: SpeechSynthesisVoice | null) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;

    cancel();
    speaking.current = true;
    if (onStartRef.current) onStartRef.current();

    const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
    let currentIndex = 0;

    const playNext = () => {
      if (currentIndex >= sentences.length) {
        activeUtterancesRef.current = [];
        speaking.current = false;
        setTimeout(() => { if (onEndRef.current) onEndRef.current(); }, 300);
        return;
      }

      const rawSentence = sentences[currentIndex].trim();
      if (!rawSentence) {
        currentIndex++;
        playNext();
        return;
      }

      const utt = new SpeechSynthesisUtterance(rawSentence);
      
      // Standardize values on mobile devices to prevent native engine crashes
      utt.rate = isMobile ? 1.0 : 0.93;
      utt.pitch = isMobile ? 1.0 : 0.78;
      
      if (voice) utt.voice = voice;

      utt.onboundary = () => {
        if (onBoundaryRef.current) onBoundaryRef.current(0.3 + Math.random() * 0.55);
      };

      utt.onend = () => {
        currentIndex++;
        playNext();
      };

      utt.onerror = () => {
        currentIndex++;
        playNext();
      };

      activeUtterancesRef.current.push(utt);
      window.speechSynthesis.speak(utt);
    };

    playNext();
  }, [cancel]);

  const speak = useCallback((text: string) => {
    // Universal Mobile Fix: Instantly trigger synchronous speak with standard defaults.
    // This bypasses async loadVoices().then() blocks which mobile platforms prevent.
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

  return { speak, cancel, isSpeaking: () => speaking.current };
}
