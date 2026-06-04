// ─────────────────────────────────────────────────────────────
//  J.A.R.V.I.S — Luveni GM  |  hooks/useSpeechRecognition.ts
//  Noise-filtered speech-to-text hook
// ─────────────────────────────────────────────────────────────

import { useCallback, useEffect, useRef, useState } from 'react';

interface UseSpeechRecognitionOptions {
  onResult: (text: string) => void;
  onListeningStateChange?: (listening: boolean) => void;
  lang?: string;
}

export function useSpeechRecognition({
  onResult,
  onListeningStateChange,
  lang = 'en-US',
}: UseSpeechRecognitionOptions) {
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);
  const onResultRef = useRef(onResult);

  useEffect(() => {
    onResultRef.current = onResult;
  }, [onResult]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) return;

    const rec = new SpeechRecognition();
    rec.continuous = false; 
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.lang = lang;

    rec.onstart = () => {
      setIsListening(true);
      onListeningStateChange?.(true);
    };

    rec.onend = () => {
      setIsListening(false);
      onListeningStateChange?.(false);
    };

    rec.onresult = (event: any) => {
      const result = event.results[event.resultIndex];
      if (!result) return;

      const alternative = result[0];
      const transcript = alternative.transcript.trim();
      const confidence = alternative.confidence;

      // Noise Mitigation:
      // Increased length requirement and confidence threshold to 
      // filter out accidental background pops/clicks.
      if (transcript.length > 2 && confidence > 0.6) {
        onResultRef.current(transcript);
      }
    };

    rec.onerror = () => {
      setIsListening(false);
      onListeningStateChange?.(false);
    };

    recognitionRef.current = rec;
  }, [lang, onListeningStateChange]);

  const startListening = useCallback(() => {
    if (recognitionRef.current) {
      try { recognitionRef.current.start(); } catch (e) {}
    }
  }, []);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch (e) {}
    }
  }, []);

  return {
    startListening,
    stopListening,
    isListening,
    isSupported: !!recognitionRef.current,
  };
}
