// ─────────────────────────────────────────────────────────────
//  Luveni GM — ai-generate-image (Supabase Edge Function)
//  Phase 1 of the design studio. Takes a prompt, generates an image
//  via Pollinations.ai (free, no key, Flux model), saves the bytes to
//  the `designs` storage bucket, and inserts a row in public.designs.
//
//  Admin-gated. Cost: $0. Quality: top-tier free image generation.
// ─────────────────────────────────────────────────────────────

/* eslint-disable @typescript-eslint/no-explicit-any */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, Authorization",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

async function requireAdmin(req: Request): Promise<{ ok: true; userId: string } | { ok: false; res: Response }> {
  const authHeader = req.headers.get("Authorization") || req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return { ok: false, res: json({ error: "Unauthorized" }, 401) };
  const token = authHeader.slice("Bearer ".length);
  try {
    const u = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${token}` },
    });
    if (!u.ok) return { ok: false, res: json({ error: "Unauthorized" }, 401) };
    const user = await u.json();
    if (!user?.id) return { ok: false, res: json({ error: "Unauthorized" }, 401) };
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/has_role`, {
      method: "POST",
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ _user_id: user.id, _role: "admin" }),
    });
    if (!r.ok || (await r.json()) !== true) return { ok: false, res: json({ error: "Forbidden" }, 403) };
    return { ok: true, userId: user.id };
  } catch (e: any) {
    return { ok: false, res: json({ error: `Auth error: ${e.message}` }, 401) };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.res;

  // `image` (optional): a source image URL for img2img — used by the editor's
  // "regenerate this region / whole canvas based on the original" magic.
  // `persist` (optional, default true): when false we just return the image
  // URL without saving a designs row (transient editor layers).
  const { prompt, width = 1024, height = 1024, model = "flux", title, image, persist = true } =
    await req.json().catch(() => ({}));
  if (!prompt || typeof prompt !== "string" || prompt.length < 3) {
    return json({ error: "prompt must be at least 3 chars" }, 400);
  }
  if (prompt.length > 500) return json({ error: "prompt too long (max 500)" }, 400);
  const W = Math.min(Math.max(parseInt(String(width), 10) || 1024, 256), 2048);
  const H = Math.min(Math.max(parseInt(String(height), 10) || 1024, 256), 2048);
  const allowedModels = ["flux", "flux-realism", "flux-anime", "flux-3d", "turbo"];
  const M = allowedModels.includes(model) ? model : "flux";

  // Pollinations.ai — free, no key, returns raw PNG/JPEG bytes.
  // `nologo=true` strips their footer. seed is auto-random server-side.
  // When `image` is supplied, Pollinations runs image-to-image.
  const seed = Math.floor(Math.random() * 9_999_999);
  let url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=${W}&height=${H}&model=${M}&nologo=true&seed=${seed}`;
  if (typeof image === "string" && /^https?:\/\//.test(image)) {
    url += `&image=${encodeURIComponent(image)}`;
  }

  let imgRes: Response;
  try {
    imgRes = await fetch(url, { method: "GET" });
  } catch (e: any) {
    return json({ error: `Image generation failed: ${e.message}` }, 502);
  }
  if (!imgRes.ok) return json({ error: `Image generation failed: HTTP ${imgRes.status}` }, 502);

  const bytes = new Uint8Array(await imgRes.arrayBuffer());
  const contentType = imgRes.headers.get("content-type") || "image/jpeg";
  const ext = contentType.includes("png") ? "png" : "jpg";
  const objectPath = `${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.${ext}`;

  // Upload to the public `designs` bucket via Storage REST API.
  const upRes = await fetch(`${SUPABASE_URL}/storage/v1/object/designs/${objectPath}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SERVICE_KEY}`,
      apikey: SERVICE_KEY,
      "Content-Type": contentType,
      "x-upsert": "true",
    },
    body: bytes,
  });
  if (!upRes.ok) return json({ error: `Storage upload failed: ${await upRes.text().catch(() => "")}` }, 502);

  const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/designs/${objectPath}`;

  // Transient editor layers (persist:false) skip the designs gallery row.
  if (persist === false) {
    return json({ ok: true, image_url: publicUrl });
  }

  // Insert metadata row.
  const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/designs`, {
    method: "POST",
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify({
      title: title || prompt.slice(0, 80),
      prompt,
      image_url: publicUrl,
      image_path: objectPath,
      width: W,
      height: H,
      model: M,
      status: "draft",
      created_by: auth.userId,
      metadata: { source: "pollinations", seed },
    }),
  });
  const row = insertRes.ok ? (await insertRes.json())?.[0] : null;

  return json({ ok: true, image_url: publicUrl, design: row });
});
