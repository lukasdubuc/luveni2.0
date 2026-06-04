// ─────────────────────────────────────────────────────────────
//  J.A.R.V.I.S — Luveni GM  |  hooks/useVoiceInput.ts
// ─────────────────────────────────────────────────────────────

import { useRef, useCallback, useEffect } from 'react';
import type { OrbState } from '../types/jarvis';
import { DEFAULT_VAD_THRESHOLD, DEFAULT_SILENCE_MS } from '../lib/jarvis-config';

// ... (Interface definitions remain the same) ...

export function useVoiceInput({
  onTranscript,
  onStateChange,
  onLevelChange,
  vadThreshold = DEFAULT_VAD_THRESHOLD,
  silenceMs = DEFAULT_SILENCE_MS,
  enabled = true,
  preventListening = false,
}: UseVoiceInputOptions) {
  // ... (Refs and State setup remain the same) ...

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
    recog.continuous = true; // Kept true for better mobile streaming
    recog.interimResults = false; // Set to false to reduce processing lag
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

    recog.onerror = (e: any) => {
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

  // NEW: Manual Activation Handler for Mobile
  const activateVoice = useCallback(async () => {
    if (audioCtxRef.current?.state === 'suspended') {
      await audioCtxRef.current.resume();
    }
    // Explicit trigger to start listening regardless of VAD
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
      analyserRef.current.fftSize = 256; // Reduced for faster processing
      
      audioCtxRef.current.createMediaStreamSource(streamRef.current).connect(analyserRef.current);

      const data = new Uint8Array(analyserRef.current.frequencyBinCount);
      const tick = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(data);
        const avg = data.reduce((a, b) => a + b, 0) / data.length;
        
        onLevelChangeRef.current(Math.min(1, avg / 50));

        // Auto-trigger only if not prevented
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

  // ... (useEffect for cleanup remains the same) ...

  return { initMic, activateVoice }; // Export activateVoice for your UI button
}
