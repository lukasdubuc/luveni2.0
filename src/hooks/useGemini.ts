// ─────────────────────────────────────────────────────────────
//  J.A.R.V.I.S — Luveni GM  |  hooks/useGemini.ts
//  Mistral tool-calling w/ Google Search · Gmail · Drive
//  + live Supabase business data injected into every prompt
// ─────────────────────────────────────────────────────────────
import { useRef, useCallback } from 'react';
import type { JarvisMessage } from '../types/jarvis';
import { MISTRAL_ENDPOINT, JARVIS_SYSTEM_PROMPT } from '../lib/jarvis-config';
import { supabase } from '@/integrations/supabase/client';

// ── Tool definitions Mistral can call ───────────────────────
const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'google_search',
      description:
        'Search the web via Google Custom Search. Use for current events, news, prices, weather, or any question needing up-to-date information.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'The search query' },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'gmail_read',
      description:
        'Read recent emails from Gmail. Use when asked about emails, messages, inbox, or specific senders.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description:
              'Gmail search query, e.g. "from:john@example.com" or "subject:invoice unread"',
          },
          maxResults: {
            type: 'number',
            description: 'Max emails to return (default 5)',
          },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'gmail_send',
      description: 'Send an email via Gmail on behalf of the user.',
      parameters: {
        type: 'object',
        properties: {
          to: { type: 'string', description: 'Recipient email address' },
          subject: { type: 'string', description: 'Email subject' },
          body: { type: 'string', description: 'Plain text email body' },
        },
        required: ['to', 'subject', 'body'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'drive_search',
      description:
        'Search Google Drive for files and documents. Use when asked about files, documents, spreadsheets, or anything stored in Drive.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description:
              'Drive search query, e.g. "name contains \'invoice\'" or "mimeType=\'application/pdf\'"',
          },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'drive_read',
      description: 'Read the text content of a Google Drive file by its file ID.',
      parameters: {
        type: 'object',
        properties: {
          fileId: { type: 'string', description: 'The Google Drive file ID' },
        },
        required: ['fileId'],
      },
    },
  },
];

// ── Types ────────────────────────────────────────────────────
interface StoreSnapshot {
  revenue_today_cents: number;
  revenue_week_cents: number;
  revenue_month_cents: number;
  orders_total: number;
  orders_paid: number;
  orders_pending: number;
  orders_failed: number;
  leads_total: number;
  products_published: number;
  products_total: number;
  recent_orders: { email: string; amount_cents: number; status: string; created_at: string }[];
  top_products: { title: string; revenue: number; units: number }[];
}

interface UseGeminiOptions {
  googleToken?: string | null;
  storeSnapshot?: StoreSnapshot | null;
}

// ── Edge function caller ─────────────────────────────────────
async function callGoogleTool(
  toolName: string,
  toolArgs: Record<string, any>,
  googleToken: string
): Promise<string> {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const supabaseToken = sessionData.session?.access_token;

    const { data, error } = await supabase.functions.invoke('jarvis-google', {
      body: { tool: toolName, args: toolArgs, googleToken },
      headers: supabaseToken
        ? { Authorization: `Bearer ${supabaseToken}` }
        : {},
    });

    if (error) throw error;
    return JSON.stringify(data);
  } catch (e: any) {
    return JSON.stringify({ error: e.message || 'Tool call failed' });
  }
}

// ── Build live context block injected into system prompt ─────
function buildLiveContext(snapshot: StoreSnapshot | null | undefined): string {
  if (!snapshot) return '';

  const fmt = (c: number) => `$${(c / 100).toFixed(2)}`;
  const lines = [
    '--- LIVE STORE DATA (as of right now) ---',
    `Revenue today: ${fmt(snapshot.revenue_today_cents)}`,
    `Revenue this week: ${fmt(snapshot.revenue_week_cents)}`,
    `Revenue this month: ${fmt(snapshot.revenue_month_cents)}`,
    `Orders — paid: ${snapshot.orders_paid} | pending: ${snapshot.orders_pending} | failed: ${snapshot.orders_failed} | total: ${snapshot.orders_total}`,
    `Leads captured: ${snapshot.leads_total}`,
    `Products — published: ${snapshot.products_published} / ${snapshot.products_total} total`,
  ];

  if (snapshot.recent_orders.length > 0) {
    lines.push('Recent orders:');
    snapshot.recent_orders.slice(0, 5).forEach(o => {
      lines.push(`  • ${o.email} — ${fmt(o.amount_cents)} (${o.status}) on ${new Date(o.created_at).toLocaleDateString()}`);
    });
  }

  if (snapshot.top_products.length > 0) {
    lines.push('Top products by revenue:');
    snapshot.top_products.slice(0, 3).forEach(p => {
      lines.push(`  • ${p.title}: ${fmt(p.revenue)} across ${p.units} orders`);
    });
  }

  lines.push('--- END LIVE DATA ---');
  return lines.join('\n');
}

