// ─────────────────────────────────────────────────────────────
//  J.A.R.V.I.S — Luveni GM  |  hooks/useVoiceInput.ts
// ─────────────────────────────────────────────────────────────

import { useRef, useCallback, useEffect } from 'react';
import type { OrbState } from '../types/jarvis';
import { DEFAULT_VAD_THRESHOLD, DEFAULT_SILENCE_MS } from '../lib/jarvis-config';

interface UseVoiceInputOptions {
  onTranscript: (text: string) => void;
  onStateChange: (state: OrbState) => void;
  onLevelChange: (level: number) => void;
  vadThreshold?: number;
  silenceMs?: number;
  enabled?: boolean;
  preventListening?: boolean;
}

export function useVoiceInput({
  onTranscript,
  onStateChange,
  onLevelChange,
  vadThreshold = DEFAULT_VAD_THRESHOLD,
  silenceMs = DEFAULT_SILENCE_MS,
  enabled = true,
  preventListening = false,
}: UseVoiceInputOptions) {
  const onTranscriptRef = useRef(onTranscript);
  const onStateChangeRef = useRef(onStateChange);
  const onLevelChangeRef = useRef(onLevelChange);
  const preventListeningRef = useRef(preventListening);

  useEffect(() => {
    onTranscriptRef.current = onTranscript;
    onStateChangeRef.current = onStateChange;
    onLevelChangeRef.current = onLevelChange;
    preventListeningRef.current = preventListening;
  }, [onTranscript, onStateChange, onLevelChange, preventListening]);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recogRef = useRef<SpeechRecognition | null>(null);
  const stateRef = useRef<OrbState>('idle');
  const bufferRef = useRef<string>('');
  const rafRef = useRef<number>(0);
  const activeRef = useRef(false);

  const setOrbState = useCallback((s: OrbState) => {
    stateRef.current = s;
    onStateChangeRef.current(s);
  }, []);

  const stopRecognition = useCallback(() => {
    if (recogRef.current) {
      try { recogRef.current.stop(); } catch (_) {}
      recogRef.current = null;
    }
  }, []);

  const startRecognition = useCallback(() => {
    if (stateRef.current !== 'idle') return;
    setOrbState('listening');
    bufferRef.current = '';

    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      setOrbState('error');
      return;
    }

    const recog: SpeechRecognition = new SR();
    recog.continuous = true;
    recog.interimResults = false;
    recog.lang = 'en-US';

    recog.onresult = (e: SpeechRecognitionEvent) => {
      let finalTranscript = '';
      for (let i = e.resultIndex; i < e.results.length; ++i) {
        if (e.results[i].isFinal) {
          finalTranscript += e.results[i][0].transcript;
        }
      }
      if (finalTranscript) bufferRef.current = finalTranscript;
    };

    recog.onerror = () => {
      stopRecognition();
      setOrbState('idle');
    };

    recog.onend = () => {
      if (stateRef.current === 'listening') {
        const text = bufferRef.current.trim();
        bufferRef.current = '';
        if (text) onTranscriptRef.current(text);
        setOrbState('idle');
      }
    };

    recogRef.current = recog;
    recog.start();
  }, [setOrbState, stopRecognition]);

  const activateVoice = useCallback(async () => {
    if (audioCtxRef.current?.state === 'suspended') {
      await audioCtxRef.current.resume();
    }
    startRecognition();
  }, [startRecognition]);

  const initMic = useCallback(async () => {
    if (activeRef.current) return;
    activeRef.current = true;

    try {
      streamRef.current = await navigator.mediaDevices.getUserMedia({ 
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } 
      });
      
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      audioCtxRef.current = new AudioContextClass();
      analyserRef.current = audioCtxRef.current.createAnalyser();
      analyserRef.current.fftSize = 256;
      
      audioCtxRef.current.createMediaStreamSource(streamRef.current).connect(analyserRef.current);

      const data = new Uint8Array(analyserRef.current.frequencyBinCount);
      const tick = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(data);
        const avg = data.reduce((a, b) => a + b, 0) / data.length;
        
        onLevelChangeRef.current(Math.min(1, avg / 50));

        if (!preventListeningRef.current && avg > vadThreshold && stateRef.current === 'idle') {
          startRecognition();
        }
        rafRef.current = requestAnimationFrame(tick);
      };
      tick();
      setOrbState('idle');
    } catch (err) {
      setOrbState('error');
    }
  }, [setOrbState, startRecognition, vadThreshold]);

  useEffect(() => {
    if (!enabled) return;
    initMic();
    return () => {
      cancelAnimationFrame(rafRef.current);
      stopRecognition();
      streamRef.current?.getTracks().forEach((t) => t.stop());
      audioCtxRef.current?.close();
      activeRef.current = false;
    };
  }, [enabled, initMic, stopRecognition]);

  return { initMic, activateVoice };
}
