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
    async (userText: string, onChunk?: (text: string) => void): Promise<string> => {
      history.current.push({
        role: 'user',
        parts: [{ text: userText }],
        timestamp: Date.now(),
      });

      const maxItems = DEFAULT_MAX_HISTORY * 2;
      if (history.current.length > maxItems) {
        history.current = history.current.slice(-maxItems);
        if (history.current[0]?.role === 'model') history.current.shift();
      }

      const cleanHistory: JarvisMessage[] = [];
      for (const turn of history.current) {
        if (cleanHistory.length === 0) {
          if (turn.role === 'user') cleanHistory.push(turn);
        } else {
          const lastTurn = cleanHistory[cleanHistory.length - 1];
          if (lastTurn.role !== turn.role) cleanHistory.push(turn);
          else if (turn.role === 'user') cleanHistory[cleanHistory.length - 1] = turn;
        }
      }
      history.current = cleanHistory;

      const now = new Date();
      const timeContext = `[SYSTEM TIME: ${now.toLocaleTimeString()}, DATE: ${now.toLocaleDateString()}]`;

      const activeKey = "P00nSEM2W2H1qV0KuvyonA08Ns1tV0hL";
      const payload = {
        model: "mistral-small",
        stream: true,
        messages: [
          { role: "system", content: `${JARVIS_SYSTEM_PROMPT}\n${timeContext}` },
          ...history.current.map(({ role, parts }) => ({ 
            role: role === 'model' ? 'assistant' : 'user', 
            content: parts[0].text 
          }))
        ],
        temperature: 0.75,
      };

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);

      const res = await fetch(GEMINI_ENDPOINT(activeKey), {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${activeKey}`,
          'Priority': 'high'
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      clearTimeout(timeout);
      if (!res.ok) throw new Error(`API error ${res.status}`);

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let fullReply = "";

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n');
          for (const line of lines) {
            if (line.startsWith('data: ') && !line.includes('[DONE]')) {
              try {
                const json = JSON.parse(line.replace('data: ', ''));
                const content = json.choices[0].delta.content || "";
                fullReply += content;
                if (onChunk) onChunk(content);
              } catch (e) {}
            }
          }
        }
      }

      history.current.push({ role: 'model', parts: [{ text: fullReply }], timestamp: Date.now() });
      return fullReply;
    },
    [apiKey]
  );

  const reset = useCallback(() => { history.current = []; }, []);
  return { ask, reset, history: history.current };
}
