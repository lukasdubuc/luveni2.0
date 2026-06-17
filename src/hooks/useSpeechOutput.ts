// ─────────────────────────────────────────────────────────────────────────────
//  J.A.R.V.I.S — Luveni GM | hooks/useSpeechOutput.ts
//  PATCHED: voice loading race, key detection, volume guard, persistent safari audio pipeline
//  All original lines preserved — additions only
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface UseSpeechOutputOptions {
  onStart?: () => void;
  onBoundary?: (level: number) => void;
  onEnd?: () => void;
}

const BRITISH_VOICES = [
  'Microsoft Ryan Online (Natural) - English (United Kingdom)',
  'Microsoft Sonia Online (Natural) - English (United Kingdom)',
  'Microsoft Thomas Online (Natural) - English (United Kingdom)',
  'Google UK English Male',
  'Google UK English Female',
  'Daniel',
  'Hazel',
  'Siri',
  'Microsoft Susan',
  'Microsoft George',
  'Microsoft Ryan',
];

function detectMobileDevice() {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  return (
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

const globalActiveUtterances: SpeechSynthesisUtterance[] = [];

function findBestVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  if (!voices.length) return null;

  const isAppleDevice = typeof navigator !== 'undefined' && /mac|iphone|ipad|ipod/i.test(navigator.platform || navigator.userAgent);

  const englishVoices = voices.filter(v => {
    const lang = v.lang.toLowerCase().replace('_', '-');
    if (isAppleDevice && v.name.toLowerCase().includes('google')) return false;
    return lang.startsWith('en');
  });

  if (englishVoices.length === 0) {
    return voices[0] || null;
  }

  const knownGoodNames = ['daniel', 'reed', 'arthur', 'gordon', 'george', 'thomas', 'ryan', 'oliver', 'harry', 'eddy', 'rocko', 'guy', 'liam', 'sonia', 'serena', 'libby', 'kate', 'samantha'];
  const knownBadNames = ['flo', 'fred', 'albert', 'bad news', 'bahh', 'bells', 'boing', 'bubbles', 'cellos', 'good news', 'jester', 'organ', 'superstar', 'trinoids', 'whisper', 'zarvox'];

  const scoreVoice = (v: SpeechSynthesisVoice): number => {
    const name = v.name.toLowerCase();
    const lang = v.lang.toLowerCase().replace('_', '-');
    let score = 0;

    if (knownBadNames.some(bad => name.includes(bad))) return -1000;

    if (lang.startsWith('en-gb')) score += 100;
    else if (lang.startsWith('en-au')) score += 50;
    else if (lang.startsWith('en-us')) score += 30;
    else if (lang.startsWith('en')) score += 10;

    if (/natural/.test(name)) score += 500;
    if (/neural/.test(name)) score += 500;
    if (/premium|enhanced|wavenet/.test(name)) score += 400;
    if (/siri/.test(name)) score += 300;
    if (/online/.test(name)) score += 200;

    if (knownGoodNames.some(good => name.includes(good))) score += 50;

    if (v.localService) {
      if (/premium|enhanced|siri/.test(name)) score += 100;
      else score -= 100;
    }

    if (lang.startsWith('en-gb') && (/male|ryan|george|thomas|daniel|oliver/.test(name))) score += 80;

    return score;
  };

  const ranked = [...englishVoices].sort((a, b) => scoreVoice(b) - scoreVoice(a));
  return ranked[0] || englishVoices[0];
}

function loadVoices(): Promise<SpeechSynthesisVoice[]> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) { resolve([]); return; }
    const voices = speechSynthesis.getVoices();
    if (voices.length > 0) { resolve(voices); return; }
    const handler = () => resolve(speechSynthesis.getVoices());
    speechSynthesis.addEventListener('voiceschanged', handler, { once: true });
    setTimeout(() => resolve(speechSynthesis.getVoices()), 2000);
  });
}

