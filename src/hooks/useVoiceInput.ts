// ─────────────────────────────────────────────────────────────
//  J.A.R.V.I.S — Luveni GM | hooks/useVoiceInput.ts
// ─────────────────────────────────────────────────────────────

import { useEffect, useRef, useCallback } from 'react';

let sharedAudioContext: AudioContext | null = null;

export function useVoiceInput({ 
  onTranscript, onStateChange, onLevelChange, enabled, isSpeaking, lastAiResponse, preventListening 
}: any) {
  const recognitionRef = useRef<any>(null);
  const restartTimeoutRef = useRef<NodeJS.Timeout>();

  const initAudio = useCallback(async () => {
    if (sharedAudioContext) {
      if (sharedAudioContext.state === 'suspended') await sharedAudioContext.resume();
      return;
    }
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      sharedAudioContext = new AudioCtx();
      const analyzer = sharedAudioContext.createAnalyser();
      const source = sharedAudioContext.createMediaStreamSource(stream);
      source.connect(analyzer);
      analyzer.fftSize = 64;

      const dataArray = new Uint8Array(analyzer.frequencyBinCount);
      const updateLevel = () => {
        if (!analyzer) return;
        analyzer.getByteFrequencyData(dataArray);
        const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
        onLevelChange(avg / 128);
        requestAnimationFrame(updateLevel);
      };
      updateLevel();
    } catch (e) { console.error('[VoiceInput] Hardware access blocked:', e); }
  }, [onLevelChange]);

  const startRecognition = useCallback(() => {
    if (isSpeaking || preventListening || recognitionRef.current) return;

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const rec = new SpeechRecognition();
    rec.continuous = true;
    rec.interimResults = false; 
    rec.lang = 'en-GB';

    rec.onstart = () => onStateChange('listening');
    rec.onresult = (event: any) => {
      if (isSpeaking || preventListening) return;

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          const transcript = event.results[i][0].transcript.trim();
          
          // CRITICAL FIX: Only ignore if the response is empty or truly identical
          if (transcript && transcript.toLowerCase() !== lastAiResponse.toLowerCase()) {
            onTranscript(transcript);
          }
        }
      }
    };

    rec.onend = () => {
      recognitionRef.current = null;
      onStateChange('idle');
      if (enabled && !isSpeaking && !preventListening) {
        restartTimeoutRef.current = setTimeout(startRecognition, 500);
      }
    };

    try { rec.start(); recognitionRef.current = rec; } catch (e) { recognitionRef.current = null; }
  }, [onTranscript, onStateChange, preventListening, enabled, isSpeaking, lastAiResponse]);

  useEffect(() => {
    if (isSpeaking) {
      clearTimeout(restartTimeoutRef.current);
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch (e) {}
        recognitionRef.current = null;
      }
    } else if (enabled && !preventListening && !recognitionRef.current) {
      restartTimeoutRef.current = setTimeout(() => {
        initAudio().then(startRecognition);
      }, 1000);
    }
    return () => clearTimeout(restartTimeoutRef.current);
  }, [enabled, isSpeaking, preventListening, startRecognition, initAudio]);

  return null;
}
