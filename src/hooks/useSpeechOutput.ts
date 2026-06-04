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

// Exact voice names to target — order matters, first match wins
// Desktop Chrome/Edge:  "Google UK English Male"
// macOS Safari:         "Daniel" (com.apple.voice...daniel)
// iOS Safari:           "Daniel" — only male en-GB on iOS, always wins for en-GB locale
// Android Chrome:       "Google UK English Male"
// Windows Edge:         "Microsoft George" or "Microsoft Ryan"
const MALE_BRITISH_NAMES = [
  'Google UK English Male',
  'Daniel',
  'Microsoft George',
  'Microsoft Ryan',
  'Microsoft George - English (United Kingdom)',
];

// Fallback — any en-GB voice (iOS forces Daniel for en-GB regardless of name)
// Setting lang to en-GB on iOS guarantees Daniel plays
function findBestVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  // 1. Exact name match (desktop)
  for (const name of MALE_BRITISH_NAMES) {
    const v = voices.find(v => v.name === name);
    if (v) return v;
  }
  // 2. Any en-GB voice — on iOS this will be Daniel
  const enGB = voices.find(v => v.lang === 'en-GB');
  if (enGB) return enGB;
  // 3. Any English voice as last resort
  return voices.find(v => v.lang.startsWith('en')) ?? null;
}

// Returns voices via Promise — handles both sync (Firefox/Safari) and
// async (Chrome/mobile) loading correctly
function loadVoices(): Promise<SpeechSynthesisVoice[]> {
  return new Promise((resolve) => {
    const voices = speechSynthesis.getVoices();
    if (voices.length > 0) {
      resolve(voices);
      return;
    }
    // Voices not ready yet — wait for event
    const handler = () => {
      resolve(speechSynthesis.getVoices());
    };
    speechSynthesis.addEventListener('voiceschanged', handler, { once: true });
    // Safety timeout — 3s, then resolve with whatever is available
    setTimeout(() => resolve(speechSynthesis.getVoices()), 3000);
  });
}

let voiceCache: SpeechSynthesisVoice | null | undefined = undefined; // undefined = not yet resolved

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

  // Pre-warm voice resolution on mount
  useEffect(() => {
    if (voiceCache === undefined) {
      loadVoices().then(voices => {
        voiceCache = findBestVoice(voices);
      });
    }
  }, []);

  const doSpeak = useCallback((text: string, voice: SpeechSynthesisVoice | null) => {
    speechSynthesis.cancel();
    speaking.current = true;

    const utt = new SpeechSynthesisUtterance(text);
    utt.rate   = 0.93;
    utt.pitch  = 0.78;
    utt.volume = 1.0;

    if (voice) {
      utt.voice = voice;
    } else {
      // iOS fallback — set lang to en-GB, browser picks Daniel automatically
      utt.lang = 'en-GB';
    }

    utt.onstart    = () => onStartRef.current?.();
    utt.onboundary = () => onBoundaryRef.current?.(0.3 + Math.random() * 0.55);
    utt.onend = () => {
      speaking.current = false;
      onEndRef.current?.();
    };
    utt.onerror = () => {
      speaking.current = false;
      onEndRef.current?.();
    };

    speechSynthesis.speak(utt);
  }, []);

  const speak = useCallback((text: string) => {
    if (voiceCache !== undefined) {
      // Already resolved
      doSpeak(text, voiceCache);
    } else {
      // Still loading — resolve then speak
      loadVoices().then(voices => {
        voiceCache = findBestVoice(voices);
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
