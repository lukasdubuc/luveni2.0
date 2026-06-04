// ─────────────────────────────────────────────────────────────
//  J.A.R.V.I.S — Luveni GM  |  hooks/useVoiceInput.ts
// ─────────────────────────────────────────────────────────────

import { useEffect, useRef, useCallback } from 'react';

// Singleton to ensure hardware is only grabbed once
let sharedAudioContext: AudioContext | null = null;

interface UseVoiceInputOptions {
  onTranscript: (text: string) => void;
  onStateChange: (state: string) => void;
  onLevelChange: (level: number) => void;
  enabled: boolean;
  isSpeaking: boolean; // Controls the "mute" logic during AI response
  preventListening?: boolean;
}

export function useVoiceInput({ 
  onTranscript, 
  onStateChange, 
  onLevelChange, 
  enabled, 
  isSpeaking,
  preventListening 
}: UseVoiceInputOptions) {
  const recognitionRef = useRef<any>(null);
  const lastSpeechEndTime = useRef(0);

  const initAudio = useCallback(async () => {
    if (sharedAudioContext) return;
    try {
      // AEC and Noise Suppression are critical for desktop loop prevention
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: { 
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true 
        } 
      });
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      sharedAudioContext = new AudioCtx();
      const analyzer = sharedAudioContext.createAnalyser();
      const source = sharedAudioContext.createMediaStreamSource(stream);
      source.connect(analyzer);
      analyzer.fftSize = 256;

      const dataArray = new Uint8Array(analyzer.frequencyBinCount);
      const updateLevel = () => {
        if (!analyzer) return;
        analyzer.getByteFrequencyData(dataArray);
        const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
        onLevelChange(avg / 128);
        requestAnimationFrame(updateLevel);
      };
      updateLevel();
    } catch (e) {
      console.error('[VoiceInput] Hardware access blocked:', e);
    }
  }, [onLevelChange]);

  const startRecognition = useCallback(() => {
    // If AI is speaking or already listening, do not restart
    if (isSpeaking || recognitionRef.current) return;

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const rec = new SpeechRecognition();
    rec.continuous = true;
    rec.interimResults = false; // Prevents "partial word" loops
    rec.lang = 'en-GB';

    rec.onstart = () => onStateChange('listening');

    rec.onresult = (event: any) => {
      // 1. HARD MUTE: Ignore if AI is speaking
      if (isSpeaking) return;

      // 2. BUFFER COOLDOWN: Ignore input for 1 second after AI finishes
      const now = Date.now();
      if (now - lastSpeechEndTime.current < 1000) return;

      if (preventListening) return;

      const transcript = event.results[event.results.length - 1][0].transcript;
      if (transcript.trim()) onTranscript(transcript);
    };

    rec.onend = () => {
      recognitionRef.current = null;
      onStateChange('idle');
      
      // Auto-restart loop
      if (enabled && !isSpeaking) {
        setTimeout(startRecognition, 100);
      }
    };

    try { 
      rec.start(); 
      recognitionRef.current = rec; 
    } catch (e) { 
      console.warn('[VoiceInput] Recognition start failed:', e); 
    }
  }, [onTranscript, onStateChange, preventListening, enabled, isSpeaking]);

  useEffect(() => {
    if (enabled && !isSpeaking) {
      initAudio().then(() => startRecognition());
    } else {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
        recognitionRef.current = null;
      }
      // If AI just finished speaking, set the timestamp for the cooldown
      if (isSpeaking) {
        lastSpeechEndTime.current = Date.now();
      }
    }
  }, [enabled, isSpeaking, startRecognition, initAudio]);

  return null;
}
