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
      // 1. Append user turn
      history.current.push({
        role: 'user',
        parts: [{ text: userText }],
        timestamp: Date.now(),
      });

      // 2. Enforce sliding window limits (ensuring we always start with a user turn)
      const maxItems = DEFAULT_MAX_HISTORY * 2;
      if (history.current.length > maxItems) {
        history.current = history.current.slice(-maxItems);
        // If slicing left us starting with a model turn, discard it to preserve schema rules
        if (history.current[0]?.role === 'model') {
          history.current.shift();
        }
      }

      // 3. Self-Healing Normalizer: Collapses consecutive identical roles
      const cleanHistory: JarvisMessage[] = [];
      for (const turn of history.current) {
        if (cleanHistory.length === 0) {
          if (turn.role === 'user') {
            cleanHistory.push(turn);
          }
        } else {
          const lastTurn = cleanHistory[cleanHistory.length - 1];
          if (lastTurn.role !== turn.role) {
            cleanHistory.push(turn);
          } else {
            // Overwrite consecutive user queries with the latest one
            if (turn.role === 'user') {
              cleanHistory[cleanHistory.length - 1] = turn;
            }
          }
        }
      }
      history.current = cleanHistory;

      // 4. Inject Dynamic time context
      const now = new Date();
      const timeContext = `
[SYSTEM TIME & DATE CONTEXT]
- Current Local Time: ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
- Current Date: ${now.toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
- Current Year: ${now.getFullYear()}
- Current Timezone: ${Intl.DateTimeFormat().resolvedOptions().timeZone}
- Note: Always refer strictly to these metrics if the user asks for the current time, date, or day.
`;

      const payload = {
        systemInstruction: { 
          parts: [{ text: `${JARVIS_SYSTEM_PROMPT}\n${timeContext}` }] 
        },
        contents: history.current.map(({ role, parts }) => ({ role, parts })),
        generationConfig: { maxOutputTokens: 220, temperature: 0.75 },
      };

      const res = await fetch(GEMINI_ENDPOINT(apiKey), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errText = await res.text();
        // In-depth telemetry logger to inspect physical payload errors in developer tools
        console.error('[Jarvis] Gemini API detailed payload failure:', {
          status: res.status,
          statusText: res.statusText,
          errorResponse: errText,
          sentPayload: payload,
          apiEndpoint: GEMINI_ENDPOINT(apiKey)
        });
        throw new Error(`Gemini error ${res.status}: ${errText}`);
      }

      const data = await res.json();
      
      // Use logical OR (||) fallback to catch falsy empty strings ("") safely
      const reply: string =
        data?.candidates?.[0]?.content?.parts?.[0]?.text || 'Standing by, sir.';

      // 5. Append model turn to history
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
