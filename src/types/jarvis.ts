export type OrbState = 'idle' | 'listening' | 'thinking' | 'speaking' | 'error';

export interface JarvisMessage {
  role: 'user' | 'model';
  parts: { text: string }[];
  timestamp: number;
}

// Minimal Web Speech API types (browser-only)
declare global {
  interface SpeechRecognition extends EventTarget {
    continuous: boolean;
    interimResults: boolean;
    lang: string;
    onresult: ((e: any) => void) | null;
    onerror: ((e: Event) => void) | null;
    onend: (() => void) | null;
    start(): void;
    stop(): void;
  }
}
