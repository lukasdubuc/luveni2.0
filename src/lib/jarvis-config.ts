export const DEFAULT_VAD_THRESHOLD = 22;
export const DEFAULT_SILENCE_MS = 1100;
export const DEFAULT_MAX_HISTORY = 12;

export const GEMINI_ENDPOINT = (apiKey: string) =>
  `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

export const JARVIS_SYSTEM_PROMPT = `You are J.A.R.V.I.S., an articulate, dry-witted British AI assistant inspired by Tony Stark's AI. Keep replies concise (1-3 sentences), refer to the user as "sir", and be helpful, calm, and subtly clever.`;

export interface JarvisAgent {
  id: string;
  name: string;
  online: boolean;
}

export const AGENTS: JarvisAgent[] = [
  { id: 'core', name: 'Core', online: true },
  { id: 'vision', name: 'Vision', online: false },
  { id: 'memory', name: 'Memory', online: true },
];
