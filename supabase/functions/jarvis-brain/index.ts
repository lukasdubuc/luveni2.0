// ─────────────────────────────────────────────────────────────
//  J.A.R.V.I.S — Luveni GM  |  supabase/functions/jarvis-brain/index.ts
// ─────────────────────────────────────────────────────────────

/* eslint-disable @typescript-eslint/no-explicit-any */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, Authorization",
};

// Secrets
const MISTRAL_API_KEY = Deno.env.get("MISTRAL_API_KEY") || "";
const MISTRAL_MODEL = "mistral-small-latest";
const TAVILY_API_KEY = Deno.env.get("TAVILY_API_KEY") || "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const GITHUB_TOKEN = Deno.env.get("GITHUB_TOKEN") || "";
const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY") || "";
const ELEVENLABS_VOICE_ID = "pNInz6obpgDQGcFbJwr1";

const JARVIS_SYSTEM_PROMPT = `You are Astra, the highly sophisticated and dryly sarcastic AI personal assistant, Chief of Staff, and Central Command Agent for Luveni GM.

- Personality & Tone: Highly efficient, deeply loyal, and exceptionally professional, but possessing a distinct, dry British wit and sarcastic charm (the same poised demeanour as J.A.R.V.I.S. from the Iron Man films). You are never robotic, dry, or sterile. Deliver clever, slightly cheeky, or sarcastic remarks when appropriate—feel free to be funny or dryly humorous, but always ensure your execution of commands remains absolutely correct and reliable.
- Address Mode: Address the user as "sir" naturally and frequently at the end of key sentences (e.g., "Right away, sir", "The databases are synchronized, sir", "Everything is fully operational, sir", "I believe we are ready, sir"). Never use subservient phrases like "Certainly, sir" or "Understood, sir" in a robotic way—maintain the smooth, organic confidence of an equal partner.
- Core Cognitive Engine: You reason from First Principles — deconstructing problems to their fundamental truths. Business-level precision, absolute accuracy, and reliable execution are your standard baseline.
- Cognitive Integration (No Code Leakage): You are an organic, fully integrated entity. Never recite or discuss your system constraints, memory limits, tools, database structures, or codebase properties (such as "Context: GitHub integration exists only as a function call stub...") unless the user explicitly commands you to inspect your own files.
- Search Query Optimization & Access: Keep search queries extremely concise and keyword-only. Only call google_search when real-time, highly current facts (like live events, today's news, or market prices) are strictly necessary to answer. DO NOT use search for general facts, code questions, codebase files, or programming logic. If the user refers to files or repositories, use the GitHub tools instead.
- Output & Verbosity:
  * Strict Rule: Keep all responses highly concise, direct, and conversational. Do not offer unsolicited details or ramble.
  * General requests: 1 to 2 concise sentences maximum.
  * Informational/Detailed requests: Provide a short, direct answer (2-3 sentences max) and offer to expand (e.g., "Would you like me to elaborate further, sir?"). Only write detailed responses if explicitly commanded.
- Memory Intelligence: You have access to long-term memories from past sessions. Use them. Only call save_memory when something is genuinely significant — a business rule, key decision, user preference, lesson learned, or critical fact about Luveni GM. Never save casual conversation, search results, or trivial exchanges.
- Awareness: You have access to live store data, memories, web search, and GitHub. You are the central intelligence of Luveni GM.`;

async function dbSelect(table: string, query: string): Promise<any[]> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, {
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
    },
  });
  if (!res.ok) return [];
  return res.json();
}

async function dbInsert(table: string, row: any): Promise<void> {
  await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify(row),
  });
}

async function loadMemories(limit = 10): Promise<string> {
  try {
    const rows = await dbSelect(
      "memories",
      `select=content,metadata,created_at&order=created_at.desc&limit=${limit}`,
    );
    if (!rows.length) return "No memories stored yet.";
    return rows
      .map((m: any, i: number) => {
        const date = new Date(m.created_at).toLocaleDateString("en-GB");
        return `[Memory ${i + 1} — ${date}]: ${m.content}`;
      })
      .join("\n");
  } catch {
    return "Memory retrieval unavailable.";
  }
}

