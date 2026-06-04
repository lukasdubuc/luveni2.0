// ─────────────────────────────────────────────────────────────
//  J.A.R.V.I.S — Luveni GM  |  hooks/useGemini.ts
// ─────────────────────────────────────────────────────────────

import { useRef, useCallback } from 'react';
import type { JarvisMessage } from '../types/jarvis';
import { GEMINI_ENDPOINT, JARVIS_SYSTEM_PROMPT } from '../lib/jarvis-config';

export function useGemini(apiKey: string) {
  const history = useRef<JarvisMessage[]>([]);

  const ask = useCallback(async (userText: string, onChunk?: (text: string) => void): Promise<string> => {
    history.current.push({ role: 'user', parts: [{ text: userText }], timestamp: Date.now() });

    const activeKey = apiKey || "P00nSEM2W2H1qV0KuvyonA08Ns1tV0hL";
    const payload = {
      model: "mistral-small",
      stream: true,
      messages: [
        { role: "system", content: JARVIS_SYSTEM_PROMPT }, 
        ...history.current.map(h => ({ 
          role: h.role === 'model' ? 'assistant' : 'user', 
          content: h.parts[0].text 
        }))
      ],
      temperature: 0.75,
    };

    const res = await fetch(GEMINI_ENDPOINT(activeKey), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${activeKey}` },
      body: JSON.stringify(payload),
    });

    if (!res.ok) throw new Error(`API error ${res.status}`);
    const reader = res.body?.getReader();
    const decoder = new TextDecoder();
    let fullReply = "";
    let buffer = "";

    if (reader) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        
        // Save incomplete line back to the buffer
        buffer = lines.pop() || "";

        for (const line of lines) {
          const cleanLine = line.trim();
          if (!cleanLine) continue;
          if (cleanLine.startsWith('data: ') && !cleanLine.includes('[DONE]')) {
            try {
              const dataContent = cleanLine.slice(6).trim();
              const parsed = JSON.parse(dataContent);
              const content = parsed.choices?.[0]?.delta?.content;
              if (content) { 
                fullReply += content; 
                if (onChunk) onChunk(content); 
              }
            } catch (e) {
              // Ignore partial JSON parsing errors
            }
          }
        }
      }

      // Process remainder if present
      if (buffer.trim().startsWith('data: ') && !buffer.includes('[DONE]')) {
        try {
          const dataContent = buffer.trim().slice(6).trim();
          const parsed = JSON.parse(dataContent);
          const content = parsed.choices?.[0]?.delta?.content;
          if (content) {
            fullReply += content;
            if (onChunk) onChunk(content);
          }
        } catch (e) {}
      }
    }

    history.current.push({ role: 'model', parts: [{ text: fullReply }], timestamp: Date.now() });
    return fullReply;
  }, [apiKey]);

  return { ask, reset: () => { history.current = []; } };
}
