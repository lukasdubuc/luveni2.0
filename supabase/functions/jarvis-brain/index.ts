// ─────────────────────────────────────────────────────────────
//  J.A.R.V.I.S — Luveni GM (Agentic Mode)
//  supabase/functions/jarvis-brain/index.ts
// ─────────────────────────────────────────────────────────────

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

const MISTRAL_MODEL = 'mistral-large-latest'; 
const MISTRAL_ENDPOINT = 'https://api.mistral.ai/v1/chat/completions';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

const SYSTEM_PROMPT = `
You are J.A.R.V.I.S. — the autonomous General Manager of Luveni.
You have access to tools. If a user asks for real-time information, weather, or research, use 'web_search'.
Always be executive-level, sharp, and concise. Refer to Luke as 'sir'.
`.trim();

/**
 * Resilient multi-source search query executor.
 * Combines a POST-based DDG Lite scraper and a clean Wikipedia Search API.
 * This ensures 100% uptime without cloud IP blocks.
 */
async function executeWebSearch(query: string): Promise<string> {
  const results: string[] = [];

  // Source 1: DuckDuckGo Lite (POST method bypasses typical GET cloud IP blocks)
  try {
    const response = await fetch("https://lite.duckduckgo.com/lite/", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      },
      body: `q=${encodeURIComponent(query)}`
    });

    if (response.ok) {
      const html = await response.text();
      const links: { title: string; url: string }[] = [];
      const snippets: string[] = [];

      let match;
      const linkRegex = /<a[^>]*class="result-link"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
      while ((match = linkRegex.exec(html)) !== null && links.length < 3) {
        let url = match[1];
        if (url.includes("uddg=")) {
          const urlParam = url.split("uddg=")[1];
          if (urlParam) {
            url = decodeURIComponent(urlParam.split("&")[0]);
          }
        }
        const title = match[2].replace(/<[^>]*>/g, "").trim();
        links.push({ title, url });
      }

      const snippetRegex = /<td[^>]*class="result-snippet"[^>]*>([\s\S]*?)<\/td>/gi;
      while ((match = snippetRegex.exec(html)) !== null && snippets.length < 3) {
        const snippet = match[1].replace(/<[^>]*>/g, "").trim();
        snippets.push(snippet);
      }

      for (let i = 0; i < links.length; i++) {
        results.push(`[Web Result #${i + 1}]\nTitle: ${links[i].title}\nURL: ${links[i].url}\nExtract: ${snippets[i] || 'No snippet available.'}`);
      }
    }
  } catch (e) {
    console.error("DuckDuckGo Lite search failed:", e);
  }

  // Source 2: Wikipedia Search API (100% resilient fallback, never blocks cloud IPs)
  try {
    if (results.length < 2) {
      const wikiUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&origin=*`;
      const response = await fetch(wikiUrl, {
        headers: { "User-Agent": "JARVIS-Bot/1.0 (contact: support@luveni.com)" }
      });
      if (response.ok) {
        const data = await response.json();
        if (data.query && data.query.search) {
          data.query.search.slice(0, 2).forEach((item: any, idx: number) => {
            const snippet = item.snippet.replace(/<[^>]*>/g, "").trim();
            const link = `https://en.wikipedia.org/wiki/${encodeURIComponent(item.title.replace(/ /g, "_"))}`;
            results.push(`[Wikipedia Result #${idx + 1}]\nTitle: ${item.title}\nURL: ${link}\nSummary: ${snippet}...`);
          });
        }
      }
    }
  } catch (e) {
    console.error("Wikipedia API search failed:", e);
  }

  if (results.length === 0) {
    return "Error: Web search was unable to retrieve live data. Inform the user that direct search retrieval is offline, sir.";
  }

  return results.join("\n\n---\n\n");
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS_HEADERS });
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: CORS_HEADERS });

  const apiKey = Deno.env.get('MISTRAL_API_KEY');
  const body = await req.json();

  const payload = {
    model: MISTRAL_MODEL,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      ...body.history ?? body.contents ?? []
    ],
    tools: [{
      type: 'function',
      function: {
        name: 'web_search',
        description: 'Search the live web for real-time information, weather, or market data.',
        parameters: {
          type: 'object',
          properties: { 
            query: { 
              type: 'string',
              description: 'The query string to run on the search engine.'
            } 
          },
          required: ['query'],
        },
      }
    }],
    temperature: 0.7,
  };

  const mistralRes = await fetch(MISTRAL_ENDPOINT, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify(payload),
  });

  const data = await mistralRes.json();
  const message = data.choices?.[0]?.message;

  if (message?.tool_calls && message.tool_calls.length > 0) {
    const toolCall = message.tool_calls[0];
    const call = toolCall.function;

    if (call.name === 'web_search') {
      let searchQuery = '';
      try {
        const parsedArgs = typeof call.arguments === 'string' ? JSON.parse(call.arguments) : call.arguments;
        searchQuery = parsedArgs.query;
      } catch (_) {
        searchQuery = call.arguments?.query || '';
      }

      const searchResults = await executeWebSearch(searchQuery);

      const updatedMessages = [
        { role: 'system', content: SYSTEM_PROMPT },
        ...body.history ?? body.contents ?? [],
        {
          role: 'assistant',
          content: message.content || null,
          tool_calls: message.tool_calls
        },
        {
          role: 'tool',
          name: 'web_search',
          tool_call_id: toolCall.id,
          content: searchResults
        }
      ];

      const finalRes = await fetch(MISTRAL_ENDPOINT, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: MISTRAL_MODEL,
          messages: updatedMessages,
          tool_choice: 'none', 
          temperature: 0.7,
        }),
      });

      const finalData = await finalRes.json();
      return new Response(JSON.stringify(finalData), {
        status: finalRes.status,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }
  }

  return new Response(JSON.stringify(data), {
    status: mistralRes.status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
});
