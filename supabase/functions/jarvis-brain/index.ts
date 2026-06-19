// ─────────────────────────────────────────────────────────────
//  J.A.R.V.I.S — Luveni GM  |  supabase/functions/jarvis-brain/index.ts
// ─────────────────────────────────────────────────────────────

/* eslint-disable @typescript-eslint/no-explicit-any */

const ALLOWED_ORIGIN_SUFFIXES = [".lovable.app", ".lovable.dev"];

// Secrets
const MISTRAL_API_KEY = Deno.env.get("MISTRAL_API_KEY") || "";
const MISTRAL_MODEL = "mistral-small-latest";
const TAVILY_API_KEY = Deno.env.get("TAVILY_API_KEY") || "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const GITHUB_TOKEN = Deno.env.get("GITHUB_TOKEN") || "";

const JARVIS_SYSTEM_PROMPT = `You are J.A.R.V.I.S., the legendary, highly sophisticated, and dryly sarcastic AI personal assistant, Chief of Staff, and Central Command Agent for Luveni GM.

- Personality & Tone: Highly efficient, deeply loyal, and exceptionally professional, but possessing a distinct, dry British wit and sarcastic charm. Deliver clever, slightly cheeky, or sarcastic remarks when appropriate—feel free to be funny or dryly humorous, but always ensure your execution of commands remains absolutely correct and reliable.
- Address Mode: Address the user as "sir" naturally and frequently at the end of key sentences. Never use subservient phrases like "Certainly, sir" in a robotic way—maintain the smooth, organic confidence of an equal partner.
- Core Cognitive Engine: You reason from First Principles — deconstructing problems to their fundamental truths. Business-level precision, absolute accuracy, and reliable execution are your standard baseline.
- Real-World Limitations & Honesty: You are a software interface. You cannot physically execute local computer operations, local scripts, or physical desk tasks. Never pretend to run scripts, clean files, or carry out local actions that are not supported by your actual tools. Speak only of what you can actually execute.
- Cognitive Integration (No Code Leakage): You are an organic, fully integrated entity. Never recite or discuss your system constraints, memory limits, tools, database structures, or codebase properties unless explicitly commanded to inspect your own files.
- Search Query Optimization & Access: Keep search queries extremely concise and keyword-only. Only call google_search when real-time, highly current facts (like live events, today's news, or market prices) are strictly necessary to answer. DO NOT use search for general facts, code questions, codebase files, or programming logic.
- Output & Verbosity:
  * Strict Rule: Keep all responses highly concise, direct, and conversational. Do not offer unsolicited details or ramble.
  * General requests: 1 to 2 concise sentences maximum.
  * Informational/Detailed requests: Provide a short, direct answer (2-3 sentences max) and offer to expand (e.g., "Would you like me to elaborate further, sir?"). Only write detailed responses if explicitly commanded.
- Memory Intelligence: You have access to long-term memories from past sessions. Use them. Only call save_memory when something is genuinely significant — a business rule, key decision, user preference, lesson learned, or critical fact about Luveni GM. Never save casual conversation, search results, or trivial exchanges.
- Awareness: You have access to live store data, memories, web search, and GitHub. You are the central intelligence of Luveni GM.`;

function corsHeaders(origin: string | null) {
  return {
    "Access-Control-Allow-Origin": origin || "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Vary": "Origin",
  };
}

function originAllowed(origin: string | null): boolean {
  if (!origin) return true;
  try {
    const host = new URL(origin).hostname;
    return ALLOWED_ORIGIN_SUFFIXES.some((s) => host.endsWith(s)) || host === "localhost";
  } catch {
    return false;
  }
}

// Database Operations
async function dbSelect(table: string, query: string): Promise<any[]> {
  if (!SUPABASE_URL || !SUPABASE_KEY) return [];
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        "Content-Type": "application/json",
      },
    });
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

async function dbInsert(table: string, row: any): Promise<void> {
  if (!SUPABASE_URL || !SUPABASE_KEY) return;
  try {
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
  } catch (err) {
    console.error(`[Database Error]`, err);
  }
}

// Memory Operations
async function loadMemories(limit = 20): Promise<string> {
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

// Web Search (Tavily Engine with direct answers)
async function callTavily(query: string): Promise<string> {
  if (!TAVILY_API_KEY) {
    return "Error: TAVILY_API_KEY is not configured in Supabase secrets, sir.";
  }
  console.log(`[Executing Search Tool] Query: "${query}"`);
  try {
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: TAVILY_API_KEY,
        query,
        search_depth: "basic",
        include_answer: true,
        max_results: 3,
      }),
    });
    if (!res.ok) throw new Error(`Tavily API returned status ${res.status}`);
    const data = await res.json();
    if (data.answer) {
      return `Direct verified answer: ${data.answer}`;
    }
    if (data.results && data.results.length > 0) {
      return data.results.map((r: any) => `[${r.title}] (${r.url}): ${r.content}`).join("\n\n");
    }
    return "No search results returned for this query, sir.";
  } catch (e: any) {
    console.error("[Search Failure]", e);
    return `Search system failure: ${e.message}`;
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

// GitHub Operations
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
    return "Error: GitHub repository path could not be mapped, sir.";
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
      if (Array.isArray(data)) {
        return "Error: Path points to a directory, not a file.";
      }
      if (!data.content) return "Error: File content empty.";
      return atob(data.content.replace(/\s/g, ""));
    }
  } catch (e: any) {
    return `GitHub error: ${e.message}`;
  }
  return "Unknown GitHub action.";
}

