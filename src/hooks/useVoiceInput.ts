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
  enabled?: boolean;
}

export function useVoiceInput({
  onTranscript,
  onStateChange,
  onLevelChange,
  vadThreshold = DEFAULT_VAD_THRESHOLD,
  enabled = true,
}: UseVoiceInputOptions) {
  const onTranscriptRef = useRef(onTranscript);
  const onStateChangeRef = useRef(onStateChange);
  const onLevelChangeRef = useRef(onLevelChange);

  useEffect(() => {
    onTranscriptRef.current = onTranscript;
    onStateChangeRef.current = onStateChange;
    onLevelChangeRef.current = onLevelChange;
  }, [onTranscript, onStateChange, onLevelChange]);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recogRef = useRef<SpeechRecognition | null>(null);
  const stateRef = useRef<OrbState>('idle');
  const bufferRef = useRef<string>('');
  const rafRef = useRef<number>(0);

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
    if (!SR) return;

    const recog: SpeechRecognition = new SR();
    recog.continuous = true;
    recog.interimResults = false;
    recog.lang = 'en-US';

    recog.onresult = (e: SpeechRecognitionEvent) => {
      for (let i = e.resultIndex; i < e.results.length; ++i) {
        if (e.results[i].isFinal) bufferRef.current += e.results[i][0].transcript;
      }
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
  }, [setOrbState]);

  const initMic = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioContextClass();
      audioCtxRef.current = ctx;
      
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      ctx.createMediaStreamSource(stream).connect(analyser);
      analyserRef.current = analyser;

      const data = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(data);
        const avg = data.reduce((a, b) => a + b, 0) / data.length;
        onLevelChangeRef.current(Math.min(1, avg / 50));

        if (avg > vadThreshold && stateRef.current === 'idle') startRecognition();
        rafRef.current = requestAnimationFrame(tick);
      };
      tick();
      setOrbState('idle');
    } catch (err) {
      console.error("Mic init failed", err);
    }
  }, [startRecognition, setOrbState, vadThreshold]);

  useEffect(() => {
    if (!enabled) return;
    // Logic to resume on first user interaction
    const handleInteraction = () => {
      if (audioCtxRef.current?.state === 'suspended') audioCtxRef.current.resume();
      else if (!audioCtxRef.current) initMic();
    };
    window.addEventListener('click', handleInteraction, { once: true });
    return () => {
      window.removeEventListener('click', handleInteraction);
      cancelAnimationFrame(rafRef.current);
      stopRecognition();
      streamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, [enabled, initMic, stopRecognition]);

  return { initMic };
}
