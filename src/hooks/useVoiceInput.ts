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
  const lastSpeechEndTime = useRef(0);

  const initAudio = useCallback(async () => {
    if (sharedAudioContext) return;
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
    // If already speaking or already running, don't restart
    if (isSpeaking || preventListening || recognitionRef.current) return;

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const rec = new SpeechRecognition();
    rec.continuous = true;
    rec.interimResults = false; 
    rec.lang = 'en-GB';

    rec.onstart = () => onStateChange('listening');

    rec.onresult = (event: any) => {
      // 1. HARD MUTE: Ignore if AI is currently speaking or explicitly blocked
      if (isSpeaking || preventListening) return;

      // 2. BUFFER COOLDOWN: 1.5s delay to ensure room silence after AI finished
      const now = Date.now();
      if (now - lastSpeechEndTime.current < 1500) return;

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          const transcript = event.results[i][0].transcript.trim();
          
          // 3. ECHO-KILLER: Ignore if it matches exactly what we just said
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
      // Restart loop if still enabled
      if (enabled && !isSpeaking && !preventListening) {
        setTimeout(startRecognition, 100);
      }
    };

    try { 
      rec.start(); 
      recognitionRef.current = rec; 
    } catch (e) { 
      console.warn('[VoiceInput] Recognition start failed:', e); 
    }
  }, [onTranscript, onStateChange, preventListening, enabled, isSpeaking, lastAiResponse]);

  useEffect(() => {
    // Logic to handle state transitions
    if (isSpeaking) {
      // AI started speaking, kill the mic
      lastSpeechEndTime.current = Date.now();
      if (recognitionRef.current) {
        recognitionRef.current.stop();
        recognitionRef.current = null;
      }
    } else if (enabled && !preventListening) {
      // AI stopped speaking, try to restart the mic
      initAudio().then(() => startRecognition());
    } else if (!enabled) {
      // Disabled completely
      if (recognitionRef.current) {
        recognitionRef.current.stop();
        recognitionRef.current = null;
      }
    }
  }, [enabled, isSpeaking, preventListening, startRecognition, initAudio]);

  return null;
}
