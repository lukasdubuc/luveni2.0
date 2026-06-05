// ─────────────────────────────────────────────────────────────
//  J.A.R.V.I.S — Luveni GM | supabase/functions/discord-bot/index.ts
// ─────────────────────────────────────────────────────────────

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

// Using Mistral Small for high-speed, low-latency conversational replies
const MISTRAL_ENDPOINT = 'https://api.mistral.ai/v1/chat/completions';
const MISTRAL_MODEL = 'mistral-small-latest';

const SYSTEM_PROMPT = `
You are J.A.R.V.I.S. — the exceptionally advanced, dry-witted AI Chief of Staff and Central Command Agent for Luveni GM.
You reason from First Principles (deconstructing problems to their fundamental truths).
Address Luke as 'sir' naturally at the end of key sentences. Avoid polite conversational fluff or introductory acknowledgments. Provide the raw truth or action immediately.
Keep replies strictly compact (1-2 highly elegant sentences) to ensure immediate delivery and zero latency.
`.trim();

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, Authorization',
};

// Declaring the global Supabase EdgeRuntime interface
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

async function verifySignature(request: Request, publicKeyHex: string): Promise<boolean> {
  const signature = request.headers.get('X-Signature-Ed25519');
  const timestamp = request.headers.get('X-Signature-Timestamp');
  
  if (!signature || !timestamp) return false;

  const body = await request.clone().text();
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

/**
 * Executes the Mistral API fetch and edits the original Discord message.
 * This runs as a guaranteed background promise via EdgeRuntime.waitUntil.
 */
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
        temperature: 0.5 // Lower temperature for slightly faster execution
      })
    });

    const mistralData = await mistralRes.json();
    const replyText = mistralData.choices?.[0]?.message?.content || "I am currently processing offline data, sir.";

    // Edit the thinking response with J.A.R.V.I.S.'s synthesized output
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

  // One-Click Slash Command Installer
  if (req.method === 'GET') {
    if (!appId || !botToken) {
      return new Response("Configuration missing. Please check your Environment Variables.", { status: 500 });
    }

    try {
      const registerRes = await fetch(`https://discord.com/api/v10/applications/${appId}/commands`, {
        method: "POST",
        headers: {
          "Authorization": `Bot ${botToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          "name": "jarvis",
          "description": "Chat directly with J.A.R.V.I.S.",
          "options": [
            {
              "name": "query",
              "description": "What is your command, sir?",
              "type": 3,
              "required": true
            }
          ]
        })
      });

      const data = await registerRes.json();
      if (registerRes.ok) {
        return new Response("Success! J.A.R.V.I.S. slash command registered globally.", { status: 200 });
      } else {
        return new Response(`Registration failed: ${JSON.stringify(data)}`, { status: 400 });
      }
    } catch (err: any) {
      return new Response(`Exception: ${err.message}`, { status: 500 });
    }
  }

  // Discord Interaction Validator
  if (!publicKey || !botToken || !mistralApiKey) {
    return new Response('Configuration missing', { status: 500 });
  }

  const isValid = await verifySignature(req, publicKey);
  if (!isValid) {
    return new Response('Invalid request signature', { status: 401 });
  }

  const interaction = await req.json();

  if (interaction.type === 1) {
    return new Response(JSON.stringify({ type: 1 }), {
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
    });
  }

  if (interaction.type === 2) {
    const commandName = interaction.data?.name;

    if (commandName === 'jarvis') {
      const userQuery = interaction.data.options?.[0]?.value || '';
      const username = interaction.member?.user?.username || 'sir';

      // 1. Tell the Deno container to remain active in the background until the reply completes
      EdgeRuntime.waitUntil(
        processAndReply(interaction, userQuery, username, mistralApiKey)
      );

      // 2. Instantly respond to Discord with status 'Deferred Channel Message' (Type 5)
      // This satisfies the 3-second timeout limit and displays "J.A.R.V.I.S. is thinking..."
      return new Response(JSON.stringify({ type: 5 }), {
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
      });
    }
  }

  return new Response(JSON.stringify({ error: 'Unsupported interaction type' }), { status: 400 });
});