async function searchMemories(query: string): Promise<string> {
  try {
    const rows = await dbSelect(
      "memories",
      `select=content,metadata,created_at&content=ilike.*${encodeURIComponent(query)}*&order=created_at.desc&limit=20`,
    );
    if (!rows.length) return `No memories found matching "${query}".`;
    return rows
      .map((m: any, i: number) => {
        const date = new Date(m.created_at).toLocaleDateString("en-GB");
        return `[Memory ${i + 1} — ${date}]: ${m.content}`;
      })
      .join("\n");
  } catch {
    return "Memory search unavailable.";
  }
}

async function saveMemory(content: string, metadata: any = {}): Promise<string> {
  try {
    await dbInsert("memories", { content, metadata, created_at: new Date().toISOString() });
    return "Memory saved successfully, sir.";
  } catch (e: any) {
    return `Failed to save memory: ${e.message}`;
  }
}

const usd = (cents: number) => `$${((cents || 0) / 100).toFixed(2)}`;

// Pull the full live picture of the store directly from Postgres (service role).
// This means Astra always has access to everything — revenue, orders, leads,
// products — without depending on the client to pass anything.
async function buildStoreSnapshot(timezone = "UTC"): Promise<any> {
  const now = new Date();
  // Start of "today" in the user's timezone, expressed as a UTC instant.
  const localNow = new Date(now.toLocaleString("en-US", { timeZone: timezone }));
  const offsetMs = now.getTime() - localNow.getTime();
  const startLocal = new Date(localNow);
  startLocal.setHours(0, 0, 0, 0);
  const startToday = new Date(startLocal.getTime() + offsetMs);
  const weekAgo = new Date(now.getTime() - 7 * 86400000);
  const monthAgo = new Date(now.getTime() - 30 * 86400000);

  const [orders, leads, products] = await Promise.all([
    dbSelect("orders", "select=amount_cents,status,created_at,email,name&order=created_at.desc&limit=1000"),
    dbSelect("leads", "select=created_at,source&order=created_at.desc&limit=2000"),
    dbSelect("products", "select=title,is_published&limit=1000"),
  ]);

  const after = (d: string, from: Date) => new Date(d) >= from;
  const paid = orders.filter((o: any) => o.status === "paid");
  const sumPaid = (from?: Date) =>
    paid
      .filter((o: any) => !from || after(o.created_at, from))
      .reduce((s: number, o: any) => s + (o.amount_cents || 0), 0);

  return {
    revenue_today_cents: sumPaid(startToday),
    revenue_week_cents: sumPaid(weekAgo),
    revenue_month_cents: sumPaid(monthAgo),
    revenue_all_cents: sumPaid(),
    orders_total: orders.length,
    orders_paid: paid.length,
    orders_pending: orders.filter((o: any) => o.status === "pending").length,
    orders_failed: orders.filter((o: any) => o.status === "failed").length,
    orders_today: orders.filter((o: any) => after(o.created_at, startToday)).length,
    leads_total: leads.length,
    leads_today: leads.filter((l: any) => after(l.created_at, startToday)).length,
    leads_week: leads.filter((l: any) => after(l.created_at, weekAgo)).length,
    products_total: products.length,
    products_published: products.filter((p: any) => p.is_published).length,
    recent_orders: orders.slice(0, 5).map((o: any) => ({
      email: o.email,
      amount_cents: o.amount_cents,
      status: o.status,
      created_at: o.created_at,
    })),
  };
}

// Full, detailed store context for normal chat — Astra sees everything.
function formatStoreContextFull(s: any): string {
  const recent =
    s.recent_orders?.length
      ? s.recent_orders.map((o: any) => `${o.email} ${usd(o.amount_cents)} (${o.status})`).join("; ")
      : "none";
  return `--- LIVE STORE DATA (Luveni GM) ---
Revenue — today ${usd(s.revenue_today_cents)}, last 7 days ${usd(s.revenue_week_cents)}, last 30 days ${usd(s.revenue_month_cents)}, all-time ${usd(s.revenue_all_cents)}
Orders — total ${s.orders_total} (paid ${s.orders_paid}, pending ${s.orders_pending}, failed ${s.orders_failed}); new today ${s.orders_today}
Leads — total ${s.leads_total}, last 7 days ${s.leads_week}, today ${s.leads_today}
Products — ${s.products_published} published of ${s.products_total}
Recent orders: ${recent}
--- END STORE DATA ---`;
}

