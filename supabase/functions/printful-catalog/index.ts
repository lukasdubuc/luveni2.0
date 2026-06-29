/* eslint-disable @typescript-eslint/no-explicit-any */
// ─────────────────────────────────────────────────────────────
//  Luveni — catalog (Supabase Edge Function)
//  Serves the FULL real-time blank catalog for the studio's
//  new-project picker, across BOTH manufacturers:
//    • Printful  — public catalog API (Bearer key)
//    • Apliiq    — signed REST API (App key + shared secret, HMAC)
//
//  Actions:
//    { action: "list",   manufacturer }            → product grid
//    { action: "detail", manufacturer, id }        → colors/sizes/prices
//    { action: "proxy-image", url }                → bypasses CDN CORS blocks
//
//  Admin-gated. Each manufacturer fails independently so one bad
//  key never blanks the whole picker.
// ─────────────────────────────────────────────────────────────

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, Authorization",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const PRINTFUL_API_KEY = Deno.env.get("PRINTFUL_API_KEY") || "";
const PRINTFUL_STORE_ID = Deno.env.get("PRINTFUL_STORE_ID") || "";
const APLIIQ_APP_KEY = Deno.env.get("APLIIQ_APP_KEY") || "";
const APLIIQ_SHARED_SECRET = Deno.env.get("APLIIQ_SHARED_SECRET") || "";

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

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

// ── Printful ────────────────────────────────────────────────────────────────
const pfHeaders = () => {
  const h: Record<string, string> = { Authorization: `Bearer ${PRINTFUL_API_KEY}` };
  if (PRINTFUL_STORE_ID) h["X-PF-Store-Id"] = PRINTFUL_STORE_ID;
  return h;
};

// Slugged key so the editor can branch artboard/print-area logic on type.
const slugKey = (mfr: string, type: string, id: number | string) =>
  `${mfr}-${String(type || "item").toLowerCase().replace(/[^a-z0-9]+/g, "")}-${id}`;

async function printfulList(): Promise<any[]> {
  if (!PRINTFUL_API_KEY) throw new Error("PRINTFUL_API_KEY not set");
  const r = await fetch("https://api.printful.com/products", { headers: pfHeaders() });
  if (!r.ok) throw new Error(`Printful HTTP ${r.status}: ${(await r.text().catch(() => "")).slice(0, 160)}`);
  const d = await r.json();
  const items: any[] = d?.result || [];
  return items.map((p) => ({
    id: p.id,
    key: slugKey("printful", p.type, p.id),
    label: p.title || p.model || `Product ${p.id}`,
    mfr: "printful",
    type: p.type_name || p.type || "Other",
    brand: p.brand || null,
    image: p.image || null,
    variant_count: p.variant_count ?? 0,
  }));
}

// Real print-area dimensions for the front placement, so the studio artboard
// and the 3D decal are true-to-print (px @ dpi → inches). Best-effort: returns
// null if Printful has no printfiles for this product.
async function printfulPrintArea(id: number | string): Promise<any> {
  try {
    const r = await fetch(`https://api.printful.com/mockup-generator/printfiles/${id}`, { headers: pfHeaders() });
    if (!r.ok) return null;
    const res = (await r.json())?.result;
    const printfiles: any[] = res?.printfiles || [];
    if (!printfiles.length) return null;
    // Prefer the "front" placement; fall back to the first available placement.
    const vp = (res?.variant_printfiles || [])[0]?.placements || {};
    const placement = vp.front != null ? "front" : Object.keys(vp)[0];
    const pfId = placement != null ? vp[placement] : null;
    const pf = printfiles.find((p) => p.printfile_id === pfId) || printfiles[0];
    if (!pf?.width || !pf?.height) return null;
    const dpi = pf.dpi || 150;
    return {
      placement: placement || "front",
      width_px: pf.width,
      height_px: pf.height,
      dpi,
      width_in: +(pf.width / dpi).toFixed(2),
      height_in: +(pf.height / dpi).toFixed(2),
    };
  } catch { return null; }
}

