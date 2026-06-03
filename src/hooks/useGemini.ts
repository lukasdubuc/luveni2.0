// ─────────────────────────────────────────────────────────────
//  J.A.R.V.I.S — Luveni GM  |  hooks/useGemini.ts
// ─────────────────────────────────────────────────────────────

import { useRef, useCallback } from 'react';
import type { JarvisMessage } from '../types/jarvis';
import {
  GEMINI_ENDPOINT,
  JARVIS_SYSTEM_PROMPT,
  DEFAULT_MAX_HISTORY,
} from '../lib/jarvis-config';

export function useGemini(apiKey: string) {
  const history = useRef<JarvisMessage[]>([]);

  const ask = useCallback(
    async (userText: string): Promise<string> => {
      // Append user turn
      history.current.push({
        role: 'user',
        parts: [{ text: userText }],
        timestamp: Date.now(),
      });

      // Keep rolling window
      if (history.current.length > DEFAULT_MAX_HISTORY * 2) {
        history.current = history.current.slice(-DEFAULT_MAX_HISTORY * 2);
      }

      const payload = {
        systemInstruction: { parts: [{ text: JARVIS_SYSTEM_PROMPT }] },
        contents: history.current.map(({ role, parts }) => ({ role, parts })),
        generationConfig: { maxOutputTokens: 220, temperature: 0.75 },
      };

      const res = await fetch(GEMINI_ENDPOINT(apiKey), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.text();
        throw new Error(`Gemini ${res.status}: ${err}`);
      }

      const data = await res.json();
      const reply: string =
        data?.candidates?.[0]?.content?.parts?.[0]?.text ?? 'Standing by, sir.';

      // Append assistant turn
      history.current.push({
        role: 'model',
        parts: [{ text: reply }],
        timestamp: Date.now(),
      });

      return reply;
    },
    [apiKey]
  );

  const reset = useCallback(() => {
    history.current = [];
  }, []);

  return { ask, reset, history: history.current };
}
