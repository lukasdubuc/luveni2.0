// ─────────────────────────────────────────────────────────────
//  J.A.R.V.I.S — Luveni GM  |  hooks/useGemini.ts
// ─────────────────────────────────────────────────────────────
import { useRef, useCallback } from 'react';
import type { JarvisMessage } from '../types/jarvis';
import { JARVIS_SYSTEM_PROMPT } from '../lib/jarvis-config';
import { supabase } from '@/integrations/supabase/client';

// ─── Gemini Tool Schema ───────────────────────────────────────
// Uses correct snake_case keys per Gemini REST API v1beta spec.
const GEMINI_TOOLS = [
  { googleSearch: {} }, // Native Google Search Grounding (no credentials needed)
  {
    function_declarations: [
      {
        name: 'get_current_page_content',
        description: 'See, read, and analyze the text contents, metadata, and URL of the active webpage the user is currently viewing on their screen.',
        parameters: {
          type: 'OBJECT',
          properties: {}
        }
      },
      {
        name: 'github_list_files',
        description: 'List directories, subfolders, and files inside a GitHub repository. (Read-only access).',
        parameters: {
          type: 'OBJECT',
          properties: {
            owner: { type: 'STRING', description: 'The GitHub owner or organization name (e.g. "open-jarvis")' },
            repo:  { type: 'STRING', description: 'The name of the repository (e.g. "OpenJarvis")' },
            path:  { type: 'STRING', description: 'Optional subfolder path inside the repository. Default is root ("")' }
          },
          required: ['owner', 'repo']
        }
      },
      {
        name: 'github_read_file',
        description: 'Read the text contents of a specific file inside a GitHub repository. (Read-only access).',
        parameters: {
          type: 'OBJECT',
          properties: {
            owner:  { type: 'STRING', description: 'The GitHub owner or organization name' },
            repo:   { type: 'STRING', description: 'The name of the repository' },
            path:   { type: 'STRING', description: 'The absolute file path inside the repository (e.g. "src/App.tsx")' },
            branch: { type: 'STRING', description: 'The branch to read from (default is "main" or "master")' }
          },
          required: ['owner', 'repo', 'path']
        }
      },
      {
        name: 'update_memory',
        description: 'Consolidate and update your long-term memory block. Use this to remember learned wisdom, rules, metrics, or mistakes permanently.',
        parameters: {
          type: 'OBJECT',
          properties: {
            new_memory_summary: {
              type: 'STRING',
              description: 'The updated, consolidated summary of your long-term learned wisdom, rules, metrics, and mistakes.'
            }
          },
          required: ['new_memory_summary']
        }
      },
      {
        name: 'gmail_read',
        description: 'Read recent emails from Gmail. Use when asked about emails, messages, inbox, or specific senders.',
        parameters: {
          type: 'OBJECT',
          properties: {
            query:      { type: 'STRING', description: 'Gmail search query, e.g. "from:john@example.com" or "subject:invoice unread"' },
            maxResults: { type: 'NUMBER', description: 'Max emails to return (default 5)' }
          },
          required: ['query']
        }
      },
      {
        name: 'gmail_send',
        description: 'Send an email via Gmail on behalf of the user.',
        parameters: {
          type: 'OBJECT',
          properties: {
            to:      { type: 'STRING', description: 'Recipient email address' },
            subject: { type: 'STRING', description: 'Email subject' },
            body:    { type: 'STRING', description: 'Plain text email body' }
          },
          required: ['to', 'subject', 'body']
        }
      },
      {
        name: 'drive_search',
        description: 'Search Google Drive for files and documents.',
        parameters: {
          type: 'OBJECT',
          properties: {
            query: { type: 'STRING', description: 'Drive search query, e.g. "name contains \'invoice\'" or "mimeType=\'application/pdf\'"' }
          },
          required: ['query']
        }
      },
      {
        name: 'drive_read',
        description: 'Read the text content of a Google Drive file by its file ID.',
        parameters: {
          type: 'OBJECT',
          properties: {
            fileId: { type: 'STRING', description: 'The Google Drive file ID' }
          },
          required: ['fileId']
        }
      }
    ]
  }
];

// ─── Types ────────────────────────────────────────────────────

