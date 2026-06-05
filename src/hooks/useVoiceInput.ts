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

  // CRITICAL: Storing variables in refs avoids stale closure bugs in Web Speech callbacks.
  // This guarantees that callbacks (onresult, onend) always read up-to-date values.
  const isSpeakingRef = useRef(isSpeaking);
  const preventListeningRef = useRef(preventListening);
  const lastAiResponseRef = useRef(lastAiResponse);
  const enabledRef = useRef(enabled);

  useEffect(() => { isSpeakingRef.current = isSpeaking; }, [isSpeaking]);
  useEffect(() => { preventListeningRef.current = preventListening; }, [preventListening]);
  useEffect(() => { lastAiResponseRef.current = lastAiResponse; }, [lastAiResponse]);
  useEffect(() => { enabledRef.current = enabled; }, [enabled]);

  const initAudio = useCallback(async () => {
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
    // Check dynamic refs instead of stale state closures
    if (isSpeakingRef.current || preventListeningRef.current || recognitionRef.current) return;

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const rec = new SpeechRecognition();
    rec.continuous = true;
    rec.interimResults = false; 
    rec.lang = 'en-GB';

    rec.onstart = () => onStateChange('listening');

    rec.onresult = (event: any) => {
      // If the AI is speaking, discard any late-arriving audio captured during the shutdown window
      if (isSpeakingRef.current || preventListeningRef.current) return;

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          const transcript = event.results[i][0].transcript.trim();
          
          if (transcript && transcript.toLowerCase() !== lastAiResponseRef.current.toLowerCase()) {
            onTranscript(transcript);
          }
        }
      }
    };

    rec.onend = () => {
      recognitionRef.current = null;
      onStateChange('idle');
      
      // Cooldown before next attempt - uses refs to ensure absolute state accuracy
      if (enabledRef.current && !isSpeakingRef.current && !preventListeningRef.current) {
        restartTimeoutRef.current = setTimeout(startRecognition, 800);
      }
    };

    try { 
      rec.start(); 
      recognitionRef.current = rec; 
    } catch (e) { 
      recognitionRef.current = null;
    }
  }, [onTranscript, onStateChange]);

  useEffect(() => {
    if (isSpeaking) {
      // AI IS SPEAKING: Immediate shutdown of microphone
      clearTimeout(restartTimeoutRef.current);
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch (e) {}
        recognitionRef.current = null;
      }
    } else if (enabled && !preventListening && !recognitionRef.current) {
      // AI FINISHED: Wait for hardware/audio settle time
      clearTimeout(restartTimeoutRef.current);
      restartTimeoutRef.current = setTimeout(() => {
        if (!isSpeakingRef.current) {
          initAudio().then(() => startRecognition());
        }
      }, 1200); 
    }

    return () => clearTimeout(restartTimeoutRef.current);
  }, [enabled, isSpeaking, preventListening, startRecognition, initAudio]);

  return null;
}
