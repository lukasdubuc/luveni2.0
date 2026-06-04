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
  const shouldRestart = useRef(false);

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
        if (!analyzerRef.current) return;
        analyzerRef.current.getByteFrequencyData(dataArray);
        const sum = dataArray.reduce((a, b) => a + b, 0);
        const avg = sum / dataArray.length;
        onLevelChange(avg / 128);
        rafRef.current = requestAnimationFrame(updateLevel);
      };
      updateLevel();
    } catch (e) {
      console.error('[VoiceInput] Audio init error:', e);
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
        if (event.results[i].isFinal) {
          onTranscript(event.results[i][0].transcript);
        }
      }
    };

    rec.onend = () => {
      // Logic for persistent listening:
      onStateChange('idle');
      cancelAnimationFrame(rafRef.current);
      if (sourceRef.current) sourceRef.current.disconnect();
      if (audioContextRef.current) audioContextRef.current.close();
      
      // Auto-restart if we are still "enabled"
      if (shouldRestart.current) {
        setTimeout(() => rec.start(), 100);
      }
    };

    rec.onerror = (e: any) => {
      console.warn('[VoiceInput] Error:', e.error);
      if (e.error === 'no-speech') return; // Ignore silence errors
    };

    rec.start();
    recognitionRef.current = rec;
  }, [onTranscript, onStateChange, initAudio, preventListening]);

  useEffect(() => {
    shouldRestart.current = enabled;
    if (enabled) {
      startRecognition();
    } else if (recognitionRef.current) {
      recognitionRef.current.stop();
    }

    return () => {
      shouldRestart.current = false;
      recognitionRef.current?.stop();
      cancelAnimationFrame(rafRef.current);
    };
  }, [enabled, startRecognition]);
}
