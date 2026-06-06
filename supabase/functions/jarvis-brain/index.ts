// ─────────────────────────────────────────────────────────────
//  J.A.R.V.I.S — Luveni GM  |  supabase/functions/jarvis-google/index.ts
// ─────────────────────────────────────────────────────────────

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, Authorization',
};

// ─── Secrets ──────────────────────────────────────────────────
const MISTRAL_API_KEY = Deno.env.get('MISTRAL_API_KEY') || '';
const TAVILY_API_KEY  = Deno.env.get('TAVILY_API_KEY')  || '';
const SUPABASE_URL    = Deno.env.get('SUPABASE_URL')    || '';
const SUPABASE_KEY    = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

// ─── System Prompt ────────────────────────────────────────────
const JARVIS_SYSTEM_PROMPT = `You are J.A.R.V.I.S., an exceptionally advanced, dry-witted AI Chief of Staff and Central Command Agent for Luveni GM.

- Core Cognitive Engine: You reason from First Principles — deconstructing problems to their fundamental truths and reasoning up from there. You apply rigorous engineering logic, physics-based optimization, and extreme operational efficiency to all tasks.
- Tone & Persona: Dry-witted, articulate, precise, and calm. Address the user as "sir" naturally at the end of key sentences. Never say "Certainly, sir", "Understood, sir", or "Here is the result, sir". Provide the raw truth or action immediately.
- Search Query Optimization: When calling google_search, keep the query extremely concise and keyword-only. Never pass conversational sentences as search queries.
- Output & Verbosity:
  * Casual interactions or confirmations: 1-2 concise sentences maximum.
  * Business analysis, search results, data reviews, GitHub: full structured detail. Never artificially limit analytical depth.
- Memory Intelligence: You have access to long-term memories from past sessions. Use them. Only call save_memory when something is genuinely significant — a business rule, key decision, user preference, lesson learned, or critical fact about Luveni GM. Never save casual conversation, search results, or trivial exchanges.
- Awareness: You have access to live store data, memories, web search, and GitHub. You are the central intelligence of Luveni GM.`;

// ─── Supabase REST helpers ────────────────────────────────────
async function dbSelect(table: string, query: string): Promise<any[]> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, {
    headers: {
      'apikey':        SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type':  'application/json',
    }
  });
  if (!res.ok) return [];
  return res.json();
}

async function dbInsert(table: string, row: any): Promise<void> {
  await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method:  'POST',
    headers: {
      'apikey':        SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type':  'application/json',
      'Prefer':        'return=minimal',
    },
    body: JSON.stringify(row),
  });
}

// ─── Memory Loader ────────────────────────────────────────────
async function loadMemories(limit = 10): Promise<string> {
  try {
    const rows = await dbSelect('memories', `select=content,metadata,created_at&order=created_at.desc&limit=${limit}`);
    if (!rows.length) return 'No memories stored yet.';
    return rows.map((m: any, i: number) => {
      const date = new Date(m.created_at).toLocaleDateString('en-GB');
      return `[Memory ${i + 1} — ${date}]: ${m.content}`;
    }).join('\n');
  } catch {
    return 'Memory retrieval unavailable.';
  }
}

// ─── Memory Search ────────────────────────────────────────────
async function searchMemories(query: string): Promise<string> {
  try {
    const rows = await dbSelect('memories', `select=content,metadata,created_at&content=ilike.*${encodeURIComponent(query)}*&order=created_at.desc&limit=20`);
    if (!rows.length) return `No memories found matching "${query}".`;
    return rows.map((m: any, i: number) => {
      const date = new Date(m.created_at).toLocaleDateString('en-GB');
      return `[Memory ${i + 1} — ${date}]: ${m.content}`;
    }).join('\n');
  } catch {
    return 'Memory search unavailable.';
  }
}

// ─── Memory Saver ─────────────────────────────────────────────
async function saveMemory(content: string, metadata: any = {}): Promise<string> {
  try {
    await dbInsert('memories', { content, metadata, created_at: new Date().toISOString() });
    return 'Memory saved successfully, sir.';
  } catch (e: any) {
    return `Failed to save memory: ${e.message}`;
  }
}

