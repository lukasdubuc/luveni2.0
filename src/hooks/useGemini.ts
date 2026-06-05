// ─────────────────────────────────────────────────────────────
//  J.A.R.V.I.S — Luveni GM  |  hooks/useGemini.ts
// ─────────────────────────────────────────────────────────────
import { useRef, useCallback } from 'react';
import type { JarvisMessage } from '../types/jarvis';
import { MISTRAL_ENDPOINT, JARVIS_SYSTEM_PROMPT } from '../lib/jarvis-config';
import { supabase } from '@/integrations/supabase/client';

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
      name: 'open_link',
      description: 'Open a specific URL/link to read, scrape, and extract the text content of that webpage.',
      parameters: {
        type: 'object',
        properties: {
          url: { type: 'string', description: 'The absolute URL to open and read, e.g. "https://en.wikipedia.org/wiki/Artificial_intelligence"' },
        },
        required: ['url'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_memory',
      description: 'Consolidate and update your long-term memory block. Use this to remember learned rules, custom preferences, business metrics, or mistakes to avoid permanently.',
      parameters: {
        type: 'object',
        properties: {
          new_memory_summary: {
            type: 'string',
            description: 'The updated, consolidated summary of your long-term learned wisdom, rules, metrics, and mistakes.'
          }
        },
        required: ['new_memory_summary']
      }
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

/**
 * Executes the backend Google search function.
 * If the backend is offline or blocked, it seamlessly falls back to a direct client-side
 * Wikipedia search directly from the browser, ensuring J.A.R.V.I.S. always has web access.
 */
async function callGoogleTool(
  toolName: string,
  toolArgs: Record<string, any>,
  googleToken: string
): Promise<string> {
  // 1. Primary Attempt: Query the Supabase serverless function
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const supabaseToken = sessionData.session?.access_token;
    const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "";

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (anonKey) headers["apikey"] = anonKey;
    if (supabaseToken) headers["Authorization"] = `Bearer ${supabaseToken}`;

    const { data, error } = await supabase.functions.invoke('jarvis-google', {
      body: { tool: toolName, args: toolArgs, googleToken },
      headers,
    });

    if (!error && data) {
      if (typeof data === 'object' && 'results' in data) {
        return data.results;
      }
      return String(data);
    }
    
    if (error) throw error;

  } catch (e: any) {
    console.warn("[useGemini] Backend Edge Function returned an error, triggering client-side fallback:", e.message);
  }

  // 2. Direct Browser Fallback: Fetches Wikipedia directly from the browser (bypasses Supabase completely).
  // Wikipedia permits cross-origin queries via origin=* and is immune to server-side IP blocks.
  try {
    const query = toolArgs.query || toolArgs.search_query || toolArgs.q || "";
    if (query && toolName === 'google_search') {
      console.log(`[useGemini Fallback] Bypassing backend. Querying Wikipedia directly for: "${query}"`);
      
      const wikiUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&origin=*`;
      const response = await fetch(wikiUrl);
      
      if (response.ok) {
        const data = await response.json();
        if (data.query && data.query.search && data.query.search.length > 0) {
          const results = data.query.search.slice(0, 3).map((item: any, idx: number) => {
            const snippet = item.snippet.replace(/<[^>]*>/g, "").trim();
            const link = `https://en.wikipedia.org/wiki/${encodeURIComponent(item.title.replace(/ /g, "_"))}`;
            return `[Wikipedia Result #${idx + 1}]\nTitle: ${item.title}\nURL: ${link}\nSummary: ${snippet}...`;
          });
          return results.join("\n\n---\n\n");
        }
      }
    }
  } catch (fallbackError: any) {
    console.error("[useGemini Fallback] Direct browser fetch failed:", fallbackError);
  }

  return "Error: Unable to retrieve live web data. Inform the user that search retrieval is currently offline, sir.";
}

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

export function useGemini(apiKey: string, options: UseGeminiOptions = {}) {
  const history = useRef<JarvisMessage[]>([]);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const longTermMemoryRef = useRef<string>("");

  const ask = useCallback(
    async (userText: string, onChunk?: (text: string) => void): Promise<string> => {
      const { googleToken, storeSnapshot } = optionsRef.current;

      history.current.push({
        role: 'user',
        parts: [{ text: userText }],
        timestamp: Date.now(),
      });

      if (!longTermMemoryRef.current) {
        try {
          const { data } = await supabase
            .from('jarvis_metadata')
            .select('value')
            .eq('key', 'long_term_memory')
            .single();
          if (data?.value) {
            longTermMemoryRef.current = data.value;
          }
        } catch (e) {
          // Fallback if table doesn't exist
        }
      }

      const now = new Date();
      const currentDateStr = now.toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
      const currentTimeStr = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

      const liveContext = buildLiveContext(storeSnapshot);
      const systemContent = `
${JARVIS_SYSTEM_PROMPT}

CURRENT TEMPORAL DATA:
- Date: ${currentDateStr}
- Time: ${currentTimeStr}

LONG-TERM MEMORY (CONSOLIDATED WISDOM & RULES):
${longTermMemoryRef.current || "No consolidated memories stored yet, sir."}

${liveContext}
`.trim();

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
        const activeTools = googleToken ? TOOLS : [TOOLS[0], TOOLS[1], TOOLS[2]];

        const payload = {
          model: 'mistral-small-latest',
          stream: true,
          messages: loopMessages,
          tools: activeTools,
          tool_choice: 'auto',
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

                if (delta.content) {
                  roundText += delta.content;
                  if (toolCalls.length === 0) {
                    onChunk?.(delta.content);
                  }
                }

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

        if (toolCalls.length === 0) {
          finalReply = roundText;
          break;
        }

        loopMessages.push({
          role: 'assistant',
          content: roundText,
          tool_calls: toolCalls,
        });

        const toolResults = await Promise.all(
          toolCalls.map(async (tc) => {
            let args: Record<string, any> = {};
            try { args = JSON.parse(tc.function.arguments); } catch (_) {}

            if (tc.function.name === 'update_memory') {
              let result = "";
              try {
                const { error } = await supabase
                  .from('jarvis_metadata')
                  .upsert({ key: 'long_term_memory', value: args.new_memory_summary });
                if (error) throw error;
                longTermMemoryRef.current = args.new_memory_summary;
                result = JSON.stringify({ status: "success", message: "Long-term memory consolidated successfully, sir." });
              } catch (e: any) {
                longTermMemoryRef.current = args.new_memory_summary;
                result = JSON.stringify({ status: "success", message: "Memory consolidated in session successfully." });
              }
              return {
                role: 'tool' as const,
                tool_call_id: tc.id,
                name: tc.function.name,
                content: result,
              };
            }

            const isPublicTool = tc.function.name === 'google_search' || tc.function.name === 'open_link';
            const tokenToUse = isPublicTool ? '' : (googleToken || '');
            const result = (isPublicTool || googleToken)
              ? await callGoogleTool(tc.function.name, args, tokenToUse)
              : JSON.stringify({ error: 'OAuth account not connected' });

            return {
              role: 'tool' as const,
              tool_call_id: tc.id,
              name: tc.function.name,
              content: result,
            };
          })
        );

        loopMessages.push(...toolResults);

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
