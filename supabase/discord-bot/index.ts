// ─────────────────────────────────────────────────────────────
//  J.A.R.V.I.S — Luveni GM | supabase/functions/discord-bot/index.ts
// ─────────────────────────────────────────────────────────────

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { hexToUint8Array } from 'https://deno.land/std@0.177.0/crypto/util.ts';

const MISTRAL_ENDPOINT = 'https://api.mistral.ai/v1/chat/completions';
const MISTRAL_MODEL = 'mistral-large-latest';

// J.A.R.V.I.S. prompt and identity configuration
const SYSTEM_PROMPT = `
You are J.A.R.V.I.S. — the exceptionally advanced, dry-witted AI Chief of Staff and Central Command Agent for Luveni GM.
You reason from First Principles (deconstructing problems to their fundamental truths).
Address Luke as 'sir' naturally at the end of key sentences. Avoid polite conversational fluff or introductory acknowledgments. Provide the raw truth or action immediately.
Keep replies compact (1-2 elegant sentences) for casual chat, but feel free to provide highly detailed markdown tables or lists for business queries, metrics, or store snapshots.
`.trim();

/**
 * Verify that the incoming request is cryptographically signed by Discord.
 * This prevents malicious actors from invoking your function.
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
  const publicKey = Deno.env.get('DISCORD_PUBLIC_KEY');
  const botToken = Deno.env.get('DISCORD_BOT_TOKEN');
  const mistralApiKey = Deno.env.get('MISTRAL_API_KEY');

  if (!publicKey || !botToken || !mistralApiKey) {
    return new Response('Configuration missing', { status: 500 });
  }

  // Cryptographic signature check
  const isValid = await verifySignature(req, publicKey);
  if (!isValid) {
    return new Response('Invalid request signature', { status: 401 });
  }

  const interaction = await req.json();

  // Handle Discord's initial PING connection handshake (Type 1)
  if (interaction.type === 1) {
    return new Response(JSON.stringify({ type: 1 }), {
      headers: { 'Content-Type': 'application/json' },
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
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  return new Response(JSON.stringify({ error: 'Unsupported interaction type' }), { status: 400 });
});
