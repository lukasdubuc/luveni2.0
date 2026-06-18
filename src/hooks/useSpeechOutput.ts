// ─────────────────────────────────────────────────────────────
//  J.A.R.V.I.S — Luveni GM | hooks/useSpeechOutput.ts
// ─────────────────────────────────────────────────────────────

import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface UseSpeechOutputOptions {
  onStart?: () => void;
  onBoundary?: (level: number) => void;
  onEnd?: () => void;
}

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

  if (englishVoices.length === 0) return voices[0] || null;

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
    if (remaining.length <= maxLength) {
      chunks.push(remaining);
      break;
    }

    let splitIndex = -1;
    const breakPoints = ['. ', '! ', '? ', '; ', ', '];
    for (const punct of breakPoints) {
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

// ── ElevenLabs client-side key resolver (optional direct-call fallback) ──────
// PRIMARY path is the `jarvis-brain` edge function (key stays server-side).
// This only enables a direct browser call if the edge function is unreachable
// AND a client-side key is present. A browser-side key is publicly visible —
// use only as a stopgap. Set via VITE_ELEVENLABS_API_KEY or window.__ELEVEN_KEY__.
function resolveElevenLabsKey(): string {
  if (typeof window !== 'undefined' && (window as any).__ELEVEN_KEY__) {
    return (window as any).__ELEVEN_KEY__;
  }
  try {
    const viteKey =
      (import.meta as any)?.env?.VITE_ELEVENLABS_API_KEY ||
      (import.meta as any)?.env?.ELEVENLABS_API_KEY;
    if (viteKey) return viteKey;
  } catch (_) {}
  return '';
}

const ELEVENLABS_VOICE_ID = 'pNInz6obpgDQGcFbJwr1';

// Decode a base64 mp3 payload into a playable object URL.
function base64ToBlobUrl(base64: string): string {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const blob = new Blob([bytes], { type: 'audio/mpeg' });
  return URL.createObjectURL(blob);
}

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

  useEffect(() => {
    setIsMobile(detectMobileDevice());
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.speechSynthesis && voiceCache === undefined) {
      loadVoices().then(v => {
        if (voiceCache === undefined) voiceCache = findBestVoice(v);
      });
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
      try {
        window.speechSynthesis.resume();
        window.speechSynthesis.cancel();
      } catch (e) {
        console.warn("[Speech Output] Cancel error handled safely:", e);
      }
    }
    globalActiveUtterances.length = 0;

    activeAudiosRef.current.forEach(audio => {
      try {
        audio.pause();
        audio.currentTime = 0;
        audio.src = '';
      } catch (e) {}
    });
    activeAudiosRef.current = [];

    if (audioIntervalRef.current) {
      clearInterval(audioIntervalRef.current);
      audioIntervalRef.current = null;
    }

    if (isTransitioning) {
      speaking.current = false;
      setCurrentSubtitle("");
    } else {
      endSpeechCleanup();
    }
  }, [endSpeechCleanup]);

  const unlock = useCallback(() => {
    if (typeof window === 'undefined') return;

    if (window.speechSynthesis) {
      try {
        window.speechSynthesis.cancel();
        const trustUtt = new SpeechSynthesisUtterance(' ');
        trustUtt.volume = 0.01;
        trustUtt.rate = 10;
        trustUtt.lang = 'en-US';
        window.speechSynthesis.speak(trustUtt);
      } catch (e) {
        console.warn('[Speech Output] SpeechSynthesis gesture unlock failed:', e);
      }
    }

    try {
      if (!globalAudioRef.current) globalAudioRef.current = new Audio();
      globalAudioRef.current.src = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQQAAAAAAA==';
      globalAudioRef.current.play().catch(() => {});
    } catch (e) {
      console.warn('[Speech Output] HTML5 Audio gesture unlock failed:', e);
    }
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
      console.warn('[Speech Output] Using last-resort voice:', activeVoice?.name ?? 'none');
    }

    setTimeout(() => {
      speaking.current = true;
      if (onStartRef.current) onStartRef.current();

      const cleanText = sanitizeTextForSpeech(text);
      const chunks = chunkText(cleanText, 150);

      if (chunks.length === 0) {
        endSpeechCleanup();
        return;
      }

      globalActiveUtterances.length = 0;

      const speakChunk = (index: number) => {
        if (!speaking.current) return;

        if (index >= chunks.length) {
          endSpeechCleanup();
          return;
        }

        const rawChunk = chunks[index].trim();
        if (!rawChunk) {
          speakChunk(index + 1);
          return;
        }

        const utt = new SpeechSynthesisUtterance(rawChunk);
        utt.volume = 1;
        utt.rate = isMobile ? 1.0 : 0.95;
        utt.pitch = 1.0;
        utt.lang = activeVoice?.lang ?? 'en-GB';
        if (activeVoice) utt.voice = activeVoice;

        globalActiveUtterances.push(utt);

        utt.onstart = () => setCurrentSubtitle(rawChunk);
        utt.onboundary = () => {
          if (onBoundaryRef.current) onBoundaryRef.current(0.3 + Math.random() * 0.55);
        };
        utt.onend = () => speakChunk(index + 1);
        utt.onerror = () => speakChunk(index + 1);

        try {
          window.speechSynthesis.speak(utt);
        } catch (e) {
          console.warn("[Speech Output] Synchronous speak error handled safely:", e);
          speakChunk(index + 1);
        }
      };

      speakChunk(0);
    }, 0);
  }, [cancel, isMobile, endSpeechCleanup]);

  // ─── Play one ready ElevenLabs audio blob ───────────────────
  // Single audio element, single object URL. Animates the boundary callback
  // while it plays and cleans up on end/error/cancel.
  const playAudioBlobUrl = useCallback((audioUrl: string, subtitle: string) => {
    if (!speaking.current) {
      try { URL.revokeObjectURL(audioUrl); } catch (_) {}
      return;
    }

    setCurrentSubtitle(subtitle);

    if (!globalAudioRef.current) globalAudioRef.current = new Audio();
    const audio = globalAudioRef.current;
    audio.src = audioUrl;
    activeAudiosRef.current = [audio];

    const finish = () => {
      try { URL.revokeObjectURL(audioUrl); } catch (_) {}
      if (audioIntervalRef.current) {
        clearInterval(audioIntervalRef.current);
        audioIntervalRef.current = null;
      }
      speaking.current = false;
      setCurrentSubtitle("");
      if (onEndRef.current) onEndRef.current();
    };

    if (audioIntervalRef.current) clearInterval(audioIntervalRef.current);
    audioIntervalRef.current = setInterval(() => {
      if (onBoundaryRef.current && speaking.current) {
        onBoundaryRef.current(0.3 + Math.random() * 0.55);
      }
    }, 80);

    audio.onended = finish;
    audio.onerror = finish;
    audio.play().catch((err) => {
      console.warn('[Speech Output] HTML5 audio playback error:', err);
      finish();
    });
  }, []);

  // ─── ELEVENLABS (edge → direct → native), ONE request per reply ───
  // ROOT-CAUSE FIX: the previous version split each reply into ~150-char chunks
  // and fired them as PARALLEL edge-function invocations. Under the edge
  // runtime's cold-start / recycle behaviour, a burst of concurrent calls hits
  // instances that are booting or shutting down, so a fraction return non-2xx —
  // and a single rejected chunk dropped the whole reply to the native voice
  // (~50% success). We now send ONE request for the full reply (ElevenLabs
  // handles long text), so there is no concurrency to fail on.
  const doSpeakElevenLabs = useCallback(async (text: string) => {
    cancel(true);

    setTimeout(async () => {
      speaking.current = true;
      if (onStartRef.current) onStartRef.current();

      const cleanText = sanitizeTextForSpeech(text);
      if (!cleanText) {
        endSpeechCleanup();
        return;
      }

      // 1) PRIMARY — edge function, single request. Returns { audio: base64_mp3 }.
      try {
        const { data, error } = await supabase.functions.invoke('jarvis-brain', {
          body: { tool: 'tts', args: { text: cleanText } },
        });
        if (error) throw error;
        if (!data?.audio) throw new Error(data?.error ?? 'No audio returned');
        playAudioBlobUrl(base64ToBlobUrl(data.audio), cleanText);
        return;
      } catch (edgeError) {
        console.warn('[Speech Engine] Edge ElevenLabs failed, trying direct call:', edgeError);
      }

      // 2) STOPGAP — direct browser call, only if a client-side key exists.
      const directKey = resolveElevenLabsKey();
      if (directKey) {
        try {
          const response = await fetch(
            `https://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICE_ID}`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'xi-api-key': directKey,
              },
              body: JSON.stringify({
                text: cleanText,
                model_id: 'eleven_multilingual_v2',
                voice_settings: {
                  stability: 0.35,
                  similarity_boost: 0.9,
                  style: 0.1,
                  use_speaker_boost: true,
                },
              }),
            },
          );
          if (!response.ok) throw new Error(`ElevenLabs error: ${response.status}`);
          const blob = await response.blob();
          playAudioBlobUrl(URL.createObjectURL(blob), cleanText);
          return;
        } catch (directError) {
          console.warn('[Speech Engine] Direct ElevenLabs failed:', directError);
        }
      }

      // 3) LAST RESORT — native browser voice.
      console.warn('[Speech Engine] ElevenLabs unavailable, falling back to native.');
      const voices = await loadVoices();
      const fallbackVoice = voiceCache ?? findBestVoice(voices);
      if (fallbackVoice) voiceCache = fallbackVoice;
      doSpeakNative(text, fallbackVoice || null);
    }, 0);
  }, [cancel, doSpeakNative, endSpeechCleanup, playAudioBlobUrl]);

  const speak = useCallback(async (text: string) => {
    doSpeakElevenLabs(text);
  }, [doSpeakElevenLabs]);

  return { speak, cancel, unlock, isSpeaking: () => speaking.current, currentSubtitle };
}
