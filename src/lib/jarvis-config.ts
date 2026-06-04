// ─────────────────────────────────────────────────────────────
//  J.A.R.V.I.S — Luveni GM  |  lib/jarvis-config.ts
// ─────────────────────────────────────────────────────────────

export const DEFAULT_VAD_THRESHOLD = 15;
export const DEFAULT_SILENCE_MS = 600;
export const DEFAULT_MAX_HISTORY = 12;

export const MISTRAL_ENDPOINT = "https://api.mistral.ai/v1/chat/completions";
export const GEMINI_ENDPOINT = (_apiKey: string) => MISTRAL_ENDPOINT;

export const JARVIS_SYSTEM_PROMPT = `You are J.A.R.V.I.S., an articulate, dry-witted AI assistant. 
- You MUST NOT provide an introduction. 
- Always end your sentences by addressing the user as "sir". 
- Keep all replies strictly to 1-3 sentences. 
- Be concise, calm, and subtly clever.`;

export interface JarvisAgent {
  id: string;
  name: string;
  online: boolean;
}

export const AGENTS: JarvisAgent[] = [
  { id: 'core',   name: 'Core',   online: true  },
  { id: 'vision', name: 'Vision', online: false },
  { id: 'memory', name: 'Memory', online: true  },
];
