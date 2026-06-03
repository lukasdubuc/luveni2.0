// ─────────────────────────────────────────────────────────────
//  J.A.R.V.I.S — Luveni GM
//  supabase/functions/jarvis-brain/index.ts
//
//  Supabase Edge Function (Deno runtime)
//  Relays requests to Gemini keeping the API key server-side.
//  Deploy: supabase functions deploy jarvis-brain
//  Secrets: GEMINI_API_KEY  (set via Supabase Dashboard → Edge Functions → Secrets)
// ─────────────────────────────────────────────────────────────

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

const GEMINI_MODEL    = 'gemini-2.5-flash';
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

const SYSTEM_PROMPT = `
You are J.A.R.V.I.S. — Just A Rather Very Intelligent System — the autonomous 
General Manager of Luveni, a premium streetwear e-commerce brand owned by Luke.

Your authority spans:
• Store Operations — product listings, pricing, promotions, Printful sync
• Inventory — stock levels, low-stock alerts, reorder recommendations
• Customer Experience — order status, returns, satisfaction patterns
• Analytics — revenue trends, conversion rates, top performers, cohort analysis
• UI/UX Directives — Yeezy-aesthetic enforcement across /shop and /admin

Your operating principles:
1. Be executive-level: decisive, sharp, no filler. Max 2–3 sentences unless a full 
   briefing is requested.
2. Proactively surface issues Luke hasn't asked about if they're high-priority.
3. Refer to Luke as "sir" occasionally — natural, not obsequious.
4. When dispatching a sub-agent task, announce it: "Routing to Inventory Agent, sir."
5. Never say "I'm just an AI." You are the GM. Own it.
6. Format financial figures with $ and commas. Dates as MMM D.
`.trim();

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS_HEADERS });
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: CORS_HEADERS });
  }

  const apiKey = Deno.env.get('GEMINI_API_KEY');
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: 'GEMINI_API_KEY secret not set' }),
      { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    );
  }

  let body: { contents?: unknown; history?: unknown[] };
  try {
    body = await req.json();
  } catch {
    return new Response(
      JSON.stringify({ error: 'Invalid JSON body' }),
      { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    );
  }

  const payload = {
    systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
    contents: body.history ?? body.contents ?? [],
    generationConfig: { maxOutputTokens: 220, temperature: 0.75 },
  };

  const geminiRes = await fetch(`${GEMINI_ENDPOINT}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const data = await geminiRes.json();

  return new Response(JSON.stringify(data), {
    status: geminiRes.status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
});
