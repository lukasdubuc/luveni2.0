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
    // Only initialize if context is suspended or doesn't exist
    if (sharedAudioContext && sharedAudioContext.state === 'running') return;
    
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
    // Prevent multiple instances
    if (isSpeaking || preventListening || recognitionRef.current) return;

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const rec = new SpeechRecognition();
    rec.continuous = true;
    rec.interimResults = false; 
    rec.lang = 'en-GB';

    rec.onstart = () => onStateChange('listening');

    rec.onresult = (event: any) => {
      // Immediate exit if AI is active
      if (isSpeaking || preventListening) return;

      // Ensure enough time has passed to prevent picking up AI echo
      const now = Date.now();
      if (now - lastSpeechEndTime.current < 1000) return;

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          const transcript = event.results[i][0].transcript.trim();
          
          // Semantic check against AI output
          if (lastAiResponse && transcript.toLowerCase() === lastAiResponse.toLowerCase()) {
            return;
          }

          if (transcript) onTranscript(transcript);
        }
      }
    };

    rec.onend = () => {
      recognitionRef.current = null;
      onStateChange('idle');
      // Automatic recovery loop
      if (enabled && !isSpeaking && !preventListening) {
        restartTimeoutRef.current = setTimeout(startRecognition, 500);
      }
    };

    try { 
      rec.start(); 
      recognitionRef.current = rec; 
    } catch (e) { 
      console.warn('[VoiceInput] Restarting recognition...'); 
    }
  }, [onTranscript, onStateChange, preventListening, enabled, isSpeaking, lastAiResponse]);

  useEffect(() => {
    if (isSpeaking) {
      // AI active: Kill mic immediately
      lastSpeechEndTime.current = Date.now();
      clearTimeout(restartTimeoutRef.current);
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch (e) {}
        recognitionRef.current = null;
      }
    } else if (enabled && !preventListening && !recognitionRef.current) {
      // AI finished: Delay restart by 1s to allow buffer clear
      restartTimeoutRef.current = setTimeout(() => {
        initAudio().then(() => startRecognition());
      }, 1000);
    }

    return () => clearTimeout(restartTimeoutRef.current);
  }, [enabled, isSpeaking, preventListening, startRecognition, initAudio]);

  return null;
}
