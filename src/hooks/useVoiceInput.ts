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
  lastAiResponse: string;
  preventListening?: boolean;
}

export function useVoiceInput({ 
  onTranscript, 
  onStateChange, 
  onLevelChange, 
  enabled, 
  isSpeaking, 
  lastAiResponse,
  preventListening 
}: UseVoiceInputOptions) {
  const recognitionRef = useRef<any>(null);
  const restartTimeoutRef = useRef<NodeJS.Timeout>();
  const lastSpeechEndTime = useRef(0);

  const initAudio = useCallback(async () => {
    // MOBILE FIX: Resume context if it exists but is suspended
    if (sharedAudioContext) {
      if (sharedAudioContext.state === 'suspended') await sharedAudioContext.resume();
      return;
    }
    
    try {
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
    // Only attempt start if we aren't already speaking
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
          
          // Only trigger if we aren't just echoing the last AI message
          if (transcript && transcript.toLowerCase() !== lastAiResponse.toLowerCase()) {
            onTranscript(transcript);
          }
        }
      }
    };

    rec.onend = () => {
      recognitionRef.current = null;
      onStateChange('idle');
      // Cooldown before next attempt
      if (enabled && !isSpeaking && !preventListening) {
        restartTimeoutRef.current = setTimeout(startRecognition, 800);
      }
    };

    try { 
      rec.start(); 
      recognitionRef.current = rec; 
    } catch (e) { 
      recognitionRef.current = null;
    }
  }, [onTranscript, onStateChange, preventListening, enabled, isSpeaking, lastAiResponse]);

  useEffect(() => {
    if (isSpeaking) {
      // AI IS SPEAKING: Immediate shutdown
      lastSpeechEndTime.current = Date.now();
      clearTimeout(restartTimeoutRef.current);
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch (e) {}
        recognitionRef.current = null;
      }
    } else if (enabled && !preventListening && !recognitionRef.current) {
      // AI FINISHED: Wait for hardware settle time
      restartTimeoutRef.current = setTimeout(() => {
        initAudio().then(() => startRecognition());
      }, 1200); // Increased settle time to 1.2s to prevent cut-off
    }

    return () => clearTimeout(restartTimeoutRef.current);
  }, [enabled, isSpeaking, preventListening, startRecognition, initAudio]);

  return null;
}
