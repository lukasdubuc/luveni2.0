// ─────────────────────────────────────────────────────────────
//  J.A.R.V.I.S — Luveni GM | hooks/useVoiceInput.ts
// ─────────────────────────────────────────────────────────────

import { useEffect, useRef, useCallback } from 'react';

let sharedAudioContext: AudioContext | null = null;

export function useVoiceInput({ 
  onTranscript, 
  onStateChange, 
  onLevelChange, 
  enabled, 
  isSpeaking // NEW: Pass true when AI is talking
}: any) {
  const recognitionRef = useRef<any>(null);

  const startRecognition = useCallback(() => {
    // If we are currently "speaking," do not start or restart the listener.
    if (isSpeaking || recognitionRef.current) return;

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const rec = new SpeechRecognition();
    rec.continuous = true;
    rec.interimResults = false;
    rec.lang = 'en-GB';

    rec.onstart = () => onStateChange('listening');
    rec.onresult = (event: any) => {
      // If AI is speaking, ignore incoming audio completely
      if (isSpeaking) return; 
      const transcript = event.results[event.results.length - 1][0].transcript;
      if (transcript.trim()) onTranscript(transcript);
    };

    rec.onend = () => {
      recognitionRef.current = null;
      // Only restart if we aren't currently "speaking"
      if (enabled && !isSpeaking) {
        setTimeout(startRecognition, 100);
      }
    };

    try { rec.start(); recognitionRef.current = rec; } catch (e) { console.warn(e); }
  }, [onTranscript, onStateChange, enabled, isSpeaking]);

  useEffect(() => {
    if (enabled && !isSpeaking) {
      startRecognition();
    } else {
      // Stop listening immediately when AI starts speaking
      if (recognitionRef.current) {
        recognitionRef.current.stop();
        recognitionRef.current = null;
      }
    }
  }, [enabled, isSpeaking, startRecognition]);

  return null;
}
