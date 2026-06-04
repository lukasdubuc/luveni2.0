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
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const rafRef = useRef<number>(0);
  
  // Noise Gate Configuration
  const SILENCE_THRESHOLD = 0.12; // Increase this (e.g., to 0.2) if AC is still being heard

  const initAudio = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      analyzerRef.current = audioContextRef.current.createAnalyser();
      sourceRef.current = audioContextRef.current.createMediaStreamSource(stream);
      sourceRef.current.connect(analyzerRef.current);
      analyzerRef.current.fftSize = 256;

      const dataArray = new Uint8Array(analyzerRef.current.frequencyBinCount);
      const updateLevel = () => {
        analyzerRef.current?.getByteFrequencyData(dataArray);
        const sum = dataArray.reduce((a, b) => a + b, 0);
        const avg = sum / dataArray.length;
        const normalizedLevel = avg / 128;
        
        onLevelChange(normalizedLevel);
        rafRef.current = requestAnimationFrame(updateLevel);
      };
      updateLevel();
    } catch (e) {
      console.error('[VoiceInput] Audio error:', e);
    }
  }, [onLevelChange]);

  useEffect(() => {
    if (!enabled) {
      if (recognitionRef.current) recognitionRef.current.stop();
      return;
    }

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

      // Noise Gate: Check current volume level before processing
      // We check the last frame of audio data
      const dataArray = new Uint8Array(analyzerRef.current?.frequencyBinCount || 0);
      analyzerRef.current?.getByteFrequencyData(dataArray);
      const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
      const currentLevel = avg / 128;

      if (currentLevel < SILENCE_THRESHOLD) return;

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          onTranscript(event.results[i][0].transcript);
        }
      }
    };

    rec.onend = () => {
      onStateChange('idle');
      cancelAnimationFrame(rafRef.current);
      sourceRef.current?.disconnect();
      audioContextRef.current?.close();
    };

    rec.start();
    recognitionRef.current = rec;

    return () => {
      rec.stop();
      cancelAnimationFrame(rafRef.current);
      sourceRef.current?.disconnect();
      audioContextRef.current?.close();
    };
  }, [enabled, preventListening, onTranscript, onStateChange, initAudio]);
}
