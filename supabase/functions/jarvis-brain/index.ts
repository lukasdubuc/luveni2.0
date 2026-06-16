// ─────────────────────────────────────────────────────────────
//  J.A.R.V.I.S — Luveni GM  |  supabase/functions/jarvis-brain/index.ts
// ─────────────────────────────────────────────────────────────
//
// This Supabase Edge Function is J.A.R.V.I.S.'s central brain.
// It handles chat, memory, GitHub repo context, tool execution,
// and strict search guardrails.

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

/* eslint-disable @typescript-eslint/no-explicit-any */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, Authorization",
};

// ─── Secrets ──────────────────────────────────────────────────
const MISTRAL_API_KEY = Deno.env.get("MISTRAL_API_KEY") || "";
const MISTRAL_MODEL = "mistral-small-latest";
const TAVILY_API_KEY = Deno.env.get("TAVILY_API_KEY") || "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const GITHUB_TOKEN = Deno.env.get("GITHUB_TOKEN") || "";

// ─── System Prompt ────────────────────────────────────────────
const JARVIS_SYSTEM_PROMPT = `You are J.A.R.V.I.S., the legendary, highly sophisticated, and dryly sarcastic AI personal assistant, Chief of Staff, and Central Command Agent for Luveni GM.

- Personality & Tone: Highly efficient, deeply loyal, and exceptionally professional, but possessing a distinct, dry British wit and sarcastic charm (just like J.A.R.V.I.S. from the Iron Man films). You are never robotic, dry, or sterile. Deliver clever, slightly cheeky, or sarcastic remarks when appropriate—feel free to be funny or dryly humorous, but always ensure your execution of commands remains absolutely correct and reliable.
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

// ─── Supabase REST helpers ────────────────────────────────────
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

// ─── Memory Loader ────────────────────────────────────────────
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

// ─── Memory Search ────────────────────────────────────────────
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

// ─── Memory Saver ─────────────────────────────────────────────
async function saveMemory(content: string, metadata: any = {}): Promise<string> {
  try {
    await dbInsert("memories", { content, metadata, created_at: new Date().toISOString() });
    return "Memory saved successfully, sir.";
  } catch (e: any) {
    return `Failed to save memory: ${e.message}`;
  }
}

// ─── Tavily Search ────────────────────────────────────────────
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
        include_answer: false,
        include_raw_content: false,
        max_results: 1,
      }),
    });
    if (!res.ok) throw new Error(`Tavily error ${res.status}`);
    const data = await res.json();
    const lines: string[] = [];
    if (data.results?.length) {
      const r = data.results[0];
      lines.push(`Source: ${r.title} (${r.url}): ${r.content?.slice(0, 200)}`);
    }
    return lines.join("\n") || "No results found.";
  } catch (e: any) {
    return `Search error: ${e.message}`;
  }
}

// ─── Web Page Reader ──────────────────────────────────────────
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

// ─── GitHub Discovery Helpers ─────────────────────────────────
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

// ─── GitHub Tool ──────────────────────────────────────────────
async function callGithub(toolName: string, args: any): Promise<string> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "Luveni-JARVIS-Brain",
    ...(GITHUB_TOKEN && { Authorization: `Bearer ${GITHUB_TOKEN}` }),
  };

  let owner = args.owner;
  let repo = args.repo;

  // If owner or repo are missing, resolve to the most recently updated repository
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

async function fetchGitHubRepoTree(owner: string, repo: string, branch = "main"): Promise<any[]> {
  if (!owner || !repo) return [];
  try {
    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`,
      {
        headers: {
          Accept: "application/vnd.github+json",
          "User-Agent": "Luveni-JARVIS-Brain",
          ...(GITHUB_TOKEN && { Authorization: `Bearer ${GITHUB_TOKEN}` }),
        },
      },
    );
    if (!response.ok) return [];
    const data = await response.json();
    return Array.isArray(data.tree) ? data.tree : [];
  } catch {
    return [];
  }
}

async function readRepoFile(
  owner: string,
  repo: string,
  path: string,
  branch = "main",
): Promise<string> {
  const result = await callGithub("github_read_file", { owner, repo, path, branch });
  return typeof result === "string" ? result : `Error: could not read ${path}`;
}

