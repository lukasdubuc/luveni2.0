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
  'Microsoft George - English (United Kingdom)',
];

function findBestVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  for (const name of MALE_BRITISH_NAMES) {
    const v = voices.find(v => v.name === name);
    if (v) return v;
  }
  const enGB = voices.find(v => v.lang === 'en-GB' || v.lang === 'en_GB');
  if (enGB) return enGB;
  return voices.find(v => v.lang.startsWith('en')) ?? null;
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
    const handler = () => {
      resolve(speechSynthesis.getVoices());
    };
    speechSynthesis.addEventListener('voiceschanged', handler, { once: true });
    setTimeout(() => resolve(speechSynthesis.getVoices()), 3000);
  });
}

let voiceCache: SpeechSynthesisVoice | null | undefined = undefined;

export function useSpeechOutput({
  onStart,
  onBoundary,
  onEnd,
}: UseSpeechOutputOptions = {}) {
  const speaking = useRef(false);
  const onStartRef   = useRef(onStart);
  const onBoundaryRef = useRef(onBoundary);
  const onEndRef     = useRef(onEnd);

  useEffect(() => {
    onStartRef.current   = onStart;
    onBoundaryRef.current = onBoundary;
    onEndRef.current     = onEnd;
  }, [onStart, onBoundary, onEnd]);

  // Pre-warm voice resolution on mount and setup automatic mobile engine unlock
  useEffect(() => {
    if (voiceCache === undefined) {
      loadVoices().then(voices => {
        voiceCache = findBestVoice(voices);
      });
    }

    // Unlocks browser audio contexts on mobile on first interaction
    const unlockMobileAudio = () => {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        const silentUtterance = new SpeechSynthesisUtterance('');
        silentUtterance.volume = 0;
        window.speechSynthesis.speak(silentUtterance);
        
        // Clean up listeners once unlocked
        window.removeEventListener('click', unlockMobileAudio);
        window.removeEventListener('touchstart', unlockMobileAudio);
      }
    };

    window.addEventListener('click', unlockMobileAudio);
    window.addEventListener('touchstart', unlockMobileAudio);

    return () => {
      window.removeEventListener('click', unlockMobileAudio);
      window.removeEventListener('touchstart', unlockMobileAudio);
    };
  }, []);

  const doSpeak = useCallback((text: string, voice: SpeechSynthesisVoice | null) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;

    // Do not call .cancel() immediately on mobile unless currently speaking
    // as it can silence the audio queue on WebKit browsers.
    if (speaking.current) {
      speechSynthesis.cancel();
    }
    
    speaking.current = true;

    const utt = new SpeechSynthesisUtterance(text);
    utt.rate   = 0.93;
    utt.pitch  = 0.78;
    utt.volume = 1.0;

    if (voice) {
      utt.voice = voice;
    } else {
      utt.lang = 'en-GB';
    }

    utt.onstart = () => {
      onStartRef.current?.();
    };
    
    utt.onboundary = () => {
      onBoundaryRef.current?.(0.3 + Math.random() * 0.55);
    };

    const handleSpeechEnded = () => {
      speaking.current = false;
      onEndRef.current?.();
    };

    utt.onend = handleSpeechEnded;
    utt.onerror = handleSpeechEnded;

    speechSynthesis.speak(utt);
  }, []);

  const speak = useCallback((text: string) => {
    if (voiceCache !== undefined) {
      doSpeak(text, voiceCache);
    } else {
      loadVoices().then(voices => {
        voiceCache = findBestVoice(voices);
        doSpeak(text, voiceCache);
      });
    }
  }, [doSpeak]);

  const cancel = useCallback(() => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      speechSynthesis.cancel();
      speaking.current = false;
    }
  }, []);

  return { speak, cancel, isSpeaking: () => speaking.current };
}
