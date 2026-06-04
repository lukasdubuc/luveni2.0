// ─────────────────────────────────────────────────────────────
//  J.A.R.V.I.S — Luveni GM  |  hooks/useVoiceInput.ts
// ─────────────────────────────────────────────────────────────

import { useEffect, useRef, useCallback } from 'react';

interface UseVoiceInputOptions {
  onTranscript: (text: string) => void;
  onStateChange: (state: string) => void;
  onLevelChange: (level: number) => void;
  enabled: boolean;
  preventListening?: boolean;
}

export function useVoiceInput({ 
  onTranscript, 
  onStateChange, 
  onLevelChange, 
  enabled, 
  preventListening 
}: UseVoiceInputOptions) {
  const recognitionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyzerRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number>(0);

  // Initialize Audio Context once and keep it alive
  const initAudio = useCallback(async () => {
    if (audioContextRef.current) return;
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtx();
      const analyzer = ctx.createAnalyser();
      const source = ctx.createMediaStreamSource(stream);
      source.connect(analyzer);
      analyzer.fftSize = 256;

      audioContextRef.current = ctx;
      analyzerRef.current = analyzer;

      const dataArray = new Uint8Array(analyzer.frequencyBinCount);
      const updateLevel = () => {
        analyzer.getByteFrequencyData(dataArray);
        const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
        onLevelChange(avg / 128);
        rafRef.current = requestAnimationFrame(updateLevel);
      };
      updateLevel();
    } catch (e) {
      console.error('[VoiceInput] Audio hardware access error:', e);
    }
  }, [onLevelChange]);

  const startRecognition = useCallback(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const rec = new SpeechRecognition();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = 'en-GB';

    rec.onstart = () => {
      onStateChange('listening');
      initAudio();
    };

    rec.onresult = (event: any) => {
      if (preventListening) return;
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) onTranscript(event.results[i][0].transcript);
      }
    };

    rec.onend = () => {
      onStateChange('idle');
      recognitionRef.current = null;
      // DO NOT close AudioContext here.
      if (enabled) {
        setTimeout(() => startRecognition(), 250);
      }
    };

    rec.onerror = (e: any) => {
      if (e.error !== 'no-speech') console.warn('[VoiceInput] Recognition error:', e.error);
    };

    try {
      rec.start();
      recognitionRef.current = rec;
    } catch (e) {
      console.warn('[VoiceInput] Start failed, likely already active.');
    }
  }, [onTranscript, onStateChange, initAudio, preventListening, enabled]);

  useEffect(() => {
    if (enabled) {
      startRecognition();
    } else {
      if (recognitionRef.current) recognitionRef.current.stop();
      cancelAnimationFrame(rafRef.current);
      // Clean up audio only on component unmount
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
    }

    return () => {
      if (recognitionRef.current) recognitionRef.current.stop();
      cancelAnimationFrame(rafRef.current);
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
    };
  }, [enabled, startRecognition]);

  return null;
}
