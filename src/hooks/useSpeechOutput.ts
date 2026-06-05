import { useCallback, useEffect, useRef } from 'react';

interface UseSpeechOutputOptions {
  onStart?: () => void;
  onBoundary?: (level: number) => void;
  onEnd?: () => void;
}

const MALE_BRITISH_NAMES = [
  'Google UK English Male',
  'Daniel',
  'Microsoft George',
  'Microsoft Ryan',
];

function findBestVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  for (const name of MALE_BRITISH_NAMES) {
    const v = voices.find(v => v.name === name);
    if (v) return v;
  }
  return voices.find(v => v.lang.startsWith('en-GB')) ?? null;
}

function loadVoices(): Promise<SpeechSynthesisVoice[]> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      resolve([]);
      return;
    }
    const voices = speechSynthesis.getVoices();
    if (voices.length > 0) {
      resolve(voices);
      return;
    }
    const handler = () => resolve(speechSynthesis.getVoices());
    speechSynthesis.addEventListener('voiceschanged', handler, { once: true });
    setTimeout(() => resolve(speechSynthesis.getVoices()), 1500);
  });
}

// Global voice cache
let voiceCache: SpeechSynthesisVoice | null | undefined = undefined;

export function useSpeechOutput({ onStart, onBoundary, onEnd }: UseSpeechOutputOptions = {}) {
  const speaking = useRef(false);
  const onStartRef = useRef(onStart);
  const onBoundaryRef = useRef(onBoundary);
  const onEndRef = useRef(onEnd);

  // CRITICAL: Prevents garbage collection from cutting off desktop voice mid-speech
  const activeUtterancesRef = useRef<SpeechSynthesisUtterance[]>([]);

  useEffect(() => {
    onStartRef.current = onStart;
    onBoundaryRef.current = onBoundary;
    onEndRef.current = onEnd;
  }, [onStart, onBoundary, onEnd]);

  // Eagerly pre-load the voices on mount to bypass mobile voice latency
  useEffect(() => {
    if (typeof window !== 'undefined' && window.speechSynthesis && voiceCache === undefined) {
      loadVoices().then(v => {
        voiceCache = findBestVoice(v);
      });
    }
  }, []);

  const cancel = useCallback(() => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    activeUtterancesRef.current = [];
    speaking.current = false;
  }, []);

  const doSpeak = useCallback((text: string, voice: SpeechSynthesisVoice | null) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;

    cancel();
    speaking.current = true;
    if (onStartRef.current) onStartRef.current();

    // Split text by standard punctuation into manageable chunks
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
    let currentIndex = 0;

    const playNext = () => {
      // If we have reached the end of the sentences list
      if (currentIndex >= sentences.length) {
        activeUtterancesRef.current = [];
        speaking.current = false;
        setTimeout(() => { if (onEndRef.current) onEndRef.current(); }, 500);
        return;
      }

      const rawSentence = sentences[currentIndex].trim();
      if (!rawSentence) {
        currentIndex++;
        playNext();
        return;
      }

      const utt = new SpeechSynthesisUtterance(rawSentence);
      utt.rate = 0.93;
      utt.pitch = 0.78;
      if (voice) utt.voice = voice;

      utt.onboundary = () => {
        if (onBoundaryRef.current) {
          onBoundaryRef.current(0.3 + Math.random() * 0.55);
        }
      };

      utt.onend = () => {
        currentIndex++;
        playNext();
      };

      utt.onerror = (event) => {
        console.warn("SpeechSynthesisUtterance error encountered:", event);
        currentIndex++;
        playNext();
      };

      // Keep utterance in scope so browser GC doesn't delete it
      activeUtterancesRef.current.push(utt);
      window.speechSynthesis.speak(utt);
    };

    playNext();
  }, [cancel]);

  const speak = useCallback((text: string) => {
    if (voiceCache !== undefined) {
      doSpeak(text, voiceCache);
    } else {
      const immediateVoices = window.speechSynthesis?.getVoices() || [];
      if (immediateVoices.length > 0) {
        voiceCache = findBestVoice(immediateVoices);
        doSpeak(text, voiceCache);
      } else {
        loadVoices().then(v => {
          voiceCache = findBestVoice(v);
          doSpeak(text, voiceCache);
        });
      }
    }
  }, [doSpeak]);

  // UNLOCK FUNCTION FOR MOBILE: Call this during a user tap event to enable async speech
  const unlock = useCallback(() => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    // Speak a tiny, silent utterance inside user interaction space
    const silentUtt = new SpeechSynthesisUtterance(' ');
    silentUtt.volume = 0;
    window.speechSynthesis.speak(silentUtt);
  }, []);

  return { speak, cancel, unlock, isSpeaking: () => speaking.current };
}
