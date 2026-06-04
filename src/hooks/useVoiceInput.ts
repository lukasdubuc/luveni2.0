// ─────────────────────────────────────────────────────────────
//  J.A.R.V.I.S — Luveni GM  |  hooks/useVoiceInput.ts
// ─────────────────────────────────────────────────────────────

import { useEffect, useRef, useCallback } from 'react';

// External singleton to ensure hardware is only grabbed once
let sharedAudioContext: AudioContext | null = null;

interface UseVoiceInputOptions {
  onTranscript: (text: string) => void;
  onStateChange: (state: string) => void;
  onLevelChange: (level: number) => void;
  enabled: boolean;
  preventListening?: boolean;
}

export function useVoiceInput({ 
  onTranscript, onStateChange, onLevelChange, enabled, preventListening 
}: UseVoiceInputOptions) {
  const recognitionRef = useRef<any>(null);

  const initAudio = useCallback(async () => {
    if (sharedAudioContext) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      sharedAudioContext = new AudioCtx();
      const analyzer = sharedAudioContext.createAnalyser();
      const source = sharedAudioContext.createMediaStreamSource(stream);
      source.connect(analyzer);
      analyzer.fftSize = 256;

      const dataArray = new Uint8Array(analyzer.frequencyBinCount);
      const updateLevel = () => {
        analyzer.getByteFrequencyData(dataArray);
        const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
        onLevelChange(avg / 128);
        requestAnimationFrame(updateLevel);
      };
      updateLevel();
    } catch (e) {
      console.error('[VoiceInput] Hardware block:', e);
    }
  }, [onLevelChange]);

  const startRecognition = useCallback(() => {
    if (recognitionRef.current) return;

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
      
      // PERSISTENCE FIX:
      // Only restart if the component is still mounted and enabled.
      // We add a shorter delay to ensure the mic stays captured.
      if (enabled) {
        // Use a 50ms delay for a "seamless" feel
        setTimeout(() => {
          if (enabled) startRecognition();
        }, 50);
      }
    };

    rec.onerror = () => {
      recognitionRef.current = null; // Force reset on error
    };

    try { rec.start(); recognitionRef.current = rec; } catch {}
  }, [onTranscript, onStateChange, initAudio, preventListening, enabled]);

  useEffect(() => {
    if (enabled) {
      startRecognition();
    } else if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    // Note: We do NOT close the AudioContext on unmount
    // to prevent InvalidStateError crashes.
  }, [enabled, startRecognition]);

  return null;
}