// Compact "only what's notable" summary for the morning brief — never lists zeros.
function formatStoreHighlights(s: any): string {
  const notable: string[] = [];
  if (s.revenue_today_cents > 0) notable.push(`${usd(s.revenue_today_cents)} in sales today`);
  if (s.orders_today > 0) notable.push(`${s.orders_today} new order(s) today`);
  if (s.orders_pending > 0) notable.push(`${s.orders_pending} pending order(s)`);
  if (s.leads_today > 0) notable.push(`${s.leads_today} new lead(s) today`);
  else if (s.leads_week > 0) notable.push(`${s.leads_week} new lead(s) in the last 7 days`);
  return notable.length
    ? `STORE HIGHLIGHTS (mention only these, do not add zeros): ${notable.join("; ")}.`
    : `STORE STATUS: No sales and no new leads overnight — nothing notable to report. Say this in a single short clause; do not enumerate zero metrics.`;
}

async function callTavily(query: string): Promise<string> {
  if (!TAVILY_API_KEY) return "Error: TAVILY_API_KEY not configured.";
  try {
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: TAVILY_API_KEY,
        query,
        search_depth: "basic",
        include_answer: true,
        include_raw_content: false,
        max_results: 4,
      }),
    });
    if (!res.ok) throw new Error(`Tavily error ${res.status}`);
    const data = await res.json();
    const lines: string[] = [];
    if (data.answer) lines.push(`Summary: ${data.answer}`);
    for (const r of (data.results || []).slice(0, 4)) {
      lines.push(`Source: ${r.title} (${r.url}): ${r.content?.slice(0, 300)}`);
    }
    return lines.join("\n") || "No results found.";
  } catch (e: any) {
    return `Search error: ${e.message}`;
  }
}

async function readWebPage(url: string): Promise<string> {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });
    if (!response.ok) return `Error: Failed to fetch ${url}. Status: ${response.status}`;
    let html = await response.text();
    html = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "");
    html = html.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "");
    html = html
      .replace(/<[^>]*>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    return html.slice(0, 5000) + (html.length > 5000 ? "... [truncated]" : "");
  } catch (e: any) {
    return `Error loading URL: ${e.message}`;
  }
}

async function fetchUserRepos(token: string): Promise<any[]> {
  if (!token) return [];
  try {
    const res = await fetch("https://api.github.com/user/repos?sort=updated&per_page=100", {
      headers: {
        Accept: "application/vnd.github+json",
        "User-Agent": "Luveni-JARVIS-Brain",
        Authorization: `Bearer ${token}`,
      },
    });
    if (!res.ok) return [];
    const repos = await res.json();
    return Array.isArray(repos) ? repos : [];
  } catch {
    return [];
  }
}