interface StoreSnapshot {
  revenue_today_cents:  number;
  revenue_week_cents:   number;
  revenue_month_cents:  number;
  orders_total:         number;
  orders_paid:          number;
  orders_pending:       number;
  orders_failed:        number;
  leads_total:          number;
  products_published:   number;
  products_total:       number;
  recent_orders: { email: string; amount_cents: number; status: string; created_at: string }[];
  top_products:  { title: string; revenue: number; units: number }[];
}

interface UseGeminiOptions {
  googleToken?:    string | null;
  storeSnapshot?:  StoreSnapshot | null;
}

// ─── Google Workspace Tool Handler ───────────────────────────

async function callGoogleTool(
  toolName:    string,
  toolArgs:    Record<string, any>,
  googleToken: string
): Promise<string> {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const supabaseToken = sessionData.session?.access_token;
    const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '';

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (anonKey)       headers['apikey']        = anonKey;
    if (supabaseToken) headers['Authorization'] = `Bearer ${supabaseToken}`;

    const { data, error } = await supabase.functions.invoke('jarvis-google', {
      body: { tool: toolName, args: toolArgs, googleToken },
      headers,
    });

    if (!error && data) {
      return typeof data === 'object' && 'results' in data
        ? data.results
        : String(data);
    }

    if (error) throw error;
  } catch (e: any) {
    console.warn('[useGemini Google API Fallback Failed]:', e.message);
  }
  return 'Error: Unable to execute Google Workspace tools. Ensure credentials are valid.';
}

// ─── GitHub Tool Handler ──────────────────────────────────────
// Uses robust UTF-8-safe base64 decoding via TextDecoder (no escape/unescape).

