// ─────────────────────────────────────────────────────────────
//  J.A.R.V.I.S — Luveni GM | hooks/useVoiceInput.ts
// ─────────────────────────────────────────────────────────────

import { useEffect, useRef, useCallback } from 'react';

let sharedAudioContext: AudioContext | null = null;

export function useVoiceInput({ 
  onTranscript, onStateChange, onLevelChange, enabled, isSpeaking, preventListening 
}: any) {
  const recognitionRef = useRef<any>(null);
  const lastSpeechEndTime = useRef(0);
  const isStabilizing = useRef(true); // NEW: Gate for AEC calibration

  const initAudio = useCallback(async () => {
    if (sharedAudioContext) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } 
      });
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

      // AEC Stabilizer: Wait 3 seconds before allowing the listener to process audio.
      // This gives the browser's echo canceller time to learn the speaker profile.
      setTimeout(() => { isStabilizing.current = false; }, 3000);
    } catch (e) { console.error(e); }
  }, [onLevelChange]);

  const startRecognition = useCallback(() => {
    if (isSpeaking || recognitionRef.current) return;

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const rec = new SpeechRecognition();
    rec.continuous = true;
    rec.interimResults = false; 
    rec.lang = 'en-GB';

    rec.onresult = (event: any) => {
      // THE GATEKEEPER:
      // 1. Is AI talking? Block.
      // 2. Is browser still calibrating AEC? Block.
      // 3. Did we just finish speaking (1s buffer)? Block.
      if (isSpeaking || isStabilizing.current || preventListening) return;

      const now = Date.now();
      if (now - lastSpeechEndTime.current < 1500) return; // 1.5s buffer

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
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
  }, [onTranscript, isSpeaking, preventListening, enabled]);

  useEffect(() => {
    if (enabled && !isSpeaking) {
      initAudio().then(() => startRecognition());
    } else {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
        recognitionRef.current = null;
      }
      if (isSpeaking) lastSpeechEndTime.current = Date.now();
    }
  }, [enabled, isSpeaking, startRecognition, initAudio]);

  return null;
}
