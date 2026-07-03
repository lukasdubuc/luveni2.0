// ─────────────────────────────────────────────────────────────
//  Luveni GM — jarvis-tts (Supabase Edge Function)
//
//  Astra's voice. Relays text to ElevenLabs and returns base64 MP3 the
//  browser can play. Called directly from the client (useSpeechOutput)
//  with only the anon key, so:
//    • verify_jwt MUST be false (config.toml) — a browser CORS preflight
//      carries no Authorization header; with the gateway check on, the
//      OPTIONS preflight fails ("does not have HTTP ok status").
//    • This is a thin, side-effect-free relay: no DB writes, no secrets
//      leaked. Worst case a caller spends ElevenLabs credits on TTS.
//
//  Contract:  POST { text: string }  →  { audio: <base64 mp3> }  |  { error }
//  Kept deliberately self-contained (no shared imports) so it can never
//  fail to boot on a dependency and take the voice offline.
// ─────────────────────────────────────────────────────────────

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, Authorization",
};

const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY") || "";
const ELEVENLABS_VOICE_ID = Deno.env.get("ELEVENLABS_VOICE_ID") || "pNInz6obpgDQGcFbJwr1";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Encode an ArrayBuffer to base64 in fixed-size chunks. Spreading a large
// Uint8Array into String.fromCharCode(...) can blow the call stack for big
// audio payloads; chunking keeps it safe for any reply length.
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    let body: any;
    try {
      body = await req.json();
    } catch {
      return json({ error: "Invalid JSON body" }, 400);
    }
    if (typeof body === "string") {
      try { body = JSON.parse(body); } catch { /* keep raw */ }
    }

    const text = body?.text ?? body?.args?.text;
    if (!text || typeof text !== "string") {
      return json({ error: "'text' is required" }, 400);
    }
    if (!ELEVENLABS_API_KEY) {
      return json({ error: "ELEVENLABS_API_KEY not set in Supabase secrets" }, 500);
    }

    const res = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICE_ID}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "xi-api-key": ELEVENLABS_API_KEY,
        },
        body: JSON.stringify({
          text,
          model_id: "eleven_multilingual_v2",
          voice_settings: {
            stability: 0.35,
            similarity_boost: 0.9,
            style: 0.1,
            use_speaker_boost: true,
          },
        }),
      },
    );

    if (!res.ok) {
      const errText = await res.text();
      return json({ error: `ElevenLabs ${res.status}: ${errText}` }, 502);
    }

    const audio = arrayBufferToBase64(await res.arrayBuffer());
    return json({ audio });
  } catch (e: any) {
    return json({ error: e?.message ?? "TTS failed" }, 500);
  }
});