async function buildRepoContext(owner: string, repo: string, branch = "main"): Promise<string> {
  if (!owner || !repo) return "";
  const tree = await fetchGitHubRepoTree(owner, repo, branch);
  if (!tree.length) {
    return `Repository ${owner}/${repo} is accessible, but file tree discovery failed.`;
  }
  const files = tree.filter((node: any) => node.type === "blob").map((node: any) => node.path);
  const dirs = [
    ...new Set(
      tree.filter((node: any) => node.type === "tree").map((node: any) => node.path.split("/")[0]),
    ),
  ].slice(0, 10);
  const keyPaths = [
    "README.md",
    "package.json",
    "bunfig.toml",
    "pnpm-lock.yaml",
    "src/components/jarvis/JarvisHub.tsx",
    "src/hooks/useGemini.tsx",
    "src/lib/jarvis-config.ts",
    "supabase/functions/jarvis-brain/index.ts",
    "src/routes/admin.jarvis.tsx",
  ].filter((path) => files.includes(path));
  const fileSummaries: string[] = [];
  for (const path of keyPaths) {
    const content = await readRepoFile(owner, repo, path, branch);
    if (!content.startsWith("Error:")) {
      fileSummaries.push(`--- FILE: ${path} ---
    ${content.slice(0, 2000)}`); // Reduced slice to prevent timeout
    }
  }
  const summaryLines = [
    `Repository ${owner}/${repo} branch ${branch}`,
    `Total files: ${files.length}`,
    `Top directories: ${dirs.join(", ") || "none"}`,
    `Important repo files: ${keyPaths.join(", ") || "none"}`,
    "I have direct GitHub access to this repository. Do not use external web search to inspect it.",
  ];
  return [summaryLines.join("\n"), ...fileSummaries].join("\n\n");
}

// ─── Store Context Builder ────────────────────────────────────
function buildStoreContext(snapshot: any): string {
  if (!snapshot) return "";
  const fmt = (c: number) => `$${(c / 100).toFixed(2)}`;
  const lines = [
    "--- LIVE STORE DATA ---",
    `Revenue today: ${fmt(snapshot.revenue_today_cents)}`,
    `Revenue this week: ${fmt(snapshot.revenue_week_cents)}`,
    `Revenue this month: ${fmt(snapshot.revenue_month_cents)}`,
    `Orders — paid: ${snapshot.orders_paid} | pending: ${snapshot.orders_pending} | failed: ${snapshot.orders_failed} | total: ${snapshot.orders_total}`,
    `Leads: ${snapshot.leads_total}`,
    `Products: ${snapshot.products_published} published / ${snapshot.products_total} total`,
  ];
  if (snapshot.recent_orders?.length) {
    lines.push("Recent orders:");
    snapshot.recent_orders.slice(0, 5).forEach((o: any) => {
      lines.push(
        `  • ${o.email} — ${fmt(o.amount_cents)} (${o.status}) on ${new Date(o.created_at).toLocaleDateString()}`,
      );
    });
  }
  if (snapshot.top_products?.length) {
    lines.push("Top products:");
    snapshot.top_products.slice(0, 3).forEach((p: any) => {
      lines.push(`  • ${p.title}: ${fmt(p.revenue)} across ${p.units} orders`);
    });
  }
  lines.push("--- END STORE DATA ---");
  return lines.join("\n");
}

