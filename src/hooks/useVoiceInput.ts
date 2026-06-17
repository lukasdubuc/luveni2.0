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

// Unified browser Safari detection for continuous-listening bug workaround
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
  
  // Track if we should permit automatic restarts
  const shouldRestartRef = useRef(enabled);
  
  // Synchronously update the ref during the render pass!
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  const startRecognition = useCallback(() => {
    if (!enabledRef.current || recognitionRef.current) return;

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
    };

    rec.onresult = (event: any) => {
      // Synchronously discard trailing audio buffers if voice input was disabled
      if (!enabledRef.current) return;

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
      
      // Only schedule a restart if enabled is still true and no hard errors occurred
      if (enabledRef.current && shouldRestartRef.current) {
        if (restartTimeoutRef.current) clearTimeout(restartTimeoutRef.current);
        restartTimeoutRef.current = setTimeout(() => {
          if (enabledRef.current && !recognitionRef.current && shouldRestartRef.current) {
            startRecognition();
          }
        }, 300); // Relaxed timeout to prevent race conditions on slower devices
      }
    };

    rec.onerror = (event: any) => {
        const err = event?.error;
        
        // Handle hard browser blocks (no permission, lack of user gesture, blockages)
        if (err === 'not-allowed' || err === 'service-not-allowed' || err === 'language-not-supported') {
            console.warn("[Voice Input] Speech recognition stopped due to browser constraints:", err);
            shouldRestartRef.current = false; // Block the recovery loop immediately
            onStateChange('error');
            return;
        }

        // 'aborted', 'no-speech', and 'network' are routine/recoverable
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
  }, [onInterim, onTranscript, onStateChange, cancelSpeech]);

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
