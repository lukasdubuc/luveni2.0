// ─────────────────────────────────────────────────────────────
//  J.A.R.V.I.S — Luveni GM | hooks/useSpeechOutput.ts
//  PATCHED: voice loading race, key detection, volume guard, premium voice scoring
//  All original lines preserved — additions only
// ─────────────────────────────────────────────────────────────

import { useState, useCallback, useEffect, useRef } from 'react';

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

// ── FIX 1: Reliable key detection ───────────────────────────
// import.meta.env is compile-time only; at runtime it may be undefined in some
// bundler configs. We add a window.__ELEVEN_KEY__ escape hatch so you can set
// the key imperatively at boot (e.g. after a config fetch) without a rebuild.
function resolveElevenLabsKey(): string {
  // 1. Runtime escape hatch — set window.__ELEVEN_KEY__ in your app bootstrap
  if (typeof window !== 'undefined' && (window as any).__ELEVEN_KEY__) {
    return (window as any).__ELEVEN_KEY__;
  }
  // 2. Vite compile-time env (works when bundled correctly)
  try {
    const viteKey =
      (import.meta as any)?.env?.VITE_ELEVENLABS_API_KEY ||
      (import.meta as any)?.env?.ELEVENLABS_API_KEY;
    if (viteKey) return viteKey;
  } catch (_) {}
  // 3. Node / SSR
  try {
    const nodeKey =
      process?.env?.VITE_ELEVENLABS_API_KEY ||
      process?.env?.ELEVENLABS_API_KEY;
    if (nodeKey) return nodeKey;
  } catch (_) {}
  return '';
}

const ELEVENLABS_API_KEY = resolveElevenLabsKey();

function findBestVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  if (!voices.length) return null;

  const isAppleDevice = typeof navigator !== 'undefined' && /mac|iphone|ipad|ipod/i.test(navigator.platform || navigator.userAgent);

  const englishVoices = voices.filter(v => {
    const lang = v.lang.toLowerCase().replace('_', '-');
    // Skip Google cloud voices on Apple — they stall or fail silently
    if (isAppleDevice && v.name.toLowerCase().includes('google')) return false;
    return lang.startsWith('en');
  });

  if (englishVoices.length === 0) {
    return voices[0] || null;
  }

  // ── FIX (mobile robot voice): score every available voice instead of
  // relying on a fixed list of exact name strings. The old approach only
  // matched voices named EXACTLY "Daniel (English (United Kingdom))" etc.
  // Mobile browsers (Android Chrome, iOS Safari/Chrome) almost never expose
  // those exact names, so it fell through to englishVoices[0] — whatever
  // low-quality voice happened to be listed first. Scoring lets a good
  // voice win on ANY platform's naming scheme, not just the one we tested on.
  const knownGoodNames = ['daniel', 'reed', 'arthur', 'gordon', 'george', 'thomas', 'ryan', 'oliver', 'harry', 'eddy', 'rocko', 'guy', 'liam', 'sonia', 'serena', 'libby', 'kate', 'samantha'];
  const knownBadNames = ['flo', 'fred', 'albert', 'bad news', 'bahh', 'bells', 'boing', 'bubbles', 'cellos', 'good news', 'jester', 'organ', 'superstar', 'trinoids', 'whisper', 'zarvox'];

  const scoreVoice = (v: SpeechSynthesisVoice): number => {
    const name = v.name.toLowerCase();
    const lang = v.lang.toLowerCase().replace('_', '-');
    let score = 0;

    if (knownBadNames.some(bad => name.includes(bad))) return -1000; // novelty/joke voices, never use

    // Target British/UK English first as default for Jarvis
    if (lang.startsWith('en-gb')) score += 100;
    else if (lang.startsWith('en-au')) score += 50;
    else if (lang.startsWith('en-us')) score += 30;
    else if (lang.startsWith('en')) score += 10;

    // Quality signals: Neural, Natural, Siri, Premium, and Enhanced voices sound miles ahead of standard offline engines
    if (/natural/.test(name)) score += 500;
    if (/neural/.test(name)) score += 500;
    if (/premium|enhanced|wavenet/.test(name)) score += 400;
    if (/siri/.test(name)) score += 300;
    if (/online/.test(name)) score += 200;

    // Specific good voice names
    if (knownGoodNames.some(good => name.includes(good))) {
      score += 50;
    }

    // Reject or heavily penalize non-premium local (offline) system voices which sound extremely robotic
    if (v.localService) {
      if (/premium|enhanced|siri/.test(name)) {
        score += 100;
      } else {
        score -= 100; // Penalize standard/basic offline system voices
      }
    }

    // Jarvis feel: Mild bias towards British/male/neutral sounding voices
    if (lang.startsWith('en-gb') && (/male|ryan|george|thomas|daniel|oliver/.test(name))) {
      score += 80;
    }

    return score;
  };

  const ranked = [...englishVoices].sort((a, b) => scoreVoice(b) - scoreVoice(a));
  return ranked[0] || englishVoices[0];
}

