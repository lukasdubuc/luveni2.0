// ─────────────────────────────────────────────────────────────
//  J.A.R.V.I.S — Luveni GM  |  hooks/useVoiceInput.ts
// ─────────────────────────────────────────────────────────────
//  Continuous VAD — no tap required after first mic grant.
//  Flow: silence → voice detected → SpeechRecognition → transcript
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
}

export function useVoiceInput({
  onTranscript,
  onStateChange,
  onLevelChange,
  vadThreshold = DEFAULT_VAD_THRESHOLD,
  silenceMs = DEFAULT_SILENCE_MS,
  enabled = true,
}: UseVoiceInputOptions) {
  const audioCtxRef   = useRef<AudioContext | null>(null);
  const analyserRef   = useRef<AnalyserNode | null>(null);
  const streamRef     = useRef<MediaStream | null>(null);
  const recogRef      = useRef<SpeechRecognition | null>(null);
  const silTimerRef   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stateRef      = useRef<OrbState>('idle');
  const bufferRef     = useRef<string>('');
  const rafRef        = useRef<number>(0);
  const activeRef     = useRef(false);

  const clearSilTimer = () => {
    if (silTimerRef.current) clearTimeout(silTimerRef.current);
    silTimerRef.current = null;
  };

  const setOrbState = useCallback(
    (s: OrbState) => {
      stateRef.current = s;
      onStateChange(s);
    },
    [onStateChange]
  );

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

    const SR =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;
    if (!SR) {
      setOrbState('error');
      return;
    }

    const recog: SpeechRecognition = new SR();
    recog.continuous = true;
    recog.interimResults = true;
    recog.lang = 'en-US';

    recog.onresult = (e: SpeechRecognitionEvent) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; ++i) {
        if (e.results[i].isFinal) {
          bufferRef.current += e.results[i][0].transcript;
        } else {
          interim += e.results[i][0].transcript;
        }
      }
    };

    recog.onerror = (e: any) => {
      console.error('[Jarvis] Speech Error:', e.error);
      if (e.error === 'not-allowed') setOrbState('error');
      else {
        stopRecognition();
        setOrbState('idle');
      }
    };

    recog.onend = () => {
      if (stateRef.current === 'listening') {
        const text = bufferRef.current.trim();
        bufferRef.current = '';
        if (text) onTranscript(text);
        setOrbState('idle');
      }
    };

    recogRef.current = recog;
    recog.start();
  }, [onTranscript, setOrbState, stopRecognition]);

  const initMic = useCallback(async () => {
    if (activeRef.current) return;
    activeRef.current = true;

    try {
      streamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      analyserRef.current = audioCtxRef.current.createAnalyser();
      analyserRef.current.fftSize = 512;
      analyserRef.current.smoothingTimeConstant = 0.5;
      
      audioCtxRef.current
        .createMediaStreamSource(streamRef.current)
        .connect(analyserRef.current);

      const data = new Uint8Array(analyserRef.current.frequencyBinCount);

      const tick = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(data);
        
        // Use a broader range for visual reactivity
        const avg = data.slice(0, 150).reduce((a, b) => a + b, 0) / 150;
        
        // Sensitive level mapping for 80,000 particles
        const level = Math.min(1, Math.max(0, (avg - 8) / 75));
        onLevelChange(level);

        if (avg > vadThreshold && stateRef.current === 'idle') {
          startRecognition();
        }

        if (avg > vadThreshold && stateRef.current === 'listening') {
          clearSilTimer();
        }

        if (
          avg <= vadThreshold &&
          stateRef.current === 'listening' &&
          !silTimerRef.current
        ) {
          silTimerRef.current = setTimeout(() => {
            stopRecognition();
          }, silenceMs);
        }

        rafRef.current = requestAnimationFrame(tick);
      };
      tick();
      setOrbState('idle');
    } catch (err) {
      console.error('[Jarvis] Mic Init Error:', err);
      setOrbState('error');
    }
  }, [onLevelChange, setOrbState, startRecognition, stopRecognition, vadThreshold, silenceMs]);

  useEffect(() => {
    if (!enabled) return;
    initMic();
    return () => {
      cancelAnimationFrame(rafRef.current);
      clearSilTimer();
      stopRecognition();
      streamRef.current?.getTracks().forEach((t) => t.stop());
      audioCtxRef.current?.close();
      activeRef.current = false;
    };
  }, [enabled, initMic, stopRecognition]);

  return { initMic };
}
