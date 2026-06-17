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

function isSafariBrowser() {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent.toLowerCase();
  return ua.includes('safari') && !ua.includes('chrome') && !ua.includes('chromium');
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
  
  // Track consecutive errors to prevent CPU-thrashing loop
  const consecutiveErrorsRef = useRef(0);
  const MAX_CONSECUTIVE_ERRORS = 3;
  
  // Track if we should permit automatic restarts
  const shouldRestartRef = useRef(enabled);
  
  // Synchronously update the ref during the render pass
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  const startRecognition = useCallback(() => {
    if (!enabledRef.current || recognitionRef.current) return;

    // Halt immediately if we have thrashed the error limit
    if (consecutiveErrorsRef.current >= MAX_CONSECUTIVE_ERRORS) {
      console.warn("[Voice Input] Restart prevented. Exceeded error threshold.");
      onStateChange('error');
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      onStateChange('error');
      return;
    }

    const isSafari = isSafariBrowser();
    const rec = new SpeechRecognition();

    rec.continuous = !isSafari;
    rec.interimResults = true; 
    rec.lang = 'en-US';

    rec.onstart = () => {
      onStateChange('listening');
      consecutiveErrorsRef.current = 0; // Reset consecutive errors on successful start
    };

    rec.onresult = (event: any) => {
      if (!enabledRef.current) return;

      cancelSpeech(); 
      consecutiveErrorsRef.current = 0; // Reset error threshold on successful speech capture

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
      
      // Only schedule a restart if mic is enabled and no crash limit is reached
      if (enabledRef.current && shouldRestartRef.current && consecutiveErrorsRef.current < MAX_CONSECUTIVE_ERRORS) {
        if (restartTimeoutRef.current) clearTimeout(restartTimeoutRef.current);
        restartTimeoutRef.current = setTimeout(() => {
          if (enabledRef.current && !recognitionRef.current && shouldRestartRef.current) {
            startRecognition();
          }
        }, 300);
      }
    };

    rec.onerror = (event: any) => {
        const err = event?.error;
        consecutiveErrorsRef.current += 1;
        
        // Prevent infinite thrashing if permission is blocked or gesture is missing
        if (consecutiveErrorsRef.current >= MAX_CONSECUTIVE_ERRORS) {
          console.warn("[Voice Input] UI safeguard: Halting restart loop to prevent main thread lockup.");
          shouldRestartRef.current = false;
          onStateChange('error');
          return;
        }

        if (err === 'not-allowed' || err === 'service-not-allowed' || err === 'language-not-supported') {
            shouldRestartRef.current = false; // Block loops for unrecoverable errors
            onStateChange('error');
            return;
        }

        // Recoverable speech pauses
        if (err === 'no-speech' || err === 'network' || err === 'aborted') {
            return;
        }
        
        onStateChange('error');
    };

    try { 
      rec.start(); 
      recognitionRef.current = rec; 
    } catch (e) { 
      console.error("Failed to start recognition", e);
      recognitionRef.current = null;
    }
  }, [onInterim, onTranscript, onStateChange, cancelSpeech]);

  useEffect(() => {
    if (enabled) {
      shouldRestartRef.current = true;
      consecutiveErrorsRef.current = 0; // Clear errors on manual re-enable
      if (!recognitionRef.current) {
        startRecognition();
      }
    } else {
      shouldRestartRef.current = false;
      consecutiveErrorsRef.current = 0;
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
