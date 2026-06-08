// ─────────────────────────────────────────────────────────────
//  J.A.R.V.I.S — Luveni GM | hooks/useVoiceInput.ts
// ─────────────────────────────────────────────────────────────

import { useEffect, useRef, useCallback } from 'react';

interface UseVoiceInputOptions {
  onInterim: (text: string) => void;
  onTranscript: (text: string) => void;
  onStateChange: (state: string) => void;
  onLevelChange: (level: number) => void;
  enabled: boolean;
  cancelSpeech: () => void;
}

export function useVoiceInput({ 
  onInterim,
  onTranscript, 
  onStateChange, 
  onLevelChange, 
  enabled, 
  cancelSpeech
}: UseVoiceInputOptions) {
  const recognitionRef = useRef<any>(null);
  const restartTimeoutRef = useRef<any>(null);
  const enabledRef = useRef(enabled);

  useEffect(() => { enabledRef.current = enabled; }, [enabled]);

  // Parallel Web Audio API resources for real-time visual monitoring
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const micSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);

  const cleanupAudioVisualizer = useCallback(() => {
    if (processorRef.current) {
      try { processorRef.current.disconnect(); } catch (e) {}
      processorRef.current = null;
    }
    if (micSourceRef.current) {
      try { micSourceRef.current.disconnect(); } catch (e) {}
      micSourceRef.current = null;
    }
    if (audioContextRef.current) {
      try { audioContextRef.current.close(); } catch (e) {}
      audioContextRef.current = null;
    }
    if (localStreamRef.current) {
      try {
        localStreamRef.current.getTracks().forEach(track => track.stop());
      } catch (e) {}
      localStreamRef.current = null;
    }
    onLevelChange(0);
  }, [onLevelChange]);

  const setupAudioVisualizer = useCallback(async () => {
    cleanupAudioVisualizer();
    if (!enabledRef.current) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      localStreamRef.current = stream;

      const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtx();
      audioContextRef.current = ctx;

      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyserRef.current = analyser;

      const source = ctx.createMediaStreamSource(stream);
      micSourceRef.current = source;

      const processor = ctx.createScriptProcessor(2048, 1, 1);
      processorRef.current = processor;

      source.connect(analyser);
      analyser.connect(processor);
      processor.connect(ctx.destination);

      processor.onaudioprocess = () => {
        if (!enabledRef.current || !analyserRef.current) return;
        const array = new Uint8Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getByteFrequencyData(array);
        
        let sum = 0;
        const length = array.length;
        for (let i = 0; i < length; i++) {
          sum += array[i];
        }
        const average = sum / length;
        // Scale average to a level between 0 and 1
        const scaledLevel = Math.min(1, average / 45);
        onLevelChange(scaledLevel);
      };
    } catch (err) {
      console.warn("[Voice Input] Real-time audio visualizer was not started:", err);
    }
  }, [cleanupAudioVisualizer, onLevelChange]);

  const startRecognition = useCallback(() => {
    if (!enabledRef.current || recognitionRef.current) return;

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      onStateChange('error');
      return;
    }

    const rec = new SpeechRecognition();
    rec.continuous = true;
    rec.interimResults = true; 
    rec.lang = 'en-US';

    rec.onstart = () => {
      onStateChange('listening');
      setupAudioVisualizer();
    };

    rec.onresult = (event: any) => {
      cancelSpeech(); 

      let interim = '';
      let final = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          final += event.results[i][0].transcript;
        } else {
          interim += event.results[i][0].transcript;
        }
      }

      onInterim(interim);

      if (final.trim()) {
        onTranscript(final.trim());
      }
    };

    rec.onend = () => {
      recognitionRef.current = null;
      cleanupAudioVisualizer();
      if (enabledRef.current) {
        restartTimeoutRef.current = setTimeout(() => {
          if (enabledRef.current && !recognitionRef.current) {
            startRecognition();
          }
        }, 100);
      }
    };

    rec.onerror = (event: any) => {
        const err = event?.error;
        if (err === 'no-speech' || err === 'network' || err === 'aborted') {
            return;
        }
        console.error("Speech recognition error", err);
        onStateChange('error');
    };

    try { 
      rec.start(); 
      recognitionRef.current = rec; 
    } catch (e) { 
      console.error("Failed to start recognition", e);
      recognitionRef.current = null;
    }
  }, [onInterim, onTranscript, onStateChange, cancelSpeech, setupAudioVisualizer, cleanupAudioVisualizer]);

  useEffect(() => {
    if (enabled) {
      if (!recognitionRef.current) {
        startRecognition();
      }
    } else {
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch (e) {}
        recognitionRef.current = null;
      }
      cleanupAudioVisualizer();
      if (restartTimeoutRef.current) clearTimeout(restartTimeoutRef.current);
    }

    return () => {
      if (restartTimeoutRef.current) clearTimeout(restartTimeoutRef.current);
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch (e) {}
        recognitionRef.current = null;
      }
      cleanupAudioVisualizer();
    };
  }, [enabled, startRecognition, cleanupAudioVisualizer]);

  return null;
}
