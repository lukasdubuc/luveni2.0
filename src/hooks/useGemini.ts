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
            if (turn.role === 'user') {
              cleanHistory[cleanHistory.length - 1] = turn;
            }
          }
        }
      }
      history.current = cleanHistory;

      // 4. Universally-compatible Date & Time construction (No RangeError risks)
      const now = new Date();
      const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
      
      const dayName = days[now.getDay()];
      const monthName = months[now.getMonth()];
      const dateNum = now.getDate();
      const year = now.getFullYear();
      
      let hours = now.getHours();
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12;
      hours = hours ? hours : 12; // convert 0 to 12
      
      const timeString = `${hours}:${minutes} ${ampm}`;
      const dateString = `${dayName}, ${monthName} ${dateNum}, ${year}`;

      const timeContext = `
[SYSTEM TIME & DATE CONTEXT]
- Current Local Time: ${timeString}
- Current Date: ${dateString}
- Current Year: ${year}
- Current Timezone: ${Intl.DateTimeFormat().resolvedOptions().timeZone}
- Note: Refer strictly to these variables if the user asks for the current time, date, or day.
`;

      // 5. Environment Resolver
      // Reads VITE_GEMINI_API_KEY first, falling back to the dynamically loaded database prop
      const envKey = import.meta.env.VITE_GEMINI_API_KEY;
      const activeKey = (envKey && envKey.startsWith('AQ.')) ? envKey : apiKey;

      const payload = {
        systemInstruction: { 
          parts: [{ text: `${JARVIS_SYSTEM_PROMPT}\n${timeContext}` }] 
        },
        contents: history.current.map(({ role, parts }) => ({ role, parts })),
        generationConfig: { maxOutputTokens: 220, temperature: 0.75 },
      };

      // Perform direct fetch to Google using the resolved secure key
      const res = await fetch(GEMINI_ENDPOINT(activeKey), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errText = await res.text();
        console.error('[Jarvis] Gemini API payload failure:', {
          status: res.status,
          errorResponse: errText,
          sentPayload: payload,
        });
        throw new Error(`Gemini error ${res.status}: ${errText}`);
      }

      const data = await res.json();
      
      const reply: string =
        data?.candidates?.[0]?.content?.parts?.[0]?.text || 'Standing by, sir.';

      // 6. Append model turn to history
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