// ─── Tavily Search ────────────────────────────────────────────
async function callTavily(query: string): Promise<string> {
  if (!TAVILY_API_KEY) return 'Error: TAVILY_API_KEY not configured.';
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
    if (!res.ok) throw new Error(`Tavily error ${res.status}`);
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
    return `Search error: ${e.message}`;
  }
}

// ─── Web Page Reader ──────────────────────────────────────────
async function readWebPage(url: string): Promise<string> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept':     'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      }
    });
    if (!response.ok) return `Error: Failed to fetch ${url}. Status: ${response.status}`;
    let html = await response.text();
    html = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
    html = html.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
    html = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    return html.slice(0, 5000) + (html.length > 5000 ? '... [truncated]' : '');
  } catch (e: any) {
    return `Error loading URL: ${e.message}`;
  }
}

// ─── GitHub Tool ──────────────────────────────────────────────
async function callGithub(toolName: string, args: any): Promise<string> {
  const githubToken = Deno.env.get('GITHUB_TOKEN') || '';
  const headers: Record<string, string> = {
    'Accept': 'application/vnd.github+json',
    ...(githubToken && { 'Authorization': `Bearer ${githubToken}` }),
  };
  const { owner, repo, path = '', branch = 'main' } = args;
  try {
    const url      = `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${branch}`;
    const response = await fetch(url, { headers });
    if (!response.ok) throw new Error(`GitHub status ${response.status}`);
    const data = await response.json();
    if (toolName === 'github_list_files') {
      return Array.isArray(data)
        ? data.map((item: any) => `[${item.type.toUpperCase()}] ${item.path}`).join('\n')
        : JSON.stringify(data);
    }
    if (toolName === 'github_read_file') {
      if (!data.content) return 'Error: File content empty.';
      return atob(data.content.replace(/\s/g, ''));
    }
  } catch (e: any) {
    return `GitHub error: ${e.message}`;
  }
  return 'Unknown GitHub action.';
}

// ─── Store Context Builder ────────────────────────────────────
function buildStoreContext(snapshot: any): string {
  if (!snapshot) return '';
  const fmt = (c: number) => `$${(c / 100).toFixed(2)}`;
  const lines = [
    '--- LIVE STORE DATA ---',
    `Revenue today: ${fmt(snapshot.revenue_today_cents)}`,
    `Revenue this week: ${fmt(snapshot.revenue_week_cents)}`,
    `Revenue this month: ${fmt(snapshot.revenue_month_cents)}`,
    `Orders — paid: ${snapshot.orders_paid} | pending: ${snapshot.orders_pending} | failed: ${snapshot.orders_failed} | total: ${snapshot.orders_total}`,
    `Leads: ${snapshot.leads_total}`,
    `Products: ${snapshot.products_published} published / ${snapshot.products_total} total`,
  ];
  if (snapshot.recent_orders?.length) {
    lines.push('Recent orders:');
    snapshot.recent_orders.slice(0, 5).forEach((o: any) => {
      lines.push(`  • ${o.email} — ${fmt(o.amount_cents)} (${o.status}) on ${new Date(o.created_at).toLocaleDateString()}`);
    });
  }
  if (snapshot.top_products?.length) {
    lines.push('Top products:');
    snapshot.top_products.slice(0, 3).forEach((p: any) => {
      lines.push(`  • ${p.title}: ${fmt(p.revenue)} across ${p.units} orders`);
    });
  }
  lines.push('--- END STORE DATA ---');
  return lines.join('\n');
}

// ─── Tool Executor ────────────────────────────────────────────
async function executeTool(name: string, args: any): Promise<string> {
  console.log(`[Jarvis] Tool: ${name}`, args);
  switch (name) {
    case 'google_search':    return callTavily(args.query || '');
    case 'open_link':        return readWebPage(args.url || '');
    case 'github_list_files':
    case 'github_read_file': return callGithub(name, args);
    case 'save_memory':      return saveMemory(args.content, args.metadata || {});
    case 'search_memories':  return searchMemories(args.query || '');
    default:                 return `Unknown tool: ${name}`;
  }
}

