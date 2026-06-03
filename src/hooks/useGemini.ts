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

      const now = new Date();
      const timeContext = `
[SYSTEM CONTEXT]
- Current Local Time: ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
- Current Date: ${now.toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
`;

      // Helper function to handle fallback requests if web tools fail
      const executeRequest = async (useWebGrounding: boolean) => {
        const payload: any = {
          systemInstruction: { parts: [{ text: `${JARVIS_SYSTEM_PROMPT}\n${timeContext}` }] },
          contents: history.current.map(({ role, parts }) => ({ role, parts })),
          generationConfig: { maxOutputTokens: 220, temperature: 0.75 },
        };

        if (useWebGrounding) {
          payload.tools = [{ googleSearch: {} }];
        }

        return await fetch(GEMINI_ENDPOINT(apiKey), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      };

      let res;
      try {
        // Attempt request with real-time Google Search grounding
        res = await executeRequest(true);
        
        // If web grounding is unsupported, fallback to standard generation
        if (!res.ok && (res.status === 400 || res.status === 403)) {
          console.warn('[Jarvis] Google Search grounding failed or unsupported. Falling back...');
          res = await executeRequest(false);
        }
      } catch (err) {
        console.warn('[Jarvis] Network error during grounding request. Falling back...', err);
        res = await executeRequest(false);
      }

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Gemini API Error [${res.status}]: ${errText}`);
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
