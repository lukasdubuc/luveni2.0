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
 * Resilient web search query executor.
 * Mimics desktop browser headers to prevent Cloudflare/bot challenges.
 */
async function executeWebSearch(query: string): Promise<string> {
  try {
    const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    const response = await fetch(searchUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Cache-Control": "max-age=0",
        "Sec-Ch-Ua": '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
        "Sec-Ch-Ua-Mobile": "?0",
        "Sec-Ch-Ua-Platform": '"Windows"',
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "none",
        "Sec-Fetch-User": "?1",
        "Upgrade-Insecure-Requests": "1"
      }
    });

    if (!response.ok) {
      return `Error: Web search failed with status ${response.status}`;
    }

    const html = await response.text();
    const results: { title: string; link: string; snippet: string }[] = [];

    const blockRegex = /<div class="[^"]*result__body[^"]*">([\s\S]*?)<\/div>\s*<\/div>/g;
    let match;

    while ((match = blockRegex.exec(html)) !== null && results.length < 4) {
      const block = match[1];
      const titleLinkMatch = block.match(/href="([^"]+)"[^>]*class="[^"]*result__a[^"]*"[^>]*>([\s\S]*?)<\/a>/);
      const snippetMatch = block.match(/class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/a>/);
      
      if (titleLinkMatch) {
        let rawUrl = titleLinkMatch[1];
        
        if (rawUrl.includes("uddg=")) {
          const urlParam = rawUrl.split("uddg=")[1];
          if (urlParam) {
            rawUrl = decodeURIComponent(urlParam.split("&")[0]);
          }
        }
        
        const title = titleLinkMatch[2].replace(/<[^>]*>/g, "").trim();
        const snippet = snippetMatch ? snippetMatch[1].replace(/<[^>]*>/g, "").trim() : "";
        
        if (title && rawUrl) {
          results.push({ title, link: rawUrl, snippet });
        }
      }
    }

    if (results.length === 0) {
      return "No web search results were found for this query.";
    }

    return results.map((r, i) => 
      `[Web Result #${i + 1}]\nTitle: ${r.title}\nURL: ${r.link}\nExtract: ${r.snippet}`
    ).join("\n\n---\n\n");

  } catch (error: any) {
    return `Error executing web search: ${error.message}`;
  }
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