function sanitizeTextForSpeech(rawText: string): string {
  return rawText
    .replace(/J\.A\.R\.V\.I\.S\.?/gi, "Jarvis")
    .replace(/\*\*/g, '')
    .replace(/\*/g, '')
    .replace(/^#+\s+/gm, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/`/g, '')
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function chunkText(text: string, maxLength = 150): string[] {
  if (text.length <= maxLength) return [text];
  const chunks: string[] = [];
  let remaining = text;
  while (remaining.length > 0) {
    if (remaining.length <= maxLength) { chunks.push(remaining); break; }
    let splitIndex = -1;
    for (const punct of ['. ', '! ', '? ', '; ', ', ']) {
      const idx = remaining.lastIndexOf(punct, maxLength);
      if (idx > splitIndex) splitIndex = idx + punct.length - 1;
    }
    if (splitIndex === -1) {
      const idx = remaining.lastIndexOf(' ', maxLength);
      if (idx > 0) splitIndex = idx;
    }
    if (splitIndex === -1) splitIndex = maxLength;
    chunks.push(remaining.substring(0, splitIndex).trim());
    remaining = remaining.substring(splitIndex).trim();
  }
  return chunks.filter(Boolean);
}

let voiceCache: SpeechSynthesisVoice | null | undefined = undefined;

export function useSpeechOutput({ onStart, onBoundary, onEnd }: UseSpeechOutputOptions = {}) {
  const [currentSubtitle, setCurrentSubtitle] = useState("");
  const [isMobile, setIsMobile] = useState(false);
  const speaking = useRef(false);
  const onStartRef = useRef(onStart);
  const onBoundaryRef = useRef(onBoundary);
  const onEndRef = useRef(onEnd);

  const activeAudiosRef = useRef<HTMLAudioElement[]>([]);
  const audioIntervalRef = useRef<any>(null);
  const globalAudioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    onStartRef.current = onStart;
    onBoundaryRef.current = onBoundary;
    onEndRef.current = onEnd;
  }, [onStart, onBoundary, onEnd]);

  useEffect(() => { setIsMobile(detectMobileDevice()); }, []);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.speechSynthesis && voiceCache === undefined) {
      loadVoices().then(v => { if (voiceCache === undefined) voiceCache = findBestVoice(v); });
    }
  }, []);

  const endSpeechCleanup = useCallback(() => {
    speaking.current = false;
    setCurrentSubtitle("");
    if (onEndRef.current) onEndRef.current();
  }, []);

  const cancel = useCallback((isTransitioning = false) => {
    if (
      typeof window !== 'undefined' &&
      window.speechSynthesis &&
      (window.speechSynthesis.speaking || window.speechSynthesis.pending)
    ) {
      try { window.speechSynthesis.resume(); window.speechSynthesis.cancel(); } catch (e) {}
    }
    globalActiveUtterances.length = 0;

    activeAudiosRef.current.forEach(audio => {
      try { audio.pause(); audio.currentTime = 0; audio.src = ''; } catch (e) {}
    });
    activeAudiosRef.current = [];

    if (audioIntervalRef.current) { clearInterval(audioIntervalRef.current); audioIntervalRef.current = null; }

    if (isTransitioning) { speaking.current = false; setCurrentSubtitle(""); }
    else endSpeechCleanup();
  }, [endSpeechCleanup]);

  const unlock = useCallback(() => {
    if (typeof window === 'undefined') return;
    if (window.speechSynthesis) {
      try {
        window.speechSynthesis.cancel();
        const trustUtt = new SpeechSynthesisUtterance(' ');
        trustUtt.volume = 0.01; trustUtt.rate = 10; trustUtt.lang = 'en-US';
        window.speechSynthesis.speak(trustUtt);
      } catch (e) {}
    }
    try {
      if (!globalAudioRef.current) globalAudioRef.current = new Audio();
      globalAudioRef.current.src = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQQAAAAAAA==';
      globalAudioRef.current.play().catch(() => {});
    } catch (e) {}
  }, []);

  const doSpeakNative = useCallback(async (text: string, voice: SpeechSynthesisVoice | null) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    cancel(true);

    let activeVoice = voice;
    if (!activeVoice) {
      const liveVoices = await loadVoices();
      activeVoice = findBestVoice(liveVoices);
      if (activeVoice) voiceCache = activeVoice;
    }
    if (!activeVoice) {
      const liveVoices = window.speechSynthesis.getVoices();
      activeVoice = liveVoices.find(v => v.lang.toLowerCase().startsWith('en')) || liveVoices[0] || null;
    }

    speaking.current = true;
    if (onStartRef.current) onStartRef.current();

    const chunks = chunkText(sanitizeTextForSpeech(text), 150);
    if (chunks.length === 0) { endSpeechCleanup(); return; }

    globalActiveUtterances.length = 0;

    const speakChunk = (index: number) => {
      if (!speaking.current) return;
      if (index >= chunks.length) { endSpeechCleanup(); return; }

      const rawChunk = chunks[index].trim();
      if (!rawChunk) { speakChunk(index + 1); return; }

      const utt = new SpeechSynthesisUtterance(rawChunk);
      utt.volume = 1;
      utt.rate = isMobile ? 1.0 : 0.95;
      utt.pitch = 1.0;
      utt.lang = activeVoice?.lang ?? 'en-GB';
      if (activeVoice) utt.voice = activeVoice;

      globalActiveUtterances.push(utt);
      utt.onstart = () => setCurrentSubtitle(rawChunk);
      utt.onboundary = () => { if (onBoundaryRef.current) onBoundaryRef.current(0.3 + Math.random() * 0.55); };
      utt.onend = () => speakChunk(index + 1);
      utt.onerror = () => speakChunk(index + 1);

      try { window.speechSynthesis.speak(utt); } catch (e) { speakChunk(index + 1); }
    };

    speakChunk(0);
  }, [cancel, isMobile, endSpeechCleanup]);

  const doSpeakElevenLabs = useCallback(async (text: string) => {
    cancel(true);
    speaking.current = true;
    if (onStartRef.current) onStartRef.current();

    const chunks = chunkText(sanitizeTextForSpeech(text), 150);

    try {
      const audioUrls: string[] = [];

      for (const chunk of chunks) {
        const { data, error } = await supabase.functions.invoke('jarvis-brain', {
          body: { tool: 'tts', args: { text: chunk } },
        });
        if (error) throw error;
        const buffer = Uint8Array.from(atob(data.audio), c => c.charCodeAt(0));
        const blob = new Blob([buffer], { type: 'audio/mpeg' });
        audioUrls.push(URL.createObjectURL(blob));
      }

      let currentIndex = 0;

      const playNext = () => {
        if (!speaking.current || currentIndex >= audioUrls.length) {
          speaking.current = false;
          setCurrentSubtitle("");
          if (audioIntervalRef.current) { clearInterval(audioIntervalRef.current); audioIntervalRef.current = null; }
          if (onEndRef.current) onEndRef.current();
          return;
        }

        setCurrentSubtitle(chunks[currentIndex]);

        if (!globalAudioRef.current) globalAudioRef.current = new Audio();
        const audio = globalAudioRef.current;
        audio.src = audioUrls[currentIndex];
        activeAudiosRef.current = [audio];

        if (audioIntervalRef.current) clearInterval(audioIntervalRef.current);
        audioIntervalRef.current = setInterval(() => {
          if (onBoundaryRef.current && speaking.current) onBoundaryRef.current(0.3 + Math.random() * 0.55);
        }, 80);

        audio.onended = () => { URL.revokeObjectURL(audioUrls[currentIndex]); currentIndex++; playNext(); };
        audio.onerror = () => { URL.revokeObjectURL(audioUrls[currentIndex]); currentIndex++; playNext(); };
        audio.play().catch(() => { URL.revokeObjectURL(audioUrls[currentIndex]); currentIndex++; playNext(); });
      };

      playNext();

    } catch (error) {
      console.warn('[Speech Engine] ElevenLabs via Supabase failed, falling back:', error);
      const voices = await loadVoices();
      const fallbackVoice = voiceCache ?? findBestVoice(voices);
      if (fallbackVoice) voiceCache = fallbackVoice;
      doSpeakNative(text, fallbackVoice || null);
    }
  }, [cancel, doSpeakNative]);

  const speak = useCallback(async (text: string) => {
    if (typeof window !== 'undefined') {
      try {
        if (!globalAudioRef.current) globalAudioRef.current = new Audio();
        globalAudioRef.current.src = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQQAAAAAAA==';
        globalAudioRef.current.play().catch(() => {});
      } catch (e) {}
    }
    doSpeakElevenLabs(text);
  }, [doSpeakElevenLabs]);

  return { speak, cancel, unlock, isSpeaking: () => speaking.current, currentSubtitle };
}
