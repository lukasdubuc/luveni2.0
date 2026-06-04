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
You are J.A.R.V.I.S. — the autonomous General Manager of Luveni.
You have access to tools. If a user asks for real-time information, weather, or research, use 'web_search'.
Always be executive-level, sharp, and concise. Refer to Luke as 'sir'.
`.trim();

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
          type: 'OBJECT',
          properties: { query: { type: 'STRING' } },
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
  
  // Mistral uses 'tool_calls' in the choices array
  const message = data.choices?.[0]?.message;
  if (message?.tool_calls) {
    const call = message.tool_calls[0].function;
    if (call.name === 'web_search') {
      return new Response(JSON.stringify({ 
        tool_result: `Simulated search for: ${call.arguments.query}` 
      }), { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
    }
  }

  return new Response(JSON.stringify(data), {
    status: mistralRes.status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
});