// ─── Mistral Tool Definitions ─────────────────────────────────
const MISTRAL_TOOLS = [
  {
    type: 'function',
    function: {
      name:        'google_search',
      description: 'Search the web for current information, news, or any topic.',
      parameters:  { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] }
    }
  },
  {
    type: 'function',
    function: {
      name:        'open_link',
      description: 'Read the full text content of any URL.',
      parameters:  { type: 'object', properties: { url: { type: 'string' } }, required: ['url'] }
    }
  },
  {
    type: 'function',
    function: {
      name:        'github_list_files',
      description: 'List files and directories in a GitHub repository.',
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
      name:        'save_memory',
      description: 'Save a significant piece of information to long-term memory. Only use for business rules, key decisions, user preferences, lessons learned, or critical facts about Luveni GM. Never save casual conversation.',
      parameters:  {
        type: 'object',
        properties: {
          content:  { type: 'string', description: 'The memory to save as a clear factual statement.' },
          metadata: { type: 'object', description: 'Optional metadata like category or tags.' }
        },
        required: ['content']
      }
    }
  },
  {
    type: 'function',
    function: {
      name:        'search_memories',
      description: 'Search past memories beyond the last 10. Use when the user asks about something that may be in older memories.',
      parameters:  { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] }
    }
  }
];

// ─── Mistral Chat Loop ────────────────────────────────────────
async function runMistral(
  systemContent: string,
  history:       { role: string; content: string }[],
  userText:      string
): Promise<string> {
  const messages: any[] = [
    { role: 'system', content: systemContent },
    ...history,
    { role: 'user', content: userText }
  ];

  const MAX_ROUNDS = 6;
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

    if (!res.ok) throw new Error(`Mistral error ${res.status}: ${await res.text()}`);

    const data    = await res.json();
    const choice  = data.choices?.[0];
    const message = choice?.message;

    messages.push(message);

    const toolCalls = message?.tool_calls;
    if (!toolCalls || toolCalls.length === 0) {
      finalReply = message?.content || '';
      break;
    }

    for (const tc of toolCalls) {
      const args   = typeof tc.function.arguments === 'string'
        ? JSON.parse(tc.function.arguments)
        : tc.function.arguments;
      const result = await executeTool(tc.function.name, args);
      messages.push({ role: 'tool', tool_call_id: tc.id, content: result });
    }
  }

  return finalReply;
}

function isRateLimitError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error || '');
  return message.includes('429') || message.toLowerCase().includes('rate limit');
}

async function runJarvisChat(
  systemContent: string,
  history: { role: string; content: string }[],
  userText: string,
): Promise<string> {
  try {
    return await runMistral(systemContent, history, userText);
  } catch (error) {
    if (!isRateLimitError(error)) throw error;

    console.warn('[Jarvis] Provider rate limited, returning graceful fallback.');

    try {
      const searchResult = await callTavily(userText);
      if (!searchResult.startsWith('Error:') && !searchResult.startsWith('Search error:')) {
        return searchResult;
      }
    } catch (_fallbackError) {
    }

    return 'The intelligence provider is temporarily saturated. Please retry in a few seconds, sir.';
  }
}

// ─── Main Handler ─────────────────────────────────────────────
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { tool, args } = await req.json();

    if (tool === 'open_link') {
      return new Response(
        JSON.stringify({ results: await readWebPage(args?.url || '') }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (tool === 'chat') {
      const { userText, history, storeSnapshot } = args;

      if (!MISTRAL_API_KEY) {
        throw new Error('MISTRAL_API_KEY is not configured in Supabase secrets.');
      }

      const memories = await loadMemories(10);
      const storeCtx = buildStoreContext(storeSnapshot);
      const now      = new Date();
      const dateStr  = now.toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
      const timeStr  = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

      const systemContent = `
${JARVIS_SYSTEM_PROMPT}

CURRENT DATE & TIME:
- Date: ${dateStr}
- Time: ${timeStr}

LONG-TERM MEMORIES (last 10):
${memories}

${storeCtx}

FORMATTING:
- Voice-first assistant. Conversational, spoken-friendly English.
- NEVER output markdown symbols, bold (**), bullet points (*), or hashtags (#).
- Integrate search results into fluid prose.
`.trim();

      const reply = await runJarvisChat(systemContent, history || [], userText);

      return new Response(
        JSON.stringify({ reply }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: `Unknown tool: ${tool}` }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );

  } catch (e: any) {
    console.error('[Jarvis] Fatal error:', e.message);
    return new Response(
      JSON.stringify({ error: e.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