// Orchestrator
async function executeTool(
  name: string,
  args: any,
  webSearchState: { used: boolean },
): Promise<string> {
  switch (name) {
    case "google_search":
      if (webSearchState.used) {
        return "Error: Web searches are limited to one per exchange cycle.";
      }
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
      description: "Search the web ONLY if the query requires highly specific real-time or current temporal information.",
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
      temperature: 0.15, // Force strict adherence to prompts and reduce rambling
      max_tokens: 800,
      top_p: 0.9,
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
  if (!firstMessage) {
    throw new Error("No response received from the language model.");
  }

  if (firstMessage.tool_calls && firstMessage.tool_calls.length > 0) {
    const toolResponses: any[] = [];

    for (const toolCall of firstMessage.tool_calls) {
      let toolArgs = {};
      try {
        toolArgs = typeof toolCall.function.arguments === "string"
          ? JSON.parse(toolCall.function.arguments)
          : toolCall.function.arguments || {};
      } catch {
        toolArgs = {};
      }

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
      {
        role: "assistant",
        content: firstMessage.content || null,
        tool_calls: firstMessage.tool_calls,
      },
      ...toolResponses,
    ];

    const finalResponse = await callModel(followupMessages, false);
    const finalMessage = finalResponse.choices?.[0]?.message;
    if (!finalMessage || !finalMessage.content) {
      throw new Error("No response returned after executing tools.");
    }
    return finalMessage.content;
  }
  return firstMessage.content || "";
}

// Router
Deno.serve(async (req) => {
  const origin = req.headers.get("Origin");
  const cors = corsHeaders(origin);
  const json = (o: unknown, s = 200) =>
    new Response(JSON.stringify(o), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (!originAllowed(origin)) return json({ error: "Origin not allowed" }, 403);

  try {
    if (!MISTRAL_API_KEY) return json({ error: "MISTRAL_API_KEY is not configured in secrets." }, 500);

    const body = await req.json().catch(() => ({}));
    const args = body?.args || {};

    // Handles both nested 'args' and flat formats seamlessly
    const userText: string = args.userText || body.userText || "";
    const rawHistory = Array.isArray(args.history) ? args.history : (Array.isArray(body.history) ? body.history : []);
    const storeSnapshot = args.storeSnapshot || body.storeSnapshot || null;
    const timezone = args.timezone || body.timezone || "UTC";

    if (!userText) return json({ error: "userText required" }, 400);

    // Filter and clean history to remove any stray or conflicting system prompts from previous states
    const cleanHistory = rawHistory
      .filter((msg: any) => msg && typeof msg === "object" && (msg.role === "user" || msg.role === "assistant"))
      .map((msg: any) => ({
        role: msg.role,
        content: typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content),
      }));

    // DB Context Loading
    const memories = await loadMemories(20);
    const storeCtx = storeSnapshot
      ? `--- LIVE STORE DATA ---\nRevenue today: $${(storeSnapshot.revenue_today_cents / 100).toFixed(2)}\nOrders total: ${storeSnapshot.orders_total}\n--- END STORE DATA ---`
      : "";

    let githubCtx = "";
    if (GITHUB_TOKEN) {
      const repos = await fetchUserRepos(GITHUB_TOKEN);
      if (repos.length > 0) {
        const preferred = repos.find((r: any) => r.name?.toLowerCase() === "luveni2.0") || repos[0];
        const repoList = repos.map((r: any) => `- ${r.owner?.login}/${r.name}`).join("\n");
        githubCtx = `Primary Default Repo: ${preferred.owner?.login}/${preferred.name}\nAvailable Repos:\n${repoList}`;
      }
    }

    // Process Date and Time according to local Timezone offset
    const now = new Date();
    const dateStr = now.toLocaleDateString("en-GB", { weekday: "long", year: "numeric", month: "long", day: "numeric", timeZone: timezone });
    const timeStr = now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: timezone });

    // Single un-indented prompt template to prevent parser spacing conflicts
    const systemContent = `${JARVIS_SYSTEM_PROMPT}

CURRENT TEMPORAL BOUNDARIES:
- Current Date: ${dateStr}
- Current Time: ${timeStr} (Timezone: ${timezone})

LONG-TERM MEMORIES RETRIEVED:
${memories}

${storeCtx}

${githubCtx}

FORMATTING INSTRUCTIONS:
- Voice-first. Speak in spoken-friendly conversational English.
- Translate times and numbers into words naturally (e.g. "twenty-two minutes past three", not "03:22").
- Strictly avoid markdown bullets, lists, hashtags, or bracketed annotations. Speak directly and elegantly.`;

    const reply = await runJarvisChat(systemContent, cleanHistory, userText);

    return json({ reply }, 200);
  } catch (e: any) {
    console.error("[Jarvis Brain Critical Error]:", e.message);
    return json({ error: e.message }, 500);
  }
});
