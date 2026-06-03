// ─────────────────────────────────────────────────────────────
//  J.A.R.V.I.S — Luveni GM  |  hooks/useGemini.ts
// ─────────────────────────────────────────────────────────────

import { useRef, useCallback } from 'react';
import type { JarvisMessage } from '../types/jarvis';
import { supabase } from "@/integrations/supabase/client";
import {
  JARVIS_SYSTEM_PROMPT,
  DEFAULT_MAX_HISTORY,
} from '../lib/jarvis-config';

export function useGemini() {
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

      const systemPrompt = `${JARVIS_SYSTEM_PROMPT}\n${timeContext}`;
      const mappedHistory = history.current.map(({ role, parts }) => ({ role, parts }));

      // Helper to attempt Edge Function execution securely
      const invokeEdgeFunction = async (name: string) => {
        try {
          const { data, error } = await supabase.functions.invoke(name, {
            body: {
              message: userText,
              history: mappedHistory,
              systemPrompt: systemPrompt
            }
          });
          if (error) throw error;
          return data;
        } catch (err) {
          console.warn(`[Jarvis] Failed invoking edge function '${name}':`, err);
          return null;
        }
      };

      // 5. Invoke standard Lovable backend 'gemini' proxy first [1]
      let data = await invokeEdgeFunction('gemini');

      // Fallback to 'chat-with-gemini' if the primary function is named differently
      if (!data) {
        console.log('[Jarvis] Primary proxy failed. Attempting fallback route...');
        data = await invokeEdgeFunction('chat-with-gemini');
      }

      if (!data) {
        throw new Error("Unable to reach any secure backend Edge Functions. Verify your functions are deployed.");
      }

      const reply: string =
        data?.text || 
        data?.reply || 
        (typeof data === 'string' ? data : 'Standing by, sir.');

      // 6. Append model turn to history
      history.current.push({
        role: 'model',
        parts: [{ text: reply }],
        timestamp: Date.now(),
      });

      return reply;
    },
    []
  );

  const reset = useCallback(() => {
    history.current = [];
  }, []);

  return { ask, reset, history: history.current };
}