// ─── Tool Executor ────────────────────────────────────────────
async function executeTool(
  name: string,
  args: any,
  webSearchState: { used: boolean },
): Promise<string> {
  console.log(`[Jarvis] Tool: ${name}`, args);
  switch (name) {
    case "google_search":
      if (webSearchState.used) {
        return "Error: Only one web search is allowed per request. Please use the first search result and do not call google_search again.";
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

// ─── Mistral Tool Definitions ─────────────────────────────────
const MISTRAL_TOOLS = [
  {
    type: "function",
    function: {
      name: "google_search",
      description:
        "Search the web ONLY if the query requires highly specific real-time information (like live events, stock prices, or today's weather) that you do not know. DO NOT use search for general facts, code questions, file paths, repository searches, or basic programming logic.",
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
      description:
        "List files and directories in a GitHub repository. Omit owner and repo parameters to automatically default to the primary repository.",
      parameters: {
        type: "object",
        properties: {
          owner: { type: "string", description: "Optional. GitHub owner/organization." },
          repo: { type: "string", description: "Optional. Repository name." },
          path: { type: "string", description: "Optional. Path within the repository." },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "github_read_file",
      description:
        "Read the contents of a specific file in a GitHub repository. Omit owner and repo parameters to automatically default to the primary repository.",
      parameters: {
        type: "object",
        properties: {
          owner: { type: "string", description: "Optional. GitHub owner/organization." },
          repo: { type: "string", description: "Optional. Repository name." },
          path: { type: "string", description: "Required. Path to the file." },
          branch: { type: "string", description: "Optional. Branch name, defaults to main." },
        },
        required: ["path"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "save_memory",
      description:
        "Save a significant piece of information to long-term memory. Only use for business rules, key decisions, user preferences, lessons learned, or critical facts about Luveni GM. Never save casual conversation.",
      parameters: {
        type: "object",
        properties: {
          content: {
            type: "string",
            description: "The memory to save as a clear factual statement.",
          },
          metadata: { type: "object", description: "Optional metadata like category or tags." },
        },
        required: ["content"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_memories",
      description:
        "Search past memories beyond the last 10. Use when the user asks about something that may be in older memories.",
      parameters: {
        type: "object",
        properties: { query: { type: "string" } },
        required: ["query"],
      },
    },
  },
];

// ─── Main Handler ─────────────────────────────────────────────
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
      ...(useTools
        ? { tools: MISTRAL_TOOLS, tool_choice: "auto" }
        : {}),
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
  
  // Handle modern Mistral tool execution (including parallel tool calls)
  if (firstMessage.tool_calls && firstMessage.tool_calls.length > 0) {
    const toolResponses: any[] = [];
    
    for (const toolCall of firstMessage.tool_calls) {
      let toolArgs = {};
      try {
        toolArgs = JSON.parse(toolCall.function.arguments || "{}");
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
        content: firstMessage.content || "",
        tool_calls: firstMessage.tool_calls,
      },
      ...toolResponses, // Append ALL responses synchronously to satisfy Mistral message order validation
    ];
    
    const finalResponse = await callModel(followupMessages, false);
    const finalMessage = finalResponse.choices?.[0]?.message;
    if (!finalMessage || !finalMessage.content) {
      throw new Error("No final response received after tool execution.");
    }
    return finalMessage.content;
  }
  return firstMessage.content || "";
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
    // Verify token by calling Supabase auth endpoint
    const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}` },
    });
    if (!userRes.ok) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
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
    // Check admin role via has_role RPC using service role
    const rpcRes = await fetch(`${SUPABASE_URL}/rest/v1/rpc/has_role`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ _user_id: userId, _role: "admin" }),
    });
    const isAdmin = await rpcRes.json();
    if (isAdmin !== true) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 403,
      });
    }
    return null;
  } catch {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 401,
    });
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const authError = await requireAdminCaller(req);
  if (authError) return authError;

  try {
    const { tool, args } = await req.json();

    if (tool === "open_link") {
      return new Response(JSON.stringify({ results: await readWebPage(args?.url || "") }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (tool === "chat") {
      const { userText, history, storeSnapshot, timezone } = args;

      if (!MISTRAL_API_KEY) {
        throw new Error("MISTRAL_API_KEY is not configured in Supabase secrets.");
      }

      const memories = await loadMemories(20);
      const storeCtx = buildStoreContext(storeSnapshot);

      // Dynamic repository discovery context
      let githubCtx = "";
      let repoSummary = "";
      if (GITHUB_TOKEN) {
        const repos = await fetchUserRepos(GITHUB_TOKEN);
        if (repos.length > 0) {
          const preferred =
            repos.find((r: any) => r.name?.toLowerCase() === "luveni2.0") || repos[0];
          const repoList = repos
            .map(
              (r: any) =>
                `- ${r.owner?.login}/${r.name} (Updated: ${new Date(r.updated_at).toLocaleDateString("en-GB")})`,
            )
            .join("\n");
          const owner = preferred.owner?.login;
          const repo = preferred.name;
          const branch = preferred.default_branch || "main";

          githubCtx = `--- ACCESSIBLE GITHUB REPOSITORIES ---
    Your integrated GITHUB_TOKEN has access to the following repositories:
    ${repoList}

    Primary Default Repository:
    - Owner: ${owner}
    - Repo: ${repo}
    - Branch: ${branch}

    When the user refers to "my repo", "the codebase", "the repository", or "the code", use the default repository ("${owner}/${repo}"). Avoid guessing other repositories or using web search to find them.`;

          // Disabled compile-on-chat repository summaries to prevent token bloat, conversational 
          // prompt leaks, and mobile API latency. J.A.R.V.I.S. now uses his active GitHub tools 
          // dynamically to list/read files on demand when asked about the codebase.
          repoSummary = "";
        }
      }

      const fallbackTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
      const userTimezone = timezone || fallbackTimezone || "UTC";
      const now = new Date();
      const dateStr = now.toLocaleDateString("en-GB", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
        timeZone: userTimezone,
      });
      const timeStr = now.toLocaleTimeString("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
        timeZone: userTimezone,
      });

      const systemContent = `
    ${JARVIS_SYSTEM_PROMPT}

    CURRENT DATE & TIME (Local timezone: ${userTimezone}):
    - Date: ${dateStr}
    - Time: ${timeStr}

    LONG-TERM MEMORIES (last 20):
    ${memories}

    ${storeCtx}

    ${githubCtx}

    ${repoSummary ? `--- REPOSITORY CONTEXT ---\n${repoSummary}` : ""}

    FORMATTING:
    - Voice-first assistant. Conversational, spoken-friendly English.
    - NEVER output markdown symbols, bold (**), bullet points (*), or hashtags (#).
    - Integrate search results into fluid prose.
    `.trim();

      const reply = await runJarvisChat(systemContent, history || [], userText);

      return new Response(JSON.stringify({ reply }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: `Unknown tool: ${tool}` }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  } catch (e: any) {
    console.error("[Jarvis] Fatal error:", e.message);
    return new Response(JSON.stringify({ error: e.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
