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

function detectMobileDevice() {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  return (
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
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
  const fatalErrorRef = useRef(false);

  // Synchronously update the ref during the render pass!
  // This guarantees that the very instant the parent component re-renders with enabled=false,
  // the ref is updated synchronously, blocking any trailing microtask onresult events from executing cancelSpeech!
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  // Latest Ref Pattern: Keeps callbacks stable to prevent the microphone 
  // from restarting and clicking when parent component state updates.
  const onInterimRef = useRef(onInterim);
  const onTranscriptRef = useRef(onTranscript);
  const onStateChangeRef = useRef(onStateChange);
  const cancelSpeechRef = useRef(cancelSpeech);

  onInterimRef.current = onInterim;
  onTranscriptRef.current = onTranscript;
  onStateChangeRef.current = onStateChange;
  cancelSpeechRef.current = cancelSpeech;

  const startRecognition = useCallback(() => {
    if (!enabledRef.current || recognitionRef.current || fatalErrorRef.current) return;

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      onStateChangeRef.current('error');
      return;
    }

    const isSafari = isSafariBrowser();
    const rec = new SpeechRecognition();

    // Unified Safari Workaround: If continuous is true on macOS/iOS Safari, the engine freezes 
    // silently after the first result. We run single-shot on Safari and let our robust onend 
    // recovery loop instantly restart the mic, keeping continuous listening highly stable.
    rec.continuous = !isSafari; 
    rec.interimResults = true; 
    rec.lang = 'en-US';

    rec.onstart = () => {
      onStateChangeRef.current('listening');
    };

    rec.onresult = (event: any) => {
      // If the microphone has been disabled, discard trailing buffer chunks
      // to prevent interrupting newly started assistant speech.
      if (!enabledRef.current) return;

      cancelSpeechRef.current(); 

      let interim = '';
      let final = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          final += event.results[i][0].transcript;
        } else {
          interim += event.results[i][0].transcript;
        }
      }

      onInterimRef.current(interim);

      if (final.trim()) {
        onTranscriptRef.current(final.trim());
      }
    };

    rec.onend = () => {
      // Instance isolation: Only clear active references if they belong to this instance
      if (recognitionRef.current === rec) {
        recognitionRef.current = null;
      }
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
        
        // Prevent infinite loops on fatal hardware/permission denials
        if (err === 'not-allowed' || err === 'service-not-allowed' || err === 'language-not-supported') {
          fatalErrorRef.current = true;
          onStateChangeRef.current('error');
          return;
        }

        // 'aborted', 'no-speech', and 'network' are routine/recoverable
        if (err === 'no-speech' || err === 'network' || err === 'aborted') {
            return;
        }
        console.error("Speech recognition error", err);
        onStateChangeRef.current('error');
    };

    try { 
      fatalErrorRef.current = false;
      rec.start(); 
      recognitionRef.current = rec; 
    } catch (e) { 
      console.error("Failed to start recognition", e);
      recognitionRef.current = null;
    }
  }, []); // Intentionally empty: protected by refs to avoid engine restarts

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
      if (restartTimeoutRef.current) clearTimeout(restartTimeoutRef.current);
    }

    return () => {
      if (restartTimeoutRef.current) clearTimeout(restartTimeoutRef.current);
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch (e) {}
        recognitionRef.current = null;
      }
    };
  }, [enabled, startRecognition]);

  return null;
}
