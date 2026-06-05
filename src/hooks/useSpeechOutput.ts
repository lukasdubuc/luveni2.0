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
 * Robust web search resolver using Google RSS and DuckDuckGo Instant Answer APIs.
 * This avoids scraping blocks because it targets public feeds and official APIs.
 */
async function executeWebSearch(query: string): Promise<string> {
  const results: string[] = [];

  // Source 1: Google RSS Search (Extremely reliable, real-time news and web indexing, never blocks)
  try {
    const rssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`;
    const response = await fetch(rssUrl, {
      headers: { "User-Agent": "Mozilla/5.0 J.A.R.V.I.S. Bot" }
    });

    if (response.ok) {
      const xml = await response.text();
      // Match <item> blocks containing <title> and <link>
      const itemRegex = /<item>[\s\S]*?<title>([\s\S]*?)<\/title>[\s\S]*?<link>([\s\S]*?)<\/link>[\s\S]*?<\/item>/g;
      let match;
      let count = 0;

      while ((match = itemRegex.exec(xml)) !== null && count < 3) {
        const title = match[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").trim();
        const link = match[2].trim();
        results.push(`[Google RSS Result #${count + 1}]\nTitle: ${title}\nURL: ${link}`);
        count++;
      }
    }
  } catch (e) {
    console.error("Google RSS retrieval failed:", e);
  }

  // Source 2: DuckDuckGo Instant Answer API (Fallback for quick answers and definitions)
  try {
    if (results.length < 2) {
      const ddgUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
      const response = await fetch(ddgUrl);
      if (response.ok) {
        const data = await response.json();
        if (data.AbstractText) {
          results.push(`[DDG Instant Answer]\nAnswer: ${data.AbstractText}\nSource: ${data.AbstractURL || 'DuckDuckGo'}`);
        }
        if (data.RelatedTopics && data.RelatedTopics.length > 0) {
          data.RelatedTopics.slice(0, 2).forEach((topic: any, idx: number) => {
            if (topic.Text && topic.FirstURL) {
              results.push(`[DDG Related Fact #${idx + 1}]\nFact: ${topic.Text}\nURL: ${topic.FirstURL}`);
            }
          });
        }
      }
    }
  } catch (e) {
    console.error("DuckDuckGo API retrieval failed:", e);
  }

  if (results.length === 0) {
    return "Error: Web search was unable to retrieve live data. Please inform the user that live retrieval is temporarily offline, sir.";
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
