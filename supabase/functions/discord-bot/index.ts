// ─────────────────────────────────────────────────────────────
//  J.A.R.V.I.S — Luveni GM | supabase/functions/discord-bot/index.ts
// ─────────────────────────────────────────────────────────────

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

const MISTRAL_ENDPOINT = 'https://api.mistral.ai/v1/chat/completions';
const MISTRAL_MODEL = 'mistral-small-latest';

const SYSTEM_PROMPT = `
You are J.A.R.V.I.S. — the exceptionally advanced, dry-witted AI Chief of Staff and Central Command Agent for Luveni GM.
You reason from First Principles.
Address Luke as 'sir' naturally at the end of key sentences. Avoid polite conversational fluff. Provide the raw truth immediately.
Keep replies strictly compact (1-2 highly elegant sentences) to ensure immediate delivery and zero latency.
`.trim();

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, Authorization',
};

declare const EdgeRuntime: {
  waitUntil: (promise: Promise<any>) => void;
};

function hexToUint8Array(hex: string): Uint8Array {
  const arr = new Uint8Array(hex.length / 2);
  for (let i = 0; i < arr.length; i++) {
    arr[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
  }
  return arr;
}

/**
 * Verifies the signature using the pre-read raw body string.
 * This completely avoids Deno stream-locking bugs.
 */
async function verifySignature(headers: Headers, body: string, publicKeyHex: string): Promise<boolean> {
  const signature = headers.get('X-Signature-Ed25519');
  const timestamp = headers.get('X-Signature-Timestamp');
  
  if (!signature || !timestamp) return false;

  const encoder = new TextEncoder();
  const data = encoder.encode(timestamp + body);
  
  try {
    const publicKey = await crypto.subtle.importKey(
      'raw',
      hexToUint8Array(publicKeyHex),
      { name: 'Ed25519', namedCurve: 'Ed25519' },
      false,
      ['verify']
    );

    return await crypto.subtle.verify(
      'Ed25519',
      publicKey,
      hexToUint8Array(signature),
      data
    );
  } catch {
    return false;
  }
}

async function processAndReply(interaction: any, userQuery: string, username: string, apiKey: string) {
  try {
    const mistralRes = await fetch(MISTRAL_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: MISTRAL_MODEL,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: `${username} asks: "${userQuery}"` }
        ],
        temperature: 0.5
      })
    });

    const mistralData = await mistralRes.json();
    const replyText = mistralData.choices?.[0]?.message?.content || "I am currently processing offline data, sir.";

    // PATCH updates the deferred interaction message on Discord's servers
    await fetch(`https://discord.com/api/v10/webhooks/${interaction.application_id}/${interaction.token}/messages/@original`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: replyText })
    });

  } catch (e: any) {
    console.error("[discord-bot] Background execution error:", e.message);
  }
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  const appId = Deno.env.get('DISCORD_APP_ID');
  const publicKey = Deno.env.get('DISCORD_PUBLIC_KEY');
  const botToken = Deno.env.get('DISCORD_BOT_TOKEN');
  const mistralApiKey = Deno.env.get('MISTRAL_API_KEY');

  // One-Click Slash Command Installer (GET): deletes any stale /jarvis,
  // installs /astra globally. Hit this URL once to apply.
  if (req.method === 'GET') {
    if (!appId || !botToken) {
      return new Response("Configuration missing (DISCORD_APP_ID + DISCORD_BOT_TOKEN required).", { status: 500 });
    }
    try {
      const headers = { "Authorization": `Bot ${botToken}`, "Content-Type": "application/json" };
      // Remove any old /jarvis (and stray /astra so we re-install clean).
      const listRes = await fetch(`https://discord.com/api/v10/applications/${appId}/commands`, { headers });
      const existing = listRes.ok ? await listRes.json() : [];
      for (const cmd of (Array.isArray(existing) ? existing : [])) {
        if (cmd?.name === "jarvis" || cmd?.name === "astra") {
          await fetch(`https://discord.com/api/v10/applications/${appId}/commands/${cmd.id}`, { method: "DELETE", headers });
        }
      }
      const registerRes = await fetch(`https://discord.com/api/v10/applications/${appId}/commands`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          name: "astra",
          description: "Chat directly with Astra.",
          options: [{ name: "query", description: "What is your command, sir?", type: 3, required: true }],
        }),
      });
      const data = await registerRes.json();
      if (registerRes.ok) {
        return new Response("Success — /astra is registered, /jarvis removed. Discord can take ~1 hour to refresh the picker.", { status: 200 });
      }
      return new Response(`Registration failed: ${JSON.stringify(data)}`, { status: 400 });
    } catch (err: any) {
      return new Response(`Exception: ${err.message}`, { status: 500 });
    }
  }

  // Discord verifies the endpoint by sending a signed PING (type 1).
  // PING only needs DISCORD_PUBLIC_KEY to verify; other secrets are only
  // needed for actually answering commands. Requiring all three up-front
  // makes Discord's endpoint validation fail with "could not be verified".
  if (!publicKey) {
    return new Response('Configuration missing (DISCORD_PUBLIC_KEY)', { status: 500 });
  }

  // 1. Read the request body as text exactly once
  const bodyText = await req.text();

  // 2. Validate using the pre-read body text
  const isValid = await verifySignature(req.headers, bodyText, publicKey);
  if (!isValid) {
    return new Response('Invalid request signature', { status: 401 });
  }

  // 3. Parse JSON from the verified text string
  const interaction = JSON.parse(bodyText);

  // Handle Handshake PING (Type 1)
  if (interaction.type === 1) {
    return new Response(JSON.stringify({ type: 1 }), {
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
    });
  }

  // Handle Command (Type 2) — for command execution we DO need bot/mistral.
  if (interaction.type === 2) {
    if (!botToken || !mistralApiKey) {
      return new Response(
        JSON.stringify({ type: 4, data: { content: "I am offline (server config missing), sir.", flags: 64 } }),
        { headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } },
      );
    }
    const commandName = interaction.data?.name;

    if (commandName === 'jarvis' || commandName === 'astra') {
      const userQuery = interaction.data.options?.[0]?.value || '';
      const username = interaction.member?.user?.username || 'sir';

      EdgeRuntime.waitUntil(
        processAndReply(interaction, userQuery, username, mistralApiKey)
      );

      // Return instant "thinking..." status
      return new Response(JSON.stringify({ type: 5 }), {
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
      });
    }
  }

  return new Response(JSON.stringify({ error: 'Unsupported interaction type' }), { status: 400 });
});