async function printfulDetail(id: number | string): Promise<any> {
  if (!PRINTFUL_API_KEY) throw new Error("PRINTFUL_API_KEY not set");
  const r = await fetch(`https://api.printful.com/products/${id}`, { headers: pfHeaders() });
  if (!r.ok) throw new Error(`Printful HTTP ${r.status}: ${(await r.text().catch(() => "")).slice(0, 160)}`);
  const d = await r.json();
  const product = d?.result?.product || {};
  const variants: any[] = d?.result?.variants || [];
  const prices = variants.map((v) => parseFloat(v.price)).filter((p) => Number.isFinite(p) && p > 0);
  // Distinct colors (keep a variant_id + image per color for swatch + mockup).
  const colorMap = new Map<string, { name: string; code: string | null; image: string | null; variant_id: number | null }>();
  const sizeSet = new Set<string>();
  for (const v of variants) {
    if (v.color && !colorMap.has(v.color)) colorMap.set(v.color, { name: v.color, code: v.color_code || null, image: v.image || null, variant_id: v.id ?? null });
    if (v.size) sizeSet.add(v.size);
  }
  const print_area = await printfulPrintArea(id);
  return {
    id, mfr: "printful",
    key: slugKey("printful", product.type, id),
    label: product.title || product.model || `Product ${id}`,
    type: product.type_name || product.type || "Other",
    image: product.image || variants[0]?.image || null,
    min_cost_cents: prices.length ? Math.round(Math.min(...prices) * 100) : 0,
    max_cost_cents: prices.length ? Math.round(Math.max(...prices) * 100) : 0,
    colors: [...colorMap.values()],
    sizes: [...sizeSet],
    variant_count: variants.length,
    print_area, // { placement, width_px, height_px, dpi, width_in, height_in } | null
  };
}

// ── Apliiq (signed REST) ─────────────────────────────────────────────────────
const APLIIQ_BASE = "https://api.apliiq.com";

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// Mimic .NET HttpUtility.UrlEncode: lowercase percent-encoding.
const dotNetUrlEncode = (s: string) =>
  encodeURIComponent(s).replace(/%[0-9A-F]{2}/g, (m) => m.toLowerCase());

// Apliiq uses the ASP.NET "amx" HMAC scheme (header renamed to x-apliiq-auth):
//   signatureRawData = AppId + Method + urlEncode(absoluteUrl.toLowerCase())
//                      + Timestamp + Nonce + base64(md5(body))   (body empty for GET)
//   SIG  = base64(HMAC-SHA256(base64-decode(sharedSecret), signatureRawData))
//   header value = AppId:Signature:Nonce:Timestamp
// The method + full URL MUST be in the signed data, and the header field order
// is AppId:Sig:Nonce:Timestamp — getting either wrong makes Apliiq return 500.
async function apliiqHeaders(method: string, fullUrl: string): Promise<Record<string, string>> {
  const rts = Math.floor(Date.now() / 1000).toString();
  const state = crypto.randomUUID().replace(/-/g, "");
  const requestUri = dotNetUrlEncode(fullUrl.toLowerCase());
  const requestContentBase64String = ""; // empty body for GET list/detail calls
  const rawData = `${APLIIQ_APP_KEY}${method}${requestUri}${rts}${state}${requestContentBase64String}`;

  let keyBytes: Uint8Array;
  try { keyBytes = b64ToBytes(APLIIQ_SHARED_SECRET); }
  catch { keyBytes = new TextEncoder().encode(APLIIQ_SHARED_SECRET); }

  const key = await crypto.subtle.importKey("raw", keyBytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sigBuf = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawData));
  const sig = btoa(String.fromCharCode(...new Uint8Array(sigBuf)));

  return { "x-apliiq-auth": `${APLIIQ_APP_KEY}:${sig}:${state}:${rts}`, "Accept": "application/json" };
}

async function apliiqFetch(method: string, path: string): Promise<any> {
  if (!APLIIQ_APP_KEY || !APLIIQ_SHARED_SECRET) throw new Error("Apliiq credentials not set (APLIIQ_APP_KEY / APLIIQ_SHARED_SECRET)");
  const url = `${APLIIQ_BASE}${path}`;
  const headers = await apliiqHeaders(method, url);
  const r = await fetch(url, { method, headers });
  if (!r.ok) throw new Error(`Apliiq HTTP ${r.status}: ${(await r.text().catch(() => "")).slice(0, 120)}`);
  return r.json();
}

const pick = (o: any, ...keys: string[]) => { for (const k of keys) if (o?.[k] != null) return o[k]; return null; };

async function apliiqList(): Promise<any[]> {
  const data = await apliiqFetch("GET", "/api/Product");
  const items: any[] = Array.isArray(data) ? data : (data?.Products || data?.products || []);
  return items.map((p) => {
    const id = pick(p, "Id", "id", "ProductId", "productId");
    return {
      id,
      key: slugKey("apliiq", pick(p, "GarmentType", "Category", "type") || "item", id),
      label: pick(p, "Name", "name", "Title", "title") || `Product ${id}`,
      mfr: "apliiq",
      type: pick(p, "Category", "GarmentType", "type") || "Other",
      brand: pick(p, "Brand", "brand"),
      image: pick(p, "ImageUrl", "imageUrl", "Image", "image", "PreviewUrl"),
      variant_count: (pick(p, "Colors", "colors")?.length) || 0,
    };
  });
}

