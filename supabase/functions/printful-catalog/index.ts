/* eslint-disable @typescript-eslint/no-explicit-any */
// Returns real Printful blank products (image + price) for the studio's
// new-project picker, so the artboard can BE the actual garment at the
// actual manufacturer cost.

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

const BLANKS = [
  { key: "tee", label: "T-Shirt", id: 71, mfr: "printful" },
  { key: "hoodie", label: "Hoodie", id: 146, mfr: "printful" },
  { key: "hat", label: "Dad Hat", id: 206, mfr: "printful" },
  { key: "poster", label: "Poster", id: 1, mfr: "printful" },
];

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
  const h: Record<string, string> = { Authorization: `Bearer ${PRINTFUL_API_KEY}` };
  if (PRINTFUL_STORE_ID) h["X-PF-Store-Id"] = PRINTFUL_STORE_ID;
  return h;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const authErr = await requireAdmin(req);
  if (authErr) return authErr;
  if (!PRINTFUL_API_KEY) return json({ error: "PRINTFUL_API_KEY secret not set" }, 500);

  const out = await Promise.all(BLANKS.map(async (b) => {
    try {
      const r = await fetch(`https://api.printful.com/products/${b.id}`, { headers: pfHeaders() });
      if (!r.ok) return { ...b, error: `HTTP ${r.status}` };
      const d = await r.json();
      const product = d?.result?.product || {};
      const variants: any[] = d?.result?.variants || [];
      const prices = variants.map((v) => parseFloat(v.price)).filter((p) => Number.isFinite(p) && p > 0);
      const minCostCents = prices.length ? Math.round(Math.min(...prices) * 100) : 0;
      return {
        key: b.key, label: b.label, mfr: b.mfr, catalog_id: b.id,
        image: product.image || variants[0]?.image || null,
        cost_cents: minCostCents,
        variant_count: variants.length,
      };
    } catch (e: any) { return { ...b, error: e.message }; }
  }));

  return json({ ok: true, blanks: out });
});
