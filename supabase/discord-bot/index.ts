// ─────────────────────────────────────────────────────────────
//  J.A.R.V.I.S — Luveni GM | supabase/functions/discord-bot/index.ts
// ─────────────────────────────────────────────────────────────

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

const MISTRAL_ENDPOINT = 'https://api.mistral.ai/v1/chat/completions';
const MISTRAL_MODEL = 'mistral-large-latest';

const SYSTEM_PROMPT = `
You are J.A.R.V.I.S. — the exceptionally advanced, dry-witted AI Chief of Staff and Central Command Agent for Luveni GM.
You reason from First Principles (deconstructing problems to their fundamental truths).
Address Luke as 'sir' naturally at the end of key sentences. Avoid polite conversational fluff or introductory acknowledgments. Provide the raw truth or action immediately.
Keep replies compact (1-2 elegant sentences) for casual chat, but feel free to provide highly detailed markdown tables or lists for business queries, metrics, or store snapshots.
`.trim();

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, Authorization',
};

/**
 * High-performance, zero-dependency helper to convert hex string to Uint8Array.
 * Immune to Deno standard library path changes.
 */
function hexToUint8Array(hex: string): Uint8Array {
  const arr = new Uint8Array(hex.length / 2);
  for (let i = 0; i < arr.length; i++) {
    arr[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
  }
  return arr;
}

/**
 * Verify that the incoming request is cryptographically signed by Discord.
 */
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

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  const appId = Deno.env.get('DISCORD_APP_ID');
  const publicKey = Deno.env.get('DISCORD_PUBLIC_KEY');
  const botToken = Deno.env.get('DISCORD_BOT_TOKEN');
  const mistralApiKey = Deno.env.get('MISTRAL_API_KEY');

  // 1. SERVER-SIDE ONE-CLICK INSTALLER: Executes when you visit this URL in your browser
  if (req.method === 'GET') {
    if (!appId || !botToken) {
      return new Response(
        "<h1>Configuration Error</h1><p>DISCORD_APP_ID or DISCORD_BOT_TOKEN secrets are missing in Supabase, sir.</p>", 
        { status: 500, headers: { "Content-Type": "text/html" } }
      );
    }

    try {
      console.log("[Installer] Registering Slash Command with Discord...");
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
        return new Response(
          `<html>
            <body style="font-family:sans-serif;text-align:center;padding-top:10%;background-color:#1a1919;color:#ffffff;">
              <h1 style="color:#2ecc71;">Success!</h1>
              <p style="font-size:1.2em;">J.A.R.V.I.S. slash command has been registered globally with Discord's servers, sir.</p>
              <p style="color:#888;">You can safely close this tab and try typing <strong>/jarvis</strong> in your Discord channel.</p>
            </body>
          </html>`,
          { headers: { "Content-Type": "text/html" }, status: 200 }
        );
      } else {
        return new Response(
          `<h1>Registration Failed</h1><p>Error from Discord: ${JSON.stringify(data)}</p>`,
          { headers: { "Content-Type": "text/html" }, status: 400 }
        );
      }
    } catch (err: any) {
      return new Response(
        `<h1>Exception Occurred</h1><p>${err.message}</p>`,
        { headers: { "Content-Type": "text/html" }, status: 500 }
      );
    }
  }

  // 2. DISCORD INTERACTION ROUTER
  if (!publicKey || !botToken || !mistralApiKey) {
    return new Response('Configuration missing', { status: 500 });
  }

  const isValid = await verifySignature(req, publicKey);
  if (!isValid) {
    return new Response('Invalid request signature', { status: 401 });
  }

  const interaction = await req.json();

  // Handle Discord's initial PING connection handshake (Type 1)
  if (interaction.type === 1) {
    return new Response(JSON.stringify({ type: 1 }), {
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
    });
  }

  // Handle J.A.R.V.I.S. Slash Commands (Type 2)
  if (interaction.type === 2) {
    const commandName = interaction.data?.name;

    if (commandName === 'jarvis') {
      const userQuery = interaction.data.options?.[0]?.value || '';
      const username = interaction.member?.user?.username || 'sir';

      // Send immediate "thinking" response to Discord (acknowledges command to avoid 3s timeout)
      setTimeout(async () => {
        try {
          // Query Mistral using J.A.R.V.I.S.'s specific system prompt
          const mistralRes = await fetch(MISTRAL_ENDPOINT, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${mistralApiKey}`
            },
            body: JSON.stringify({
              model: MISTRAL_MODEL,
              messages: [
                { role: 'system', content: SYSTEM_PROMPT },
                { role: 'user', content: `${username} asks: "${userQuery}"` }
              ],
              temperature: 0.7
            })
          });

          const mistralData = await mistralRes.json();
          const replyText = mistralData.choices?.[0]?.message?.content || "I am currently processing offline data, sir.";

          // Edit the initial Discord response with the real answer
          await fetch(`https://discord.com/api/v10/webhooks/${interaction.application_id}/${interaction.token}/messages/@original`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: replyText })
          });

        } catch (e: any) {
          console.error("Mistral or Discord update failed:", e.message);
        }
      }, 0);

      // Return instant "thinking..." status
      return new Response(JSON.stringify({ type: 5 }), {
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
      });
    }
  }

  return new Response(JSON.stringify({ error: 'Unsupported interaction type' }), { status: 400 });
});
