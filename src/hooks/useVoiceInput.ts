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
  const shouldRestartRef = useRef(enabled);
  
  const callbacksRef = useRef({
    onInterim,
    onTranscript,
    onStateChange,
    onLevelChange,
    cancelSpeech
  });

  useEffect(() => {
    callbacksRef.current = {
      onInterim,
      onTranscript,
      onStateChange,
      onLevelChange,
      cancelSpeech
    };
  });

  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  const startRecognition = useCallback(() => {
    if (!enabledRef.current || recognitionRef.current) return;

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      callbacksRef.current.onStateChange('error');
      return;
    }

    const rec = new SpeechRecognition();

    // ─── INSTANT-COMPILE LATENCY RESOLUTION ───
    // Setting continuous to false on all browsers forces the speech engine to emit
    // finalized isFinal chunks instantly instead of waiting for long silence gaps.
    rec.continuous = false; 
    rec.interimResults = true; 
    rec.lang = 'en-US';

    rec.onstart = () => {
      callbacksRef.current.onStateChange('listening');
    };

    rec.onresult = (event: any) => {
      if (!enabledRef.current) return;

      const isSpeakingNative = typeof window !== 'undefined' && window.speechSynthesis && window.speechSynthesis.speaking;
      if (isSpeakingNative) {
        return;
      }

      callbacksRef.current.cancelSpeech(); 

      let interim = '';
      let final = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          final += event.results[i][0].transcript;
        } else {
          interim += event.results[i][0].transcript;
        }
      }

      callbacksRef.current.onInterim(interim);

      if (final.trim()) {
        callbacksRef.current.onTranscript(final.trim());
      }
    };

    rec.onend = () => {
      recognitionRef.current = null;
      
      if (enabledRef.current && shouldRestartRef.current) {
        if (restartTimeoutRef.current) clearTimeout(restartTimeoutRef.current);
        restartTimeoutRef.current = setTimeout(() => {
          if (enabledRef.current && !recognitionRef.current && shouldRestartRef.current) {
            startRecognition();
          }
        }, 150); // Shorter restart delay for snappier conversation transitions
      }
    };

    rec.onerror = (event: any) => {
        const err = event?.error;
        console.warn("[Voice Input] Speech recognition error encountered:", err);

        if (err === 'not-allowed' || err === 'service-not-allowed' || err === 'language-not-supported') {
            shouldRestartRef.current = false;
            callbacksRef.current.onStateChange('error');
            return;
        }

        if (err === 'no-speech' || err === 'network' || err === 'aborted') {
            return;
        }
        
        callbacksRef.current.onStateChange('error');
    };

    try { 
      rec.start(); 
      recognitionRef.current = rec; 
    } catch (e) { 
      console.error("Failed to start recognition", e);
      recognitionRef.current = null;
    }
  }, []); 

  useEffect(() => {
    if (enabled) {
      shouldRestartRef.current = true;
      if (!recognitionRef.current) {
        startRecognition();
      }
    } else {
      shouldRestartRef.current = false;
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch (e) {}
        recognitionRef.current = null;
      }
      if (restartTimeoutRef.current) clearTimeout(restartTimeoutRef.current);
    }

    return () => {
      shouldRestartRef.current = false;
      if (restartTimeoutRef.current) clearTimeout(restartTimeoutRef.current);
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch (e) {}
        recognitionRef.current = null;
      }
    };
  }, [enabled, startRecognition]); 

  return null;
}
