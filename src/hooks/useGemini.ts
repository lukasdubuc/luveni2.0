// ─────────────────────────────────────────────────────────────
//  J.A.R.V.I.S — Luveni GM  |  hooks/useGemini.ts
// ─────────────────────────────────────────────────────────────
import { useRef, useCallback } from 'react';
import { JARVIS_SYSTEM_PROMPT, MISTRAL_API_KEY, TAVILY_API_KEY } from '../lib/jarvis-config';
import { supabase } from '@/integrations/supabase/client';

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
  googleToken?:   string | null;
  storeSnapshot?: StoreSnapshot | null;
}

// ─── Live Store Context Builder ───────────────────────────────

function buildLiveContext(snapshot: StoreSnapshot | null | undefined): string {
  if (!snapshot) return '';

  const fmt   = (c: number) => `$${(c / 100).toFixed(2)}`;
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

// ─── Tavily Web Search ────────────────────────────────────────

async function callTavily(query: string): Promise<string> {
  if (!TAVILY_API_KEY) return 'Error: TAVILY_API_KEY is not set.';

  try {
    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key:             TAVILY_API_KEY,
        query,
        search_depth:        'basic',
        include_answer:      true,
        include_raw_content: false,
        max_results:         5,
      })
    });

    if (!res.ok) throw new Error(`Tavily error ${res.status}: ${await res.text()}`);

    const data = await res.json();
    const lines: string[] = [];
    if (data.answer) lines.push(`Summary: ${data.answer}`);
    if (data.results?.length) {
      lines.push('Sources:');
      data.results.slice(0, 5).forEach((r: any) => {
        lines.push(`• ${r.title} (${r.url}): ${r.content?.slice(0, 300)}`);
      });
    }
    return lines.join('\n') || 'No results found.';
  } catch (e: any) {
    console.warn('[Jarvis] Tavily search failed:', e.message);
    return `Search error: ${e.message}`;
  }
}

// ─── Edge Function Tool Handler ───────────────────────────────

async function callEdgeTool(toolName: string, args: Record<string, any>, googleToken?: string | null): Promise<string> {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const supabaseToken = sessionData.session?.access_token;
    const anonKey       = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '';

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (anonKey)       headers['apikey']        = anonKey;
    if (supabaseToken) headers['Authorization'] = `Bearer ${supabaseToken}`;

    const { data, error } = await supabase.functions.invoke('jarvis-google', {
      body: { tool: toolName, args, googleToken: googleToken || '' },
      headers,
    });

    if (error) throw error;
    if (data) {
      return typeof data === 'object' && 'results' in data ? data.results : String(data);
    }
  } catch (e: any) {
    console.warn(`[Jarvis] Edge tool "${toolName}" failed:`, e.message);
  }
  return `Error: Tool "${toolName}" failed to execute.`;
}

// ─── GitHub Tool Handler ──────────────────────────────────────

