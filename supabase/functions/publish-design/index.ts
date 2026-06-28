// ─────────────────────────────────────────────────────────────
//  Luveni GM — publish-design (Supabase Edge Function)
//  Phase 4: one-click publish a studio design to the shop. Takes a
//  flattened print-file URL, looks up the manufacturer blank's variants,
//  creates a Printful sync product, and marks the project published.
//  The existing printful-webhook / Sync then pulls it into the shop.
// ─────────────────────────────────────────────────────────────

/* eslint-disable @typescript-eslint/no-explicit-any */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, Authorization",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const PRINTFUL_API_KEY = Deno.env.get("PRINTFUL_API_KEY") || "";
const PRINTFUL_STORE_ID = Deno.env.get("PRINTFUL_STORE_ID") || "";

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

// template_key -> Printful catalog product id (the blank to print on).
const CATALOG: Record<string, number> = {
  tee: 71,        // Bella + Canvas 3001 Unisex Staple Tee
  tee_apliq: 71,
  hoodie: 146,    // Gildan 18500 Heavy Blend Hoodie
  poster: 1,      // Enhanced Matte Paper Poster
  hat: 206,       // Classic Dad Hat
};

async function requireAdmin(req: Request): Promise<Response | null> {
  const auth = req.headers.get("Authorization") || req.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
  const token = auth.slice(7);
  try {
    const u = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${token}` } });
    if (!u.ok) return json({ error: "Unauthorized" }, 401);
    const user = await u.json();
    if (!user?.id) return json({ error: "Unauthorized" }, 401);
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/has_role`, {
      method: "POST",
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ _user_id: user.id, _role: "admin" }),
    });
    if (!r.ok || (await r.json()) !== true) return json({ error: "Forbidden" }, 403);
    return null;
  } catch (e: any) { return json({ error: `Auth error: ${e.message}` }, 401); }
}

const pfHeaders = () => {
  const h: Record<string, string> = { Authorization: `Bearer ${PRINTFUL_API_KEY}`, "Content-Type": "application/json" };
  if (PRINTFUL_STORE_ID) h["X-PF-Store-Id"] = PRINTFUL_STORE_ID;
  return h;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const authErr = await requireAdmin(req);
  if (authErr) return authErr;
  if (!PRINTFUL_API_KEY) return json({ error: "PRINTFUL_API_KEY secret not set" }, 500);

  const { projectId, imageUrl, title, retailPriceCents, templateKey } = await req.json().catch(() => ({}));
  if (!imageUrl || !/^https?:\/\//.test(imageUrl)) return json({ error: "imageUrl (public) is required" }, 400);
  if (!retailPriceCents || retailPriceCents < 100) return json({ error: "retailPriceCents too low" }, 400);
  const catalogId = CATALOG[templateKey] ?? CATALOG.tee;

  const prodRes = await fetch(`https://api.printful.com/products/${catalogId}`, { headers: pfHeaders() });
  if (!prodRes.ok) return json({ error: `Printful catalog ${prodRes.status}: ${await prodRes.text().catch(() => "")}` }, 502);
  const prod = await prodRes.json();
  const variants: any[] = prod?.result?.variants || [];
  if (variants.length === 0) return json({ error: "No variants found for blank" }, 502);

  const retail = (retailPriceCents / 100).toFixed(2);
  const syncVariants = variants.slice(0, 100).map((v: any) => ({
    variant_id: v.id,
    retail_price: retail,
    files: [{ type: "default", url: imageUrl }],
  }));

  const createRes = await fetch("https://api.printful.com/store/products", {
    method: "POST",
    headers: pfHeaders(),
    body: JSON.stringify({
      sync_product: { name: title || "Luveni design", thumbnail: imageUrl },
      sync_variants: syncVariants,
    }),
  });
  const createData = await createRes.json().catch(() => ({}));
  if (!createRes.ok) {
    return json({ error: `Printful create ${createRes.status}: ${createData?.error?.message || createData?.result || createRes.statusText}` }, 502);
  }
  const syncProductId = createData?.result?.id;

  if (projectId) {
    await fetch(`${SUPABASE_URL}/rest/v1/studio_projects?id=eq.${projectId}`, {
      method: "PATCH",
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({ status: "published", metadata: { printful_sync_product_id: syncProductId, published_at: new Date().toISOString() } }),
    });
  }

  return json({ ok: true, printful_sync_product_id: syncProductId });
});
