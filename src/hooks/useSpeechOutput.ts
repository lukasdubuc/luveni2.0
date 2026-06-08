// ─────────────────────────────────────────────────────────────
//  J.A.R.V.I.S — Luveni GM | hooks/useSpeechOutput.ts
// ─────────────────────────────────────────────────────────────

import { useState, useCallback, useEffect, useRef } from 'react';

interface UseSpeechOutputOptions {
  onStart?: () => void;
  onBoundary?: (level: number) => void;
  onEnd?: () => void;
}

// ... (findBestVoice, loadVoices, sanitizeTextForSpeech, chunkText functions remain the same) ...

let voiceCache: SpeechSynthesisVoice | null | undefined = undefined;

export function useSpeechOutput({ onStart, onBoundary, onEnd }: UseSpeechOutputOptions = {}) {
  const [currentSubtitle, setCurrentSubtitle] = useState("");
  const speaking = useRef(false);
  const onStartRef = useRef(onStart);
  const onBoundaryRef = useRef(onBoundary);
  const onEndRef = useRef(onEnd);

  useEffect(() => {
    onStartRef.current = onStart;
    onBoundaryRef.current = onBoundary;
    onEndRef.current = onEnd;
  }, [onStart, onBoundary, onEnd]);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.speechSynthesis && voiceCache === undefined) {
      loadVoices().then(v => {
        voiceCache = findBestVoice(v);
      });
    }
  }, []);
  
  const endSpeechCleanup = useCallback(() => {
    speaking.current = false;
    setCurrentSubtitle("");
    if (onEndRef.current) {
        onEndRef.current();
    }
  }, []);

  const cancel = useCallback(() => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    endSpeechCleanup();
  }, [endSpeechCleanup]);

  const doSpeakNative = useCallback((text: string, voice: SpeechSynthesisVoice | null) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;

    cancel();

    setTimeout(() => {
      speaking.current = true;
      if (onStartRef.current) onStartRef.current();

      const cleanText = sanitizeTextForSpeech(text);
      const chunks = chunkText(cleanText, 150);
      
      if (chunks.length === 0) {
        endSpeechCleanup();
        return;
      }

      const speakChunk = (index: number) => {
        if (index >= chunks.length) {
          endSpeechCleanup();
          return;
        }
        
        const chunk = chunks[index];
        const utt = new SpeechSynthesisUtterance(chunk);
        
        let activeVoice = voice;
        if (!activeVoice) {
          const liveVoices = window.speechSynthesis.getVoices();
          activeVoice = findBestVoice(liveVoices);
        }

        utt.voice = activeVoice;
        utt.lang = activeVoice ? activeVoice.lang : 'en-GB';
        utt.rate = 1.0;
        utt.pitch = 1.0;
        
        utt.onstart = () => setCurrentSubtitle(chunk);
        utt.onend = () => speakChunk(index + 1);
        utt.onerror = () => speakChunk(index + 1); // Failsafe: move to next chunk on error

        window.speechSynthesis.speak(utt);
      };

      speakChunk(0);

    }, 100); 
  }, [cancel, endSpeechCleanup]);
  
  const speak = useCallback((text: string) => {
    const immediateVoices = typeof window !== 'undefined' && window.speechSynthesis 
      ? window.speechSynthesis.getVoices() 
      : [];
    
    const voice = findBestVoice(immediateVoices);
    if (voice) voiceCache = voice;

    doSpeakNative(text, voice);
  }, [doSpeakNative]);

  return { 
    speak, 
    cancel, 
    isSpeaking: () => speaking.current,
    currentSubtitle 
  };
}
// Note: findBestVoice, loadVoices, sanitizeTextForSpeech, and chunkText functions are omitted for brevity but should be included in the actual file.
