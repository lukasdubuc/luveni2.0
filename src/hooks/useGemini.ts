// ─────────────────────────────────────────────────────────────
//  J.A.R.V.I.S — Luveni GM  |  hooks/useGemini.ts
// ─────────────────────────────────────────────────────────────

import { useRef, useCallback } from 'react';
import type { JarvisMessage } from '../types/jarvis';
import { MISTRAL_ENDPOINT, JARVIS_SYSTEM_PROMPT } from '../lib/jarvis-config';

export function useGemini(apiKey: string) {
  const history = useRef<JarvisMessage[]>([]);

  const ask = useCallback(
    async (userText: string, onChunk?: (text: string) => void): Promise<string> => {
      history.current.push({
        role: 'user',
        parts: [{ text: userText }],
        timestamp: Date.now(),
      });

      const payload = {
        model: 'mistral-small-latest',
        stream: true,
        messages: [
          { role: 'system', content: JARVIS_SYSTEM_PROMPT },
          ...history.current.map((h) => ({
            role: h.role === 'model' ? 'assistant' : 'user',
            content: h.parts[0].text,
          })),
        ],
        temperature: 0.75,
      };

      const res = await fetch(MISTRAL_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const body = await res.text();
        throw new Error(`API error ${res.status}: ${body}`);
      }

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let fullReply = '';
      let buffer = '';

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';

          for (const line of lines) {
            const clean = line.trim();
            if (!clean || !clean.startsWith('data: ') || clean.includes('[DONE]')) continue;
            try {
              const parsed = JSON.parse(clean.slice(6));
              const content = parsed.choices?.[0]?.delta?.content;
              if (content) {
                fullReply += content;
                onChunk?.(content);
              }
            } catch (_) {}
          }
        }

        // flush remainder
        if (buffer.trim().startsWith('data: ') && !buffer.includes('[DONE]')) {
          try {
            const parsed = JSON.parse(buffer.trim().slice(6));
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) { fullReply += content; onChunk?.(content); }
          } catch (_) {}
        }
      }

      history.current.push({
        role: 'model',
        parts: [{ text: fullReply }],
        timestamp: Date.now(),
      });

      return fullReply;
    },
    [apiKey]
  );

  const reset = useCallback(() => { history.current = []; }, []);

  return { ask, reset };
}