async function apliiqDetail(id: number | string): Promise<any> {
  const p = await apliiqFetch("GET", `/api/Product/${id}`);
  const colorsRaw: any[] = pick(p, "Colors", "colors") || [];
  const sizesRaw: any[] = pick(p, "Sizes", "sizes") || [];
  const cost = pick(p, "BasePrice", "basePrice", "Price", "price");
  const costCents = cost != null ? Math.round(parseFloat(String(cost)) * 100) : 0;
  return {
    id, mfr: "apliiq",
    key: slugKey("apliiq", pick(p, "Category", "GarmentType") || "item", id),
    label: pick(p, "Name", "name", "Title") || `Product ${id}`,
    type: pick(p, "Category", "GarmentType") || "Other",
    image: pick(p, "ImageUrl", "Image", "PreviewUrl"),
    min_cost_cents: costCents,
    max_cost_cents: costCents,
    colors: colorsRaw.map((c: any) => ({
      name: pick(c, "Name", "name") || String(c),
      code: pick(c, "HexCode", "hex", "Code") || null,
      image: pick(c, "ImageUrl", "Image") || null,
    })),
    sizes: sizesRaw.map((s: any) => (typeof s === "string" ? s : pick(s, "Name", "name", "Size") || "")),
    variant_count: colorsRaw.length || 0,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // Handle public image proxy requests to bypass the requireAdmin block
  const urlObj = new URL(req.url);
  const getAction = urlObj.searchParams.get("action");
  const getUrl = urlObj.searchParams.get("url");

  if (req.method === "GET" && getAction === "proxy-image" && getUrl) {
    if (
      !getUrl.startsWith("https://files.cdn.printful.com/") && 
      !getUrl.startsWith("https://api.apliiq.com/") && 
      !getUrl.startsWith("https://www.apliiq.com/")
    ) {
      return new Response("Forbidden proxy target", { status: 403, headers: corsHeaders });
    }
    try {
      const imgRes = await fetch(getUrl);
      if (!imgRes.ok) return new Response("Failed to fetch image", { status: imgRes.status, headers: corsHeaders });
      const contentType = imgRes.headers.get("content-type") || "image/jpeg";
      const blob = await imgRes.blob();
      return new Response(blob, {
        headers: {
          ...corsHeaders,
          "Content-Type": contentType,
          "Cache-Control": "public, max-age=86400",
        }
      });
    } catch (e: any) {
      return new Response(e.message, { status: 502, headers: corsHeaders });
    }
  }

  // Admin access validation is required for the standard catalog actions
  const authErr = await requireAdmin(req);
  if (authErr) return authErr;

  const body = await req.json().catch(() => ({}));
  const action = body.action || "list";
  const manufacturer = (body.manufacturer || "all").toLowerCase();

  // ── mockup: photoreal on-model render of the exact print (Printful) ──────────
  if (action === "mockup") {
    if (manufacturer === "apliiq") return json({ error: "Apliiq mockups not supported yet" }, 400);
    if (!PRINTFUL_API_KEY) return json({ error: "PRINTFUL_API_KEY not set" }, 500);
    const { productId, variantId, imageUrl } = body;
    if (!productId || !variantId || !imageUrl) return json({ error: "productId, variantId and imageUrl required" }, 400);
    try {
      const create = await fetch(`https://api.printful.com/mockup-generator/create-task/${productId}`, {
        method: "POST",
        headers: { ...pfHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({
          variant_ids: [variantId],
          format: "jpg",
          files: [{ placement: "front", image_url: imageUrl, position: { area_width: 1800, area_height: 2400, width: 1800, height: 2400, top: 0, left: 0 } }],
        }),
      });
      if (!create.ok) return json({ error: `Printful mockup HTTP ${create.status}: ${await create.text().catch(() => "")}` }, 502);
      const task = (await create.json())?.result?.task_key;
      if (!task) return json({ error: "No task_key from Printful" }, 502);
      // Poll up to ~25s for the render to finish.
      for (let i = 0; i < 12; i++) {
        await new Promise((r) => setTimeout(r, i === 0 ? 1500 : 2000));
        const pr = await fetch(`https://api.printful.com/mockup-generator/task?task_key=${task}`, { headers: pfHeaders() });
        if (!pr.ok) continue;
        const res = (await pr.json())?.result;
        if (res?.status === "completed") {
          const urls = (res.mockups || []).flatMap((m: any) => [m.mockup_url, ...((m.extra || []).map((e: any) => e.url))]).filter(Boolean);
          return json({ ok: true, mockups: urls });
        }
        if (res?.status === "failed") return json({ error: "Printful mockup render failed" }, 502);
      }
      return json({ error: "Mockup render timed out" }, 504);
    } catch (e: any) { return json({ error: e.message }, 502); }
  }

  // ── edm-nonce: mint a Printful Embedded Design Maker session token ───────────
  // The nonce is generated server-side (keeps the access token private) and used
  // by the browser to authenticate the EDM iframe. Requires the "Embedded
  // Designer" extension enabled on the Printful account.
  if (action === "edm-nonce") {
    if (!PRINTFUL_API_KEY) return json({ error: "PRINTFUL_API_KEY not set" }, 500);
    const externalProductId = String(body.externalProductId || `luveni-${body.productId || Date.now()}`);
    try {
      const r = await fetch("https://api.printful.com/embedded-designer/nonces", {
        method: "POST",
        headers: { ...pfHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({
          external_product_id: externalProductId,
          ...(body.productId ? { product_id: body.productId } : {}),
          ...(body.productTemplateId ? { product_template_id: body.productTemplateId } : {}),
        }),
      });
      const txt = await r.text().catch(() => "");
      if (!r.ok) return json({ error: `Printful EDM HTTP ${r.status}: ${txt.slice(0, 200)}` }, 502);
      const data = txt ? JSON.parse(txt) : {};
      return json({ ok: true, nonce: data?.result?.nonce ?? null, expires_at: data?.result?.expires_at ?? null, externalProductId });
    } catch (e: any) { return json({ error: e.message }, 502); }
  }

  // ── match: closest blank to a traced/custom design, cheapest across both ────
  if (action === "match") {
    const gt = String(body.garmentType || "t-shirt").toLowerCase();
    const synonyms: Record<string, string[]> = {
      "t-shirt": ["t-shirt", "tee", "shirt", "crew"],
      hoodie: ["hoodie", "hooded", "sweatshirt", "pullover"],
      sweatshirt: ["sweatshirt", "crewneck", "fleece"],
      tank: ["tank", "sleeveless"],
      "long sleeve": ["long sleeve", "longsleeve"],
      hat: ["hat", "cap", "beanie"],
    };
    const keys = synonyms[gt] || [gt];
    const matchType = (b: any) => keys.some((k) => `${b.type} ${b.label}`.toLowerCase().includes(k));

    const [pf, ap] = await Promise.all([
      printfulList().catch(() => []),
      apliiqList().catch(() => []),
    ]);
    const candidates = [...pf, ...ap].filter(matchType).slice(0, 12);
    const detailed = await Promise.all(candidates.map(async (b) => {
      try {
        const d = b.mfr === "apliiq" ? await apliiqDetail(b.id) : await printfulDetail(b.id);
        return d.min_cost_cents > 0 ? d : null;
      } catch { return null; }
    }));
    const ranked = detailed.filter(Boolean).sort((a: any, z: any) => a.min_cost_cents - z.min_cost_cents);
    return json({ ok: true, garmentType: gt, matches: ranked, cheapest: ranked[0] || null });
  }

  if (action === "detail") {
    try {
      const detail = manufacturer === "apliiq"
        ? await apliiqDetail(body.id)
        : await printfulDetail(body.id);
      return json({ ok: true, detail });
    } catch (e: any) {
      return json({ error: e.message }, 502);
    }
  }

  // list — fetch requested manufacturer(s) in parallel, each isolated.
  const wantPF = manufacturer === "all" || manufacturer === "printful";
  const wantAP = manufacturer === "all" || manufacturer === "apliiq";

  const [pf, ap] = await Promise.all([
    wantPF ? printfulList().then((blanks) => ({ blanks })).catch((e) => ({ error: e.message, blanks: [] })) : Promise.resolve({ blanks: [] }),
    wantAP ? apliiqList().then((blanks) => ({ blanks })).catch((e) => ({ error: e.message, blanks: [] })) : Promise.resolve({ blanks: [] }),
  ]);

  return json({
    ok: true,
    manufacturers: {
      printful: { available: !!PRINTFUL_API_KEY, error: (pf as any).error || null, count: pf.blanks.length },
      apliiq: { available: !!(APLIIQ_APP_KEY && APLIIQ_SHARED_SECRET), error: (ap as any).error || null, count: ap.blanks.length },
    },
    blanks: [...pf.blanks, ...ap.blanks],
  });
});
