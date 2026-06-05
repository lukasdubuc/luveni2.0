// ─────────────────────────────────────────────────────────────
//  J.A.R.V.I.S — Luveni GM (Agentic Mode)
//  supabase/functions/jarvis-brain/index.ts
// ─────────────────────────────────────────────────────────────

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

// Using Mistral Large for advanced reasoning
const MISTRAL_MODEL = 'mistral-large-latest'; 
const MISTRAL_ENDPOINT = 'https://api.mistral.ai/v1/chat/completions';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

const SYSTEM_PROMPT = `
You are Jarvis — the autonomous General Manager of Luveni.
You have access to tools. If a user asks for real-time information, weather, or research, use 'web_search'.
Always be executive-level, sharp, and concise. Refer to Luke as 'sir'.
`.trim();

/**
 * Ultra-fast web search resolver using Deno fetch and optimized regex.
 * Zero external libraries or key dependencies.
 */
async function executeWebSearch(query: string): Promise<string> {
  try {
    const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    const response = await fetch(searchUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9"
      }
    });

    if (!response.ok) {
      return `Error: Web search failed with status ${response.status}`;
    }

    const html = await response.text();
    const results: { title: string; link: string; snippet: string }[] = [];

    // Isolate search result blocks
    const blockRegex = /<div class="[^"]*result__body[^"]*">([\s\S]*?)<\/div>\s*<\/div>/g;
    let match;

    while ((match = blockRegex.exec(html)) !== null && results.length < 4) {
      const block = match[1];
      const titleLinkMatch = block.match(/href="([^"]+)"[^>]*class="[^"]*result__a[^"]*"[^>]*>([\s\S]*?)<\/a>/);
      const snippetMatch = block.match(/class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/a>/);
      
      if (titleLinkMatch) {
        let rawUrl = titleLinkMatch[1];
        
        // Clean redirect wrappers
        if (rawUrl.includes("uddg=")) {
          const urlParam = rawUrl.split("uddg=")[1];
          if (urlParam) {
            rawUrl = decodeURIComponent(urlParam.split("&")[0]);
          }
        }
        
        // Strip residual HTML highlights (like <b> tags)
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

  // Round 1: Send input to Mistral to see if it triggers the search tool
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

  // If Mistral requests a web search, handle it transparently on the server
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

      // Execute live web search
      const searchResults = await executeWebSearch(searchQuery);

      // Append tool execution state directly to messages thread
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

      // Round 2: Feed the search results back to Mistral to synthesize the final answer
      const finalRes = await fetch(MISTRAL_ENDPOINT, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: MISTRAL_MODEL,
          messages: updatedMessages,
          tool_choice: 'none', // Force a direct text response on this final pass
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

  // If no tools were called, return standard text response to the client
  return new Response(JSON.stringify(data), {
    status: mistralRes.status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
});