// ── Main hook ────────────────────────────────────────────────
export function useGemini(apiKey: string, options: UseGeminiOptions = {}) {
  const history = useRef<JarvisMessage[]>([]);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const ask = useCallback(
    async (userText: string, onChunk?: (text: string) => void): Promise<string> => {
      const { googleToken, storeSnapshot } = optionsRef.current;

      history.current.push({
        role: 'user',
        parts: [{ text: userText }],
        timestamp: Date.now(),
      });

      // Build system prompt with injected live data
      const liveContext = buildLiveContext(storeSnapshot);
      const systemContent = liveContext
        ? `${JARVIS_SYSTEM_PROMPT}\n\n${liveContext}`
        : JARVIS_SYSTEM_PROMPT;

      // Agentic loop — Mistral may call tools multiple times before final answer
      let loopMessages: { role: string; content: string; tool_calls?: any[]; tool_call_id?: string; name?: string }[] = [
        { role: 'system', content: systemContent },
        ...history.current.map((h) => ({
          role: h.role === 'model' ? 'assistant' : 'user',
          content: h.parts[0].text,
        })),
      ];

      let finalReply = '';
      const MAX_TOOL_ROUNDS = 4;

      for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
        const payload = {
          model: 'mistral-small-latest',
          stream: true,
          messages: loopMessages,
          tools: googleToken ? TOOLS : [],
          tool_choice: googleToken ? 'auto' : 'none',
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

        // Stream the response, collecting both text and tool_calls
        const reader = res.body?.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let roundText = '';
        let toolCalls: any[] = [];

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
                const delta = parsed.choices?.[0]?.delta;
                if (!delta) continue;

                // Accumulate text content
                if (delta.content) {
                  roundText += delta.content;
                  // Only stream text to speech if no tool calls happening
                  if (toolCalls.length === 0) {
                    onChunk?.(delta.content);
                  }
                }

                // Accumulate tool calls (streamed in chunks)
                if (delta.tool_calls) {
                  for (const tc of delta.tool_calls) {
                    const idx = tc.index ?? 0;
                    if (!toolCalls[idx]) {
                      toolCalls[idx] = {
                        id: tc.id || `tool_${idx}`,
                        type: 'function',
                        function: { name: '', arguments: '' },
                      };
                    }
                    if (tc.function?.name) toolCalls[idx].function.name += tc.function.name;
                    if (tc.function?.arguments) toolCalls[idx].function.arguments += tc.function.arguments;
                  }
                }
              } catch (_) {}
            }
          }

          // Flush buffer remainder
          if (buffer.trim().startsWith('data: ') && !buffer.includes('[DONE]')) {
            try {
              const parsed = JSON.parse(buffer.trim().slice(6));
              const delta = parsed.choices?.[0]?.delta;
              if (delta?.content) {
                roundText += delta.content;
                if (toolCalls.length === 0) onChunk?.(delta.content);
              }
            } catch (_) {}
          }
        }

        // No tool calls → this is the final answer
        if (toolCalls.length === 0) {
          finalReply = roundText;
          break;
        }

        // Tool calls requested — execute them all, then loop back
        // Add assistant message with tool_calls to history
        loopMessages.push({
          role: 'assistant',
          content: roundText,
          tool_calls: toolCalls,
        });

        // Execute each tool call in parallel
        const toolResults = await Promise.all(
          toolCalls.map(async (tc) => {
            let args: Record<string, any> = {};
            try { args = JSON.parse(tc.function.arguments); } catch (_) {}

            const result = googleToken
              ? await callGoogleTool(tc.function.name, args, googleToken)
              : JSON.stringify({ error: 'No Google account connected' });

            return {
              role: 'tool' as const,
              tool_call_id: tc.id,
              name: tc.function.name,
              content: result,
            };
          })
        );

        // Add all tool results to message history
        loopMessages.push(...toolResults);

        // If this was the last allowed round, force a final answer
        if (round === MAX_TOOL_ROUNDS - 1) {
          const finalRes = await fetch(MISTRAL_ENDPOINT, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
              model: 'mistral-small-latest',
              stream: false,
              messages: loopMessages,
              tool_choice: 'none',
              temperature: 0.75,
            }),
          });
          const finalData = await finalRes.json();
          finalReply = finalData.choices?.[0]?.message?.content || '';
          onChunk?.(finalReply);
        }
      }

      history.current.push({
        role: 'model',
        parts: [{ text: finalReply }],
        timestamp: Date.now(),
      });

      return finalReply;
    },
    [apiKey]
  );

  const reset = useCallback(() => { history.current = []; }, []);
  return { ask, reset };
}
