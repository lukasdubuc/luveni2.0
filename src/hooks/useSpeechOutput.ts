// ─────────────────────────────────────────────────────────────
//  J.A.R.V.I.S — Luveni GM  |  hooks/useSpeechOutput.ts
// ─────────────────────────────────────────────────────────────

import { useCallback, useRef } from 'react';

interface UseSpeechOutputOptions {
  onStart?: () => void;
  onBoundary?: (level: number) => void;
  onEnd?: () => void;
}

// Priority voice list — British male preference
const VOICE_PRIORITY = [
  'google uk english male',
  'daniel',
  'arthur',
  'british male',
  'en-gb',
];

function pickVoice(): SpeechSynthesisVoice | null {
  const voices = speechSynthesis.getVoices();
  for (const hint of VOICE_PRIORITY) {
    const v = voices.find((v) => v.name.toLowerCase().includes(hint) || v.lang.toLowerCase().includes(hint));
    if (v) return v;
  }
  return null;
}

export function useSpeechOutput({ onStart, onBoundary, onEnd }: UseSpeechOutputOptions = {}) {
  const speaking = useRef(false);

  // Pre-warm voice list
  useRef(() => { speechSynthesis.getVoices(); });

  const speak = useCallback(
    (text: string) => {
      speechSynthesis.cancel();
      speaking.current = true;

      const utt = new SpeechSynthesisUtterance(text);
      utt.rate = 1.0;
      utt.pitch = 0.82;
      utt.volume = 1.0;

      const voice = pickVoice();
      if (voice) utt.voice = voice;

      utt.onstart = () => onStart?.();
      utt.onboundary = () => {
        // Randomise level per word boundary for organic orb movement
        onBoundary?.(0.3 + Math.random() * 0.55);
      };
      utt.onend = () => {
        speaking.current = false;
        onEnd?.();
      };
      utt.onerror = () => {
        speaking.current = false;
        onEnd?.();
      };

      speechSynthesis.speak(utt);
    },
    [onStart, onBoundary, onEnd]
  );

  const cancel = useCallback(() => {
    speechSynthesis.cancel();
    speaking.current = false;
  }, []);

  return { speak, cancel, isSpeaking: () => speaking.current };
}
