// ─────────────────────────────────────────────────────────────
//  J.A.R.V.I.S — Luveni GM (Agentic Mode)
//  supabase/functions/jarvis-brain/index.ts
// ─────────────────────────────────────────────────────────────

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

const GEMINI_MODEL = 'gemini-2.0-flash'; // Updated to 2.0 for better agentic capabilities
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

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

  const apiKey = Deno.env.get('GEMINI_API_KEY');
  const body = await req.json();

  const payload = {
    systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
    contents: body.history ?? body.contents ?? [],
    tools: [{
      functionDeclarations: [{
        name: 'web_search',
        description: 'Search the live web for real-time information, weather, or market data.',
        parameters: {
          type: 'OBJECT',
          properties: { query: { type: 'STRING' } },
          required: ['query'],
        },
      }]
    }],
    generationConfig: { temperature: 0.7 },
  };

  const geminiRes = await fetch(`${GEMINI_ENDPOINT}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const data = await geminiRes.json();
  
  // Check if J.A.R.V.I.S wants to call a tool
  const candidate = data.candidates?.[0];
  if (candidate?.content?.parts?.[0]?.functionCall) {
    const call = candidate.content.parts[0].functionCall;
    
    if (call.name === 'web_search') {
      // In a real scenario, you'd call a search API here (e.g., Serper or Google Search API)
      // For now, return a placeholder result so J.A.R.V.I.S knows the tool was "called"
      return new Response(JSON.stringify({ 
        tool_result: `Simulated search for: ${call.args.query}` 
      }), { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
    }
  }

  return new Response(JSON.stringify(data), {
    status: geminiRes.status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
});
