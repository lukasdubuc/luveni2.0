// ─────────────────────────────────────────────────────────────
//  J.A.R.V.I.S — Luveni GM | hooks/useVoiceInput.ts
// ─────────────────────────────────────────────────────────────

import { useEffect, useRef, useCallback } from 'react';

let sharedAudioContext: AudioContext | null = null;

interface UseVoiceInputOptions {
  onTranscript: (text: string) => void;
  onStateChange: (state: string) => void;
  onLevelChange: (level: number) => void;
  enabled: boolean;
  isSpeaking: boolean;
  preventListening?: boolean;
}

export function useVoiceInput({ 
  onTranscript, onStateChange, onLevelChange, enabled, isSpeaking, preventListening 
}: UseVoiceInputOptions) {
  const recognitionRef = useRef<any>(null);
  const lastSpeechEndTime = useRef(0);

  const initAudio = useCallback(async () => {
    if (sharedAudioContext) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true } });
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
    } catch (e) { console.error(e); }
  }, [onLevelChange]);

  const startRecognition = useCallback(() => {
    if (isSpeaking || recognitionRef.current) return;

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const rec = new SpeechRecognition();
    rec.continuous = true;
    rec.interimResults = true; // Set to true to catch inputs immediately
    rec.lang = 'en-GB';

    rec.onstart = () => onStateChange('listening');

    rec.onresult = (event: any) => {
      if (isSpeaking || preventListening) return;

      // FIX: Iterate from resultIndex to ensure we capture the latest input
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          const now = Date.now();
          if (now - lastSpeechEndTime.current < 1000) return;
          
          const transcript = event.results[i][0].transcript;
          if (transcript.trim()) onTranscript(transcript);
        }
      }
    };

    rec.onend = () => {
      recognitionRef.current = null;
      if (enabled && !isSpeaking) setTimeout(startRecognition, 100);
    };

    try { rec.start(); recognitionRef.current = rec; } catch (e) { console.warn(e); }
  }, [onTranscript, onStateChange, preventListening, enabled, isSpeaking]);

  useEffect(() => {
    if (enabled && !isSpeaking) {
      initAudio().then(() => startRecognition());
    } else if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
      if (isSpeaking) lastSpeechEndTime.current = Date.now();
    }
  }, [enabled, isSpeaking, startRecognition, initAudio]);

  return null;
}
