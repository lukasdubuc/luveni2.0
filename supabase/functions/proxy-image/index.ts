// ─────────────────────────────────────────────────────────────
//  Luveni — proxy-image (Supabase Edge Function)
//  Public, no-JWT image proxy. Catalog/mockup thumbnails are loaded
//  via plain <img src> and canvas/WebGL textures, which send no
//  Authorization header — so this MUST stay verify_jwt = false,
//  separate from the admin-gated printful-catalog function.
//
//  Usage:  GET /functions/v1/proxy-image?url=<encoded CDN url>
//
//  Only whitelisted Printful / Apliiq CDNs are allowed, so it can't
//  be used as an open relay.
// ─────────────────────────────────────────────────────────────

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, Authorization",
};

const ALLOWED_PREFIXES = [
  "https://files.cdn.printful.com/",
  "https://api.apliiq.com/",
  "https://www.apliiq.com/",
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "GET") return new Response("Method not allowed", { status: 405, headers: corsHeaders });

  const url = new URL(req.url).searchParams.get("url");
  if (!url) return new Response("Missing url", { status: 400, headers: corsHeaders });

  if (!ALLOWED_PREFIXES.some((p) => url.startsWith(p))) {
    return new Response("Forbidden proxy target", { status: 403, headers: corsHeaders });
  }

  try {
    const imgRes = await fetch(url);
    if (!imgRes.ok) return new Response("Failed to fetch image", { status: imgRes.status, headers: corsHeaders });
    const contentType = imgRes.headers.get("content-type") || "image/jpeg";
    const blob = await imgRes.blob();
    return new Response(blob, {
      headers: { ...corsHeaders, "Content-Type": contentType, "Cache-Control": "public, max-age=86400" },
    });
  } catch (e) {
    return new Response((e as Error).message, { status: 502, headers: corsHeaders });
  }
});