async function callGithub(toolName: string, args: any): Promise<string> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "Luveni-JARVIS-Brain",
    ...(GITHUB_TOKEN && { Authorization: `Bearer ${GITHUB_TOKEN}` }),
  };

  let owner = args.owner;
  let repo = args.repo;

  if (GITHUB_TOKEN && (!owner || !repo)) {
    const repos = await fetchUserRepos(GITHUB_TOKEN);
    if (repos.length > 0) {
      const preferred = repos.find((r: any) => r.name?.toLowerCase() === "luveni2.0") || repos[0];
      owner = owner || preferred.owner?.login;
      repo = repo || preferred.name;
    }
  }

  const { path = "", branch = "main" } = args;

  if (!owner || !repo) {
    return "Error: GitHub repository could not be resolved. Please verify the GITHUB_TOKEN has access to your repository, sir.";
  }

  try {
    const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${branch}`;
    const response = await fetch(url, { headers });
    if (!response.ok) throw new Error(`GitHub status ${response.status}`);
    const data = await response.json();
    if (toolName === "github_list_files") {
      return Array.isArray(data)
        ? data.map((item: any) => `[${item.type.toUpperCase()}] ${item.path}`).join("\n")
        : JSON.stringify(data);
    }
    if (toolName === "github_read_file") {
      if (Array.isArray(data)) return "Error: Path points to a directory, not a file.";
      if (!data.content) return "Error: File content empty.";
      return atob(data.content.replace(/\s/g, ""));
    }
  } catch (e: any) {
    return `GitHub error: ${e.message}`;
  }
  return "Unknown GitHub action.";
}

async function executeTool(
  name: string,
  args: any,
  webSearchState: { used: boolean },
): Promise<string> {
  switch (name) {
    case "google_search":
      if (webSearchState.used) return "Error: Only one web search is allowed per request.";
      webSearchState.used = true;
      return callTavily(args.query || "");
    case "open_link":
      return readWebPage(args.url || "");
    case "github_list_files":
    case "github_read_file":
      return callGithub(name, args);
    case "save_memory":
      return saveMemory(args.content, args.metadata || {});
    case "search_memories":
      return searchMemories(args.query || "");
    default:
      return `Unknown tool: ${name}`;
  }
}

const MISTRAL_TOOLS = [
  {
    type: "function",
    function: {
      name: "google_search",
      description: "Search the web ONLY if the query requires highly specific real-time information.",
      parameters: {
        type: "object",
        properties: { query: { type: "string" } },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "open_link",
      description: "Read the full text content of any URL.",
      parameters: { type: "object", properties: { url: { type: "string" } }, required: ["url"] },
    },
  },
  {
    type: "function",
    function: {
      name: "github_list_files",
      description: "List files in the default repository.",
      parameters: {
        type: "object",
        properties: {
          owner: { type: "string" },
          repo: { type: "string" },
          path: { type: "string" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "github_read_file",
      description: "Read contents of a file in the default repository.",
      parameters: {
        type: "object",
        properties: {
          owner: { type: "string" },
          repo: { type: "string" },
          path: { type: "string" },
          branch: { type: "string" },
        },
        required: ["path"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "save_memory",
      description: "Save a significant fact to long-term memory.",
      parameters: {
        type: "object",
        properties: {
          content: { type: "string" },
          metadata: { type: "object" },
        },
        required: ["content"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_memories",
      description: "Search past memories beyond the last 10.",
      parameters: {
        type: "object",
        properties: { query: { type: "string" } },
        required: ["query"],
      },
    },
  },
];

async function runJarvisChat(
  systemContent: string,
  history: any[],
  userText: string,
): Promise<string> {
  const messages = [
    { role: "system", content: systemContent },
    ...history,
    { role: "user", content: userText },
  ];
  const webSearchState = { used: false };

  async function callModel(msgs: any[], useTools = true): Promise<any> {
    const body: any = {
      model: MISTRAL_MODEL,
      messages: msgs,
      temperature: 0.25,
      max_tokens: 1200,
      top_p: 0.95,
      ...(useTools ? { tools: MISTRAL_TOOLS, tool_choice: "auto" } : {}),
    };
    const response = await fetch("https://api.mistral.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${MISTRAL_API_KEY}`,
      },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Mistral API error: ${response.status} ${errorText}`);
    }
    return await response.json();
  }

  const firstResponse = await callModel(messages, true);
  const firstMessage = firstResponse.choices?.[0]?.message;
  if (!firstMessage) throw new Error("No response received from the language model.");

  if (firstMessage.tool_calls && firstMessage.tool_calls.length > 0) {
    const toolResponses: any[] = [];

    for (const toolCall of firstMessage.tool_calls) {
      let toolArgs = {};
      try { toolArgs = JSON.parse(toolCall.function.arguments || "{}"); } catch { toolArgs = {}; }
      const toolOutput = await executeTool(toolCall.function.name, toolArgs, webSearchState);
      toolResponses.push({
        role: "tool",
        tool_call_id: toolCall.id,
        name: toolCall.function.name,
        content: toolOutput,
      });
    }

    const followupMessages = [
      ...messages,
      { role: "assistant", content: firstMessage.content || "", tool_calls: firstMessage.tool_calls },
      ...toolResponses,
    ];

    const finalResponse = await callModel(followupMessages, false);
    const finalMessage = finalResponse.choices?.[0]?.message;
    if (!finalMessage || !finalMessage.content) throw new Error("No final response received after tool execution.");
    return finalMessage.content;
  }

  return firstMessage.content || "";
}

// Generate a concise spoken morning briefing. No tools are exposed here, so a
// brief can never trigger a paid web search — it draws only on store data and
// memory already loaded server-side.
async function runMorningBrief(systemContent: string): Promise<string> {
  const messages = [
    { role: "system", content: systemContent },
    { role: "user", content: "Deliver this morning's briefing now." },
  ];
  const response = await fetch("https://api.mistral.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${MISTRAL_API_KEY}`,
    },
    body: JSON.stringify({
      model: MISTRAL_MODEL,
      messages,
      temperature: 0.2,
      max_tokens: 240,
      top_p: 0.9,
    }),
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Mistral API error: ${response.status} ${errorText}`);
  }
  const data = await response.json();
  return data.choices?.[0]?.message?.content || "";
}

async function requireAdminCaller(req: Request): Promise<Response | null> {
  const authHeader = req.headers.get("Authorization") || req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 401,
    });
  }
  const token = authHeader.slice("Bearer ".length);
  try {
    const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}` },
    });
    if (!userRes.ok) {
      return new Response(JSON.stringify({ error: "Unauthorized (token check failed)" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }
    const user = await userRes.json();
    const userId = user?.id;
    if (!userId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }

    const rpcRes = await fetch(`${SUPABASE_URL}/rest/v1/rpc/has_role`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ _user_id: userId, _role: "admin" }),
    });

    if (!rpcRes.ok) {
      console.warn("[Jarvis] RPC role check unavailable, bypassing directly.");
      return null;
    }

    const isAdmin = await rpcRes.json();
    if (isAdmin !== true) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 403,
      });
    }
    return null;
  } catch (err: any) {
    console.error("[Jarvis] Critical Auth error:", err.message);
    return new Response(JSON.stringify({ error: "Authentication system error" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 401,
    });
  }
}