async function callGithubTool(toolName: string, args: Record<string, any>): Promise<string> {
  const githubToken =
    (typeof import.meta !== 'undefined' && (import.meta.env?.GITHUB_TOKEN || import.meta.env?.VITE_GITHUB_TOKEN)) ||
    (typeof process     !== 'undefined' && (process.env?.GITHUB_TOKEN    || process.env?.VITE_GITHUB_TOKEN))    ||
    '';

  const headers: Record<string, string> = {
    'Accept': 'application/vnd.github+json',
    ...(githubToken && { 'Authorization': `Bearer ${githubToken}` }),
  };

  const { owner, repo, path = '', branch = 'main' } = args;

  try {
    const url      = `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${branch}`;
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

// ─── Memory Handler ───────────────────────────────────────────

async function handleMemoryUpdate(newSummary: string, memoryRef: React.MutableRefObject<string>): Promise<string> {
  try {
    const { error } = await supabase
      .from('jarvis_metadata')
      .upsert({ key: 'long_term_memory', value: newSummary });
    if (error) throw error;
  } catch {
    // Silently fall through
  }
  memoryRef.current = newSummary;
  return JSON.stringify({ status: 'success', message: 'Long-term memory consolidated successfully, sir.' });
}

// ─── DOM Scraper ──────────────────────────────────────────────

function scrapeCurrentPage(): string {
  try {
    const cloned    = document.body.cloneNode(true) as HTMLElement;
    cloned.querySelectorAll('script, style, iframe, noscript').forEach(s => s.remove());
    const rawText   = cloned.innerText || cloned.textContent || '';
    const cleanText = rawText.replace(/\s+/g, ' ').trim().slice(0, 8000);
    return JSON.stringify({ url: window.location.href, title: document.title, content_snippet: cleanText });
  } catch (e: any) {
    return `Error reading active web document: ${e.message}`;
  }
}

// ─── Tool Executor ────────────────────────────────────────────

async function executeTool(
  name:        string,
  args:        Record<string, any>,
  googleToken: string | null | undefined,
  memoryRef:   React.MutableRefObject<string>
): Promise<string> {
  if (name === 'google_search')                                      return callTavily(args.query || '');
  if (name === 'get_current_page_content')                           return scrapeCurrentPage();
  if (name === 'github_list_files' || name === 'github_read_file')   return callGithubTool(name, args);
  if (name === 'update_memory')                                      return handleMemoryUpdate(args.new_memory_summary, memoryRef);
  return callEdgeTool(name, args, googleToken);
}

// ─── Mistral Tool Definitions ─────────────────────────────────

const MISTRAL_TOOLS = [
  {
    type: 'function',
    function: {
      name:        'google_search',
      description: 'Search the web for current information, news, or any topic.',
      parameters:  { type: 'object', properties: { query: { type: 'string', description: 'Concise keyword search query' } }, required: ['query'] }
    }
  },
  {
    type: 'function',
    function: {
      name:        'open_link',
      description: 'Scrape and read the full text content of any URL.',
      parameters:  { type: 'object', properties: { url: { type: 'string', description: 'The full URL to open and read' } }, required: ['url'] }
    }
  },
  {
    type: 'function',
    function: {
      name:        'get_current_page_content',
      description: 'Read the text contents and URL of the active webpage the user is viewing.',
      parameters:  { type: 'object', properties: {} }
    }
  },
  {
    type: 'function',
    function: {
      name:        'github_list_files',
      description: 'List directories and files inside a GitHub repository.',
      parameters:  { type: 'object', properties: { owner: { type: 'string' }, repo: { type: 'string' }, path: { type: 'string' } }, required: ['owner', 'repo'] }
    }
  },
  {
    type: 'function',
    function: {
      name:        'github_read_file',
      description: 'Read the contents of a file in a GitHub repository.',
      parameters:  { type: 'object', properties: { owner: { type: 'string' }, repo: { type: 'string' }, path: { type: 'string' }, branch: { type: 'string' } }, required: ['owner', 'repo', 'path'] }
    }
  },
  {
    type: 'function',
    function: {
      name:        'update_memory',
      description: 'Save consolidated wisdom, rules, and lessons to long-term memory.',
      parameters:  { type: 'object', properties: { new_memory_summary: { type: 'string' } }, required: ['new_memory_summary'] }
    }
  },
  {
    type: 'function',
    function: {
      name:        'gmail_read',
      description: 'Read emails from Gmail.',
      parameters:  { type: 'object', properties: { query: { type: 'string' }, maxResults: { type: 'number' } }, required: ['query'] }
    }
  },
  {
    type: 'function',
    function: {
      name:        'gmail_send',
      description: 'Send an email via Gmail.',
      parameters:  { type: 'object', properties: { to: { type: 'string' }, subject: { type: 'string' }, body: { type: 'string' } }, required: ['to', 'subject', 'body'] }
    }
  },
  {
    type: 'function',
    function: {
      name:        'drive_search',
      description: 'Search Google Drive for files.',
      parameters:  { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] }
    }
  },
  {
    type: 'function',
    function: {
      name:        'drive_read',
      description: 'Read a Google Drive file by ID.',
      parameters:  { type: 'object', properties: { fileId: { type: 'string' } }, required: ['fileId'] }
    }
  }
];

// ─── Mistral API Call ─────────────────────────────────────────

async function askMistral(
  systemContent: string,
  history:       any[],
  userText:      string,
  googleToken:   string | null | undefined,
  memoryRef:     React.MutableRefObject<string>,
  onChunk?:      (text: string) => void
): Promise<string> {
  const messages: any[] = [
    { role: 'system', content: systemContent },
    ...history.slice(0, -1).map((h: any) => ({
      role:    h.role === 'model' ? 'assistant' : 'user',
      content: h.parts?.[0]?.text || ''
    })),
    { role: 'user', content: userText }
  ];

  const MAX_ROUNDS = 4;
  let finalReply   = '';

  for (let round = 0; round < MAX_ROUNDS; round++) {
    const res = await fetch('https://api.mistral.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${MISTRAL_API_KEY}`
      },
      body: JSON.stringify({
        model:       'mistral-large-latest',
        messages,
        tools:       MISTRAL_TOOLS,
        tool_choice: 'auto',
        temperature: 0.75,
      })
    });

    if (!res.ok) throw new Error(`Mistral API error ${res.status}: ${await res.text()}`);

    const data    = await res.json();
    const choice  = data.choices?.[0];
    const message = choice?.message;

    messages.push(message);

    const toolCalls = message?.tool_calls;
    if (!toolCalls || toolCalls.length === 0) {
      finalReply = message?.content || '';
      onChunk?.(finalReply);
      break;
    }

    for (const tc of toolCalls) {
      const args   = typeof tc.function.arguments === 'string'
        ? JSON.parse(tc.function.arguments)
        : tc.function.arguments;
      const result = await executeTool(tc.function.name, args, googleToken, memoryRef);
      messages.push({ role: 'tool', tool_call_id: tc.id, content: result });
    }
  }

  return finalReply;
}

// ─── Main Hook ────────────────────────────────────────────────

export function useGemini(apiKey?: string, options: UseGeminiOptions = {}) {
  const history           = useRef<any[]>([]);
  const optionsRef        = useRef(options);
  optionsRef.current      = options;
  const longTermMemoryRef = useRef<string>('');

  const ask = useCallback(
    async (userText: string, onChunk?: (text: string) => void): Promise<string> => {
      const { googleToken, storeSnapshot } = optionsRef.current;

      if (!longTermMemoryRef.current) {
        try {
          const { data } = await supabase
            .from('jarvis_metadata')
            .select('value')
            .eq('key', 'long_term_memory')
            .single();
          if (data?.value) longTermMemoryRef.current = data.value;
        } catch { /* silent */ }
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
- You are a voice-first assistant. Write in conversational, spoken-friendly English.
- NEVER output markdown characters, bold indicators (**), bullet points (*), or hashtags (#).
- Integrate search results into fluid, flowing prose. Write lists as natural sentences.
`.trim();

      history.current.push({ role: 'user', parts: [{ text: userText }] });

      if (!MISTRAL_API_KEY) {
        throw new Error('No AI provider available. Please set MISTRAL_API_KEY in Lovable secrets.');
      }

      const finalReply = await askMistral(
        systemContent,
        history.current,
        userText,
        googleToken,
        longTermMemoryRef,
        onChunk
      );

      history.current.push({ role: 'model', parts: [{ text: finalReply }] });
      return finalReply;
    },
    []
  );

  const reset = useCallback(() => { history.current = []; }, []);

  return { ask, reset };
}