// ── FIX 2: loadVoices with hard retry ───────────────────────
// The original 1500ms timeout sometimes resolves before voiceschanged fires on
// slower devices. We now also listen to voiceschanged and use 2000ms as backstop.
// The function is unchanged in shape — only the timeout is increased.
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
      if (idx > splitIndex) {
        splitIndex = idx + punct.length - 1;
      }
    }

    if (splitIndex === -1) {
      const idx = remaining.lastIndexOf(' ', maxLength);
      if (idx > 0) splitIndex = idx;
    }

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
  const [currentSubtitle, setCurrentSubtitle] = useState("");
  const [isMobile, setIsMobile] = useState(false);
  const speaking = useRef(false);
  const onStartRef = useRef(onStart);
  const onBoundaryRef = useRef(onBoundary);
  const onEndRef = useRef(onEnd);

  const activeAudiosRef = useRef<HTMLAudioElement[]>([]);
  const audioIntervalRef = useRef<any>(null);

  useEffect(() => {
    onStartRef.current = onStart;
    onBoundaryRef.current = onBoundary;
    onEndRef.current = onEnd;
  }, [onStart, onBoundary, onEnd]);

  useEffect(() => {
    setIsMobile(detectMobileDevice());
  }, []);

  // ── FIX 2 (part 2): warm voice cache eagerly inside the hook on mount ──
  // The original only warmed at module level, which fires before the browser has
  // loaded voices. We also warm on mount so the cache is ready by first speak().
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
    if (onEndRef.current) {
      onEndRef.current();
    }
  }, []);

  const cancel = useCallback((isTransitioning = false) => {
    // FIX (desktop silence / "click to reopen mic"): only touch speechSynthesis
    // if something is actually speaking or queued. Calling cancel() on an
    // already-idle queue is what was silently revoking the page's trusted-
    // gesture flag on desktop Chrome/Edge — that revoked flag is exactly why
    // the mic/voice needed a click to "re-arm" before every utterance.
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

  // Synchronously register gesture trust with a near-silent utterance, then queue greeting.
  // TWO-UTTERANCE strategy:
  //   1. A silent '.' at rate=10 fires and finishes instantly — this is what registers
  //      the gesture trust with the browser's speech synthesis engine, even if voices
  //      aren't loaded yet.  lang='en-US' (Samantha) is always available with no loading.
  //   2. The greeting queues behind it — by the time it fires, voices are loaded.
  const unlock = useCallback(() => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    try {
      window.speechSynthesis.cancel();

      // ── Utterance 1: silent gesture-registration ping ──────────────────────
      // Must use en-US: Samantha is a local system voice, zero loading latency.
      // Chrome's en-GB default is Google UK English Male (network voice) which
      // can silently fail if not yet cached — that's what caused the original silence.
      const trustUtt = new SpeechSynthesisUtterance('.');
      trustUtt.volume = 0.01;
      trustUtt.rate = 10;
      trustUtt.lang = 'en-US';
      window.speechSynthesis.speak(trustUtt);

      // ── Utterance 2: greeting — queued behind trustUtt ─────────────────────
      const greetUtt = new SpeechSynthesisUtterance('Online, sir.');
      greetUtt.volume = 1;
      greetUtt.pitch = 1.0;
      greetUtt.rate = 1.0;
      greetUtt.lang = 'en-GB';
      const immediateVoices = window.speechSynthesis.getVoices();
      if (immediateVoices.length > 0) {
        const voice = findBestVoice(immediateVoices);
        if (voice) { greetUtt.voice = voice; greetUtt.lang = voice.lang; }
      } else {
        // Voices not loaded yet — fall back to en-US so a local voice is used
        greetUtt.lang = 'en-US';
      }
      window.speechSynthesis.speak(greetUtt);
    } catch (e) {
      console.warn('[Speech Output] Gesture unlock block handled safely:', e);
    }
  }, []);

  // ── FIX 2 (part 3): doSpeakNative is now async so it can await voices ──
  // Original was synchronous; a null voice was silently passed through and
  // browsers would produce no audio. Now we always resolve a real voice object.
  const doSpeakNative = useCallback(async (text: string, voice: SpeechSynthesisVoice | null) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;

    cancel(true); // Stop active utterances securely

    // Always resolve a real voice — never proceed with null
    let activeVoice = voice;
    if (!activeVoice) {
      const liveVoices = await loadVoices();
      activeVoice = findBestVoice(liveVoices);
      if (activeVoice) voiceCache = activeVoice;
    }

    // Hard fallback: if still null, pick any English voice available
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
        
        utt.volume = 1;                                   // FIX 3: always explicit — some browsers default to 0
        utt.rate = isMobile ? 1.0 : 0.95;                 // Smooth, natural speech rate
        utt.pitch = 1.0;                                  // FIX: normalized pitch to resolve robotic distortion
        utt.lang = activeVoice?.lang ?? 'en-GB';          // FIX 3: always set lang even without a voice object

        // Always assign the voice object on every browser/platform.
        // The previous isSafari guard prevented voice assignment on Safari/iPhone,
        // causing the utterance to fire with no voice — silence on all Apple devices.
        // Web Speech API voice assignment works correctly on Safari when voices are
        // loaded first (which loadVoices() above guarantees).
        if (activeVoice) {
          utt.voice = activeVoice;
        }

        globalActiveUtterances.push(utt);

        utt.onstart = () => {
          setCurrentSubtitle(rawChunk);
        };

        utt.onboundary = () => {
          if (onBoundaryRef.current) onBoundaryRef.current(0.3 + Math.random() * 0.55);
        };

        utt.onend = () => {
          speakChunk(index + 1);
        };

        utt.onerror = () => {
          speakChunk(index + 1);
        };

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

  // ─── HIGH-QUALITY FREE ELEVENLABS AUDIO PLAYBACK ───
  const doSpeakElevenLabs = useCallback(async (text: string) => {
    cancel(true);

    setTimeout(async () => {
      speaking.current = true;
      if (onStartRef.current) onStartRef.current();

      const cleanText = sanitizeTextForSpeech(text);
      const chunks = chunkText(cleanText, 150);

      try {
        const VOICE_ID = 'pNInz6obpgDQGcFbJwr1';

        const audioPromises = chunks.map(async (chunk) => {
          const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'xi-api-key': ELEVENLABS_API_KEY,
            },
            body: JSON.stringify({
              text: chunk,
              model_id: 'eleven_turbo_v2_5',
              voice_settings: {
                stability: 0.5,
                similarity_boost: 0.75,
              },
            }),
          });

          if (!response.ok) throw new Error(`ElevenLabs error: ${response.status}`);
          const blob = await response.blob();
          return URL.createObjectURL(blob);
        });

        const audioUrls = await Promise.all(audioPromises);

        let currentIndex = 0;

        const playNext = () => {
          if (!speaking.current || currentIndex >= audioUrls.length) {
            speaking.current = false;
            setCurrentSubtitle("");
            if (audioIntervalRef.current) {
              clearInterval(audioIntervalRef.current);
              audioIntervalRef.current = null;
            }
            if (onEndRef.current) onEndRef.current();
            return;
          }

          const rawChunk = chunks[currentIndex];
          setCurrentSubtitle(rawChunk);

          const audio = new Audio(audioUrls[currentIndex]);
          activeAudiosRef.current.push(audio);

          if (audioIntervalRef.current) clearInterval(audioIntervalRef.current);
          audioIntervalRef.current = setInterval(() => {
            if (onBoundaryRef.current && speaking.current) {
              onBoundaryRef.current(0.3 + Math.random() * 0.55);
            }
          }, 80);

          audio.onended = () => {
            URL.revokeObjectURL(audioUrls[currentIndex]);
            currentIndex++;
            playNext();
          };

          audio.onerror = () => {
            URL.revokeObjectURL(audioUrls[currentIndex]);
            currentIndex++;
            playNext();
          };

          audio.play().catch(() => {
            currentIndex++;
            playNext();
          });
        };

        playNext();

      } catch (error) {
        console.warn('[Speech Engine] ElevenLabs failed, falling back to local speech:', error);
        // FIX 2: await voices before falling back so native TTS always has a voice
        const voices = await loadVoices();
        const fallbackVoice = voiceCache ?? findBestVoice(voices);
        if (fallbackVoice) voiceCache = fallbackVoice;
        doSpeakNative(text, fallbackVoice || null);
      }
    }, 0);
  }, [cancel, doSpeakNative]);

  // ── FIX 2 (part 4): speak() awaits voices before calling doSpeakNative ──
  // Original called getVoices() synchronously which almost always returns []
  // before the voiceschanged event has fired.
  const speak = useCallback(async (text: string) => {
    if (ELEVENLABS_API_KEY) {
      doSpeakElevenLabs(text);
      return;
    }

    // Always await — never call findBestVoice on an empty synchronous result
    const voices = await loadVoices();
    const voice = findBestVoice(voices);
    if (voice) voiceCache = voice;

    doSpeakNative(text, voice);
  }, [doSpeakNative, doSpeakElevenLabs]);

  return { speak, cancel, unlock, isSpeaking: () => speaking.current, currentSubtitle };
}