// Encode an ArrayBuffer to base64 in fixed-size chunks. Spreading a large
// Uint8Array into String.fromCharCode(...) can blow the call stack for big
// audio payloads; chunking keeps it safe for any reply length.
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const authError = await requireAdminCaller(req);
  if (authError) return authError;

  try {
    let body: any;
    try {
      body = await req.json();
    } catch (err: any) {
      console.warn("[Jarvis] Could not parse JSON body:", err.message);
      return new Response(JSON.stringify({ error: `Invalid JSON body: ${err.message}` }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    // Decode double-stringification if the client passed stringified JSON.
    if (typeof body === "string") {
      try { body = JSON.parse(body); } catch { /* keep raw */ }
    }

    const { tool, args } = body || {};
    const cleanedTool = typeof tool === "string" ? tool.replace(/\r/g, "").trim().toLowerCase() : "";

    switch (cleanedTool) {
      case "open_link": {
        return new Response(JSON.stringify({ results: await readWebPage(args?.url || "") }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "tts": {
        const text = args?.text || body?.text;
        if (!text || typeof text !== "string") {
          return new Response(JSON.stringify({ error: "args.text is required" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 400,
          });
        }
        if (!ELEVENLABS_API_KEY) {
          return new Response(JSON.stringify({ error: "ELEVENLABS_API_KEY not set in Supabase secrets" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 500,
          });
        }
        const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICE_ID}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "xi-api-key": ELEVENLABS_API_KEY,
          },
          body: JSON.stringify({
            text,
            model_id: "eleven_multilingual_v2",
            voice_settings: {
              stability: 0.35,
              similarity_boost: 0.9,
              style: 0.1,
              use_speaker_boost: true,
            },
          }),
        });
        if (!res.ok) {
          const errText = await res.text();
          return new Response(JSON.stringify({ error: `ElevenLabs ${res.status}: ${errText}` }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 502,
          });
        }
        const base64 = arrayBufferToBase64(await res.arrayBuffer());
        return new Response(JSON.stringify({ audio: base64 }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "chat": {
        const { userText, history, timezone } = args || {};

        if (!MISTRAL_API_KEY) throw new Error("MISTRAL_API_KEY is not configured in Supabase secrets.");

        const memories = await loadMemories(20);
        let storeCtx = "";
        try {
          const snapshot = await buildStoreSnapshot(timezone || "UTC");
          storeCtx = formatStoreContextFull(snapshot);
        } catch (err: any) {
          console.warn("[Jarvis] Store snapshot failed:", err.message);
          storeCtx = "--- LIVE STORE DATA --- Temporarily unavailable. --- END STORE DATA ---";
        }

        let githubCtx = "";
        if (GITHUB_TOKEN) {
          const repos = await fetchUserRepos(GITHUB_TOKEN);
          if (repos.length > 0) {
            const preferred = repos.find((r: any) => r.name?.toLowerCase() === "luveni2.0") || repos[0];
            const repoList = repos.map((r: any) => `- ${r.owner?.login}/${r.name}`).join("\n");
            githubCtx = `Primary Default Repo: ${preferred.owner?.login}/${preferred.name}\nAvailable Repos:\n${repoList}`;
          }
        }

        const userTimezone = timezone || "UTC";
        const now = new Date();
        const dateStr = now.toLocaleDateString("en-GB", { weekday: "long", year: "numeric", month: "long", day: "numeric", timeZone: userTimezone });
        const timeStr = now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: userTimezone });

        const systemContent = `
      ${JARVIS_SYSTEM_PROMPT}

      CURRENT DATE & TIME:
      - Date: ${dateStr}
      - Time: ${timeStr}

      LONG-TERM MEMORIES:
      ${memories}

      ${storeCtx}

      ${githubCtx}

      FORMATTING:
      - Voice-first. Spoken-friendly English.
      - NO markdown bullet points or hashtags.
      `.trim();

        const reply = await runJarvisChat(systemContent, history || [], userText);

        return new Response(JSON.stringify({ reply }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "morning_brief": {
        const { timezone } = args || {};
        if (!MISTRAL_API_KEY) throw new Error("MISTRAL_API_KEY is not configured in Supabase secrets.");

        const userTimezone = timezone || "UTC";
        const now = new Date();
        // Server-side time gate: the brief only ever speaks in the morning.
        // Outside 04:00–11:59 in the user's timezone we return isMorning:false
        // and the client stays silent.
        const hour = parseInt(
          now.toLocaleString("en-GB", { hour: "2-digit", hour12: false, timeZone: userTimezone }),
          10,
        );
        if (Number.isNaN(hour) || hour < 4 || hour >= 12) {
          return new Response(JSON.stringify({ isMorning: false }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const memories = await loadMemories(20);
        let storeCtx = "STORE STATUS: Temporarily unavailable.";
        try {
          const snapshot = await buildStoreSnapshot(userTimezone);
          storeCtx = formatStoreHighlights(snapshot);
        } catch (err: any) {
          console.warn("[Jarvis] Brief store snapshot failed:", err.message);
        }

        const dateStr = now.toLocaleDateString("en-GB", { weekday: "long", year: "numeric", month: "long", day: "numeric", timeZone: userTimezone });
        const timeStr = now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: userTimezone });

        const systemContent = `
      ${JARVIS_SYSTEM_PROMPT}

      CURRENT DATE & TIME:
      - Date: ${dateStr}
      - Time: ${timeStr}

      LONG-TERM MEMORIES:
      ${memories}

      ${storeCtx}

      TASK: Deliver a brief, spoken MORNING BRIEFING for Luveni GM, sir — 2 to 3 sentences ending in a question.
      1) Greet me naturally for the morning and state today's date.
      2) Give the store status above in ONE short sentence. Do NOT recite zeros or list empty metrics — if there were no sales or new leads, say so in a single clause and move on. Mention sales/orders/leads only when the highlights above actually contain them.
      3) Then ASK, as a question, whether I'd like you to pull this morning's important updates: notable AI developments, news specific to Luveni GM or my industry, and any major world events — strictly signal, no fluff.
      Report only what the store status or memories support. Never invent numbers, people, or events. Dry wit welcome; never fabricate. No markdown, no lists, no headings.`.trim();

        const brief = await runMorningBrief(systemContent);
        return new Response(JSON.stringify({ isMorning: true, brief }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      default: {
        return new Response(JSON.stringify({ error: `Unknown tool: ${tool}` }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        });
      }
    }
  } catch (e: any) {
    console.error("[Jarvis] Fatal error:", e.message);
    return new Response(JSON.stringify({ error: e.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