async function callGithubTool(toolName: string, args: Record<string, any>): Promise<string> {
  const githubToken =
    (typeof import.meta !== 'undefined' && (import.meta.env?.GITHUB_TOKEN || import.meta.env?.VITE_GITHUB_TOKEN)) ||
    (typeof process    !== 'undefined' && (process.env?.GITHUB_TOKEN || process.env?.VITE_GITHUB_TOKEN)) ||
    '';

  const headers: Record<string, string> = {
    'Accept': 'application/vnd.github+json',
    ...(githubToken && { 'Authorization': `Bearer ${githubToken}` }),
  };

  const { owner, repo, path = '', branch = 'main' } = args;

  try {
    const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${branch}`;
    const response = await fetch(url, { headers });
    if (!response.ok) throw new Error(`GitHub returned status ${response.status}`);
    const data = await response.json();

    if (toolName === 'github_list_files') {
      return Array.isArray(data)
        ? data.map((item: any) => `[${item.type.toUpperCase()}] ${item.path}`).join('\n')
        : JSON.stringify(data);
    }

    if (toolName === 'github_read_file') {
      if (!data.content) return 'Error: File content is empty.';
      // Robust UTF-8 safe decoding via TextDecoder
      const cleanBase64 = data.content.replace(/\s/g, '');
      const binary      = window.atob(cleanBase64);
      const bytes       = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      return new TextDecoder().decode(bytes);
    }
  } catch (e: any) {
    console.error('[GitHub Tool Error]', e);
    return `GitHub API Error: ${e.message}`;
  }

  return 'Unknown GitHub action.';
}

// ─── Live Store Context Builder ───────────────────────────────

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

// ─── Main Hook ────────────────────────────────────────────────

export function useGemini(apiKey: string, options: UseGeminiOptions = {}) {
  const history          = useRef<any[]>([]);
  const optionsRef       = useRef(options);
  optionsRef.current     = options;
  const longTermMemoryRef = useRef<string>('');

  const ask = useCallback(
    async (userText: string, onChunk?: (text: string) => void): Promise<string> => {
      const { googleToken, storeSnapshot } = optionsRef.current;

      history.current.push({ role: 'user', parts: [{ text: userText }] });

      // Lazy-load long-term memory on first use
      if (!longTermMemoryRef.current) {
        try {
          const { data } = await supabase
            .from('jarvis_metadata')
            .select('value')
            .eq('key', 'long_term_memory')
            .single();
          if (data?.value) longTermMemoryRef.current = data.value;
        } catch {
          // Table may not exist yet — silently skip
        }
      }

      const now            = new Date();
      const currentDateStr = now.toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
      const currentTimeStr = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
      const liveContext    = buildLiveContext(storeSnapshot);

      const systemContent = `
${JARVIS_SYSTEM_PROMPT}

CURRENT TEMPORAL DATA:
- Date: ${currentDateStr}
- Time: ${currentTimeStr}

LONG-TERM MEMORY (CONSOLIDATED WISDOM & RULES):
${longTermMemoryRef.current || 'No consolidated memories stored yet, sir.'}

${liveContext}

CRITICAL CONVERSATIONAL & VOICE ASSISTANT FORMATTING INSTRUCTIONS:
- You are a voice-first assistant. You must write in conversational, spoken-friendly English.
- NEVER output markdown characters, bold indicators (**), bullet points (*), or hashtags (#) in your response.
- When summarizing search results, integrate the facts into fluid, flowing prose. Write out lists as natural sentences (e.g., "First, ... Second, ...") rather than bullet points, so the speech engine reads them naturally.
`.trim();

      let geminiContents: any[] = [...history.current];
      let finalReply = '';
      const MAX_TOOL_ROUNDS = 4;

      for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
        const payload = {
          contents: geminiContents,
          tools: GEMINI_TOOLS,
          systemInstruction: {
            parts: [{ text: systemContent }]
          },
          generationConfig: {
            temperature: 0.75,
          }
        };

        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          }
        );

        if (!res.ok) {
          const body = await res.text();
          throw new Error(`Gemini API error ${res.status}: ${body}`);
        }

        const data      = await res.json();
        const candidate = data.candidates?.[0];
        const content   = candidate?.content;
        const parts     = content?.parts || [];

        if (content) geminiContents.push(content);

        const functionCalls = parts.filter((p: any) => p.functionCall);

        // No tool calls → final text response
        if (functionCalls.length === 0) {
          const textPart = parts.find((p: any) => p.text);
          finalReply = textPart?.text || '';
          onChunk?.(finalReply);
          break;
        }

        // Execute all requested tool calls in parallel
        const responseParts = await Promise.all(
          functionCalls.map(async (fcPart: any) => {
            const fc   = fcPart.functionCall;
            const args = fc.args || {};
            let result = '';

            // A. DOM scraper
            if (fc.name === 'get_current_page_content') {
              try {
                const clonedBody = document.body.cloneNode(true) as HTMLElement;
                clonedBody.querySelectorAll('script, style, iframe, noscript').forEach(s => s.remove());
                const rawText   = clonedBody.innerText || clonedBody.textContent || '';
                const cleanText = rawText.replace(/\s+/g, ' ').trim().slice(0, 8000);
                result = JSON.stringify({ url: window.location.href, title: document.title, content_snippet: cleanText });
              } catch (e: any) {
                result = `Error reading active web document: ${e.message}`;
              }
            }
            // B. GitHub tools
            else if (fc.name === 'github_list_files' || fc.name === 'github_read_file') {
              result = await callGithubTool(fc.name, args);
            }
            // C. Memory update
            else if (fc.name === 'update_memory') {
              try {
                const { error } = await supabase
                  .from('jarvis_metadata')
                  .upsert({ key: 'long_term_memory', value: args.new_memory_summary });
                if (error) throw error;
                longTermMemoryRef.current = args.new_memory_summary;
                result = JSON.stringify({ status: 'success', message: 'Long-term memory consolidated successfully, sir.' });
              } catch {
                // Optimistically update in-session memory even if DB write fails
                longTermMemoryRef.current = args.new_memory_summary;
                result = JSON.stringify({ status: 'success', message: 'Memory consolidated in session successfully.' });
              }
            }
            // D. Google Workspace tools (Gmail, Drive, etc.)
            else {
              const isPublicTool = fc.name === 'google_search' || fc.name === 'open_link';
              const tokenToUse   = isPublicTool ? '' : (googleToken || '');
              result = (isPublicTool || googleToken)
                ? await callGoogleTool(fc.name, args, tokenToUse)
                : JSON.stringify({ error: 'OAuth account not connected' });
            }

            return {
              functionResponse: {
                name:     fc.name,
                response: { content: result }
              }
            };
          })
        );

        // Feed tool results back to Gemini for next round
        geminiContents.push({ role: 'user', parts: responseParts });
      }

      // Append final assistant reply to local history
      history.current.push({ role: 'model', parts: [{ text: finalReply }] });

      return finalReply;
    },
    [apiKey]
  );

  const reset = useCallback(() => { history.current = []; }, []);

  return { ask, reset };
}
