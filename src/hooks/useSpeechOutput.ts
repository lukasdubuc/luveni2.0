// ─────────────────────────────────────────────────────────────
//  J.A.R.V.I.S — Luveni GM  |  hooks/useSpeechOutput.ts
//  Cross-platform voice — desktop + iOS + Android
//  Target: deep, calm, British male (closest to Iron Man JARVIS)
// ─────────────────────────────────────────────────────────────

import { useCallback, useEffect, useRef } from 'react';

interface UseSpeechOutputOptions {
  onStart?: () => void;
  onBoundary?: (level: number) => void;
  onEnd?: () => void;
}

// Ordered priority — first match wins
// Desktop Chrome/Edge: "Google UK English Male"
// macOS/iOS:           "Daniel" (British male, the closest to JARVIS)
// iOS fallback:        "Arthur" (British male Siri voice, iOS 15+)
// Android fallback:    "Google UK English Male" or any en-GB
// Last resort:         any English male, then any English
const VOICE_PRIORITY = [
  'google uk english male',
  'daniel',
  'arthur',
  'google uk english',
  'english united kingdom',
  'en-gb',
  'rishi',        // Indian English male, neutral — better than robot
  'google us english',
  'en-us',
];

let cachedVoice: SpeechSynthesisVoice | null = null;

function findVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  for (const hint of VOICE_PRIORITY) {
    const match = voices.find(
      (v) =>
        v.name.toLowerCase().includes(hint) ||
        v.lang.toLowerCase().replace('_', '-').includes(hint)
    );
    if (match) return match;
  }
  // Absolute fallback — any male-sounding English voice
  const enVoice = voices.find((v) => v.lang.toLowerCase().startsWith('en'));
  return enVoice ?? null;
}

function pickVoice(): SpeechSynthesisVoice | null {
  if (cachedVoice) return cachedVoice;
  const voices = speechSynthesis.getVoices();
  if (voices.length === 0) return null;
  cachedVoice = findVoice(voices);
  return cachedVoice;
}

export function useSpeechOutput({
  onStart,
  onBoundary,
  onEnd,
}: UseSpeechOutputOptions = {}) {
  const speaking = useRef(false);
  const pendingRef = useRef<string | null>(null);

  // Warm up voices on mount — critical for mobile where voices load async
  useEffect(() => {
    const warm = () => {
      cachedVoice = null; // reset so we re-evaluate with full list
      pickVoice();
    };
    speechSynthesis.addEventListener('voiceschanged', warm);
    warm(); // attempt immediately in case already loaded
    return () => speechSynthesis.removeEventListener('voiceschanged', warm);
  }, []);

  const doSpeak = useCallback(
    (text: string) => {
      speechSynthesis.cancel();
      speaking.current = true;

      const utt = new SpeechSynthesisUtterance(text);

      // JARVIS voice profile — deep, deliberate, calm
      utt.rate   = 0.93;  // slightly slower = more authoritative
      utt.pitch  = 0.78;  // lower = deeper, more masculine
      utt.volume = 1.0;

      const voice = pickVoice();
      if (voice) utt.voice = voice;

      utt.onstart = () => onStart?.();
      utt.onboundary = () => onBoundary?.(0.3 + Math.random() * 0.55);
      utt.onend = () => {
        speaking.current = false;
        pendingRef.current = null;
        onEnd?.();
      };
      utt.onerror = () => {
        speaking.current = false;
        pendingRef.current = null;
        onEnd?.();
      };

      speechSynthesis.speak(utt);
    },
    [onStart, onBoundary, onEnd]
  );

  const speak = useCallback(
    (text: string) => {
      const voices = speechSynthesis.getVoices();
      if (voices.length === 0) {
        // Mobile: voices not ready yet — wait for voiceschanged then speak
        pendingRef.current = text;
        const handler = () => {
          speechSynthesis.removeEventListener('voiceschanged', handler);
          if (pendingRef.current) {
            doSpeak(pendingRef.current);
            pendingRef.current = null;
          }
        };
        speechSynthesis.addEventListener('voiceschanged', handler);
        // Timeout safety — speak anyway after 1s even if voices never fires
        setTimeout(() => {
          if (pendingRef.current) {
            doSpeak(pendingRef.current);
            pendingRef.current = null;
          }
        }, 1000);
      } else {
        doSpeak(text);
      }
    },
    [doSpeak]
  );

  const cancel = useCallback(() => {
    speechSynthesis.cancel();
    speaking.current = false;
    pendingRef.current = null;
  }, []);

  return { speak, cancel, isSpeaking: () => speaking.current };
}
