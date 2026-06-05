// ─────────────────────────────────────────────────────────────
//  J.A.R.V.I.S — Luveni GM | hooks/useSpeechOutput.ts
// ─────────────────────────────────────────────────────────────

import { useCallback, useEffect, useRef } from 'react';

interface UseSpeechOutputOptions {
  onStart?: () => void;
  onBoundary?: (level: number) => void;
  onEnd?: () => void;
}

const BRITISH_VOICES = [
  'Google UK English Female',
  'Google UK English Male',
  'Daniel',
  'Hazel',
  'Siri',
  'Microsoft Susan',
  'Microsoft George',
  'Microsoft Ryan',
];

const isMobile = typeof window !== 'undefined' && 
  (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || 
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));

// A global array to keep a strong reference to active utterances.
// This prevents Chrome/Safari garbage collection from stopping speech mid-sentence.
const globalActiveUtterances: SpeechSynthesisUtterance[] = [];

function findBestVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  for (const name of BRITISH_VOICES) {
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

/**
 * Helper to split text into larger chunks to avoid Chrome's 15-second speech bug,
 * without aggressively splitting short sentences which ruins conversational flow.
 */
function chunkText(text: string, maxLength = 200): string[] {
  if (text.length <= maxLength) return [text];

  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (remaining.length <= maxLength) {
      chunks.push(remaining);
      break;
    }

    // Try to split at sentence/clause endings first
    let splitIndex = -1;
    const breakPoints = ['. ', '! ', '? ', '; ', ', '];
    for (const punct of breakPoints) {
      const idx = remaining.lastIndexOf(punct, maxLength);
      if (idx > splitIndex) {
        splitIndex = idx + punct.length - 1; // split immediately after punctuation
      }
    }

    // Fall back to space if no clean punctuation boundary is found
    if (splitIndex === -1) {
      const idx = remaining.lastIndexOf(' ', maxLength);
      if (idx > 0) splitIndex = idx;
    }

    // Fall back to hard-cut if necessary
    if (splitIndex === -1) {
      splitIndex = maxLength;
    }

    chunks.push(remaining.substring(0, splitIndex).trim());
    remaining = remaining.substring(splitIndex).trim();
  }

  return chunks.filter(Boolean);
}

let voiceCache: SpeechSynthesisVoice | null | undefined = undefined;

export function useSpeechOutput({ onStart, onBoundary, onEnd }: UseSpeechOutputOptions = {}) {
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

  const cancel = useCallback(() => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    globalActiveUtterances.length = 0; // clear the global array
    speaking.current = false;
  }, []);

  const doSpeak = useCallback((text: string, voice: SpeechSynthesisVoice | null) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;

    // First stop any current speech
    cancel();

    // A brief delay allows the browser's audio engine and OS thread to settle.
    // This reduces instances of clipped/cut-off first words.
    setTimeout(() => {
      speaking.current = true;
      if (onStartRef.current) onStartRef.current();

      const phoneticallyCleanText = text.replace(/J\.A\.R\.V\.I\.S\.?/gi, "Jarvis");
      const chunks = chunkText(phoneticallyCleanText, 200);
      let currentIndex = 0;

      const playNext = () => {
        if (currentIndex >= chunks.length) {
          globalActiveUtterances.length = 0;
          speaking.current = false;
          // Introduce a minor delay before firing onEnd to ensure physical playback is complete
          setTimeout(() => {
            if (onEndRef.current) onEndRef.current();
          }, 150);
          return;
        }

        const rawChunk = chunks[currentIndex].trim();
        if (!rawChunk) {
          currentIndex++;
          playNext();
          return;
        }

        const utt = new SpeechSynthesisUtterance(rawChunk);
        
        utt.rate = isMobile ? 1.0 : 0.93;
        utt.pitch = isMobile ? 1.0 : 0.78;
        
        if (voice) utt.voice = voice;

        // Keep a strong reference to prevent garbage collection cutting off the word
        globalActiveUtterances.push(utt);

        utt.onboundary = () => {
          if (onBoundaryRef.current) onBoundaryRef.current(0.3 + Math.random() * 0.55);
        };

        utt.onend = () => {
          // Clean up reference to this utterance
          const idx = globalActiveUtterances.indexOf(utt);
          if (idx > -1) globalActiveUtterances.splice(idx, 1);

          currentIndex++;
          playNext();
        };

        utt.onerror = () => {
          const idx = globalActiveUtterances.indexOf(utt);
          if (idx > -1) globalActiveUtterances.splice(idx, 1);

          currentIndex++;
          playNext();
        };

        window.speechSynthesis.speak(utt);
      };

      playNext();
    }, 100); // 100ms settling time
  }, [cancel]);

  const speak = useCallback((text: string) => {
    if (isMobile) {
      doSpeak(text, null);
      return;
    }

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

  return { speak, cancel, isSpeaking: () => speaking.current };
}
