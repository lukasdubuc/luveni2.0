// ─────────────────────────────────────────────────────────────
//  Luveni GM — printful-sync (Supabase Edge Function)
//  Pulls the live Printful catalog into public.products. Runs on
//  Supabase so it can read PRINTFUL_API_KEY from project secrets.
//  Ported from the legacy Cloudflare /api/printful-sync route.
// ─────────────────────────────────────────────────────────────

/* eslint-disable @typescript-eslint/no-explicit-any */

import { parseManufacturerMedia } from "../_shared/media-pipeline.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, Authorization",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const PRINTFUL_API_KEY = Deno.env.get("PRINTFUL_API_KEY") || "";
const PRINTFUL_STORE_ID = Deno.env.get("PRINTFUL_STORE_ID") || "";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Fail-CLOSED admin gate: any failure denies access.
async function requireAdmin(req: Request): Promise<Response | null> {
  const authHeader = req.headers.get("Authorization") || req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
  const token = authHeader.slice("Bearer ".length);
  try {
    const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${token}` },
    });
    if (!userRes.ok) return json({ error: "Unauthorized" }, 401);
    const user = await userRes.json();
    if (!user?.id) return json({ error: "Unauthorized" }, 401);

    const rpcRes = await fetch(`${SUPABASE_URL}/rest/v1/rpc/has_role`, {
      method: "POST",
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ _user_id: user.id, _role: "admin" }),
    });
    if (!rpcRes.ok) return json({ error: "Forbidden (role check failed)" }, 403);
    const isAdmin = await rpcRes.json();
    if (isAdmin !== true) return json({ error: "Forbidden" }, 403);
    return null;
  } catch (e: any) {
    return json({ error: `Auth error: ${e.message}` }, 401);
  }
}

const pfHeaders = (): Record<string, string> => {
  const h: Record<string, string> = { Authorization: `Bearer ${PRINTFUL_API_KEY}` };
  if (PRINTFUL_STORE_ID) h["X-PF-Store-Id"] = PRINTFUL_STORE_ID;
  return h;
};

async function dbUpsertProduct(row: any): Promise<{ error?: string }> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/products?on_conflict=printful_id`, {
    method: "POST",
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify(row),
  });
  if (!res.ok) return { error: `${res.status}: ${await res.text().catch(() => "")}` };
  return {};
}

// Look up our product id by the Printful sync-product id.
async function getProductId(printfulId: string): Promise<string | null> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/products?select=id&printful_id=eq.${printfulId}&limit=1`,
    { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } },
  );
  if (!res.ok) return null;
  const rows = (await res.json().catch(() => [])) as any[];
  return rows[0]?.id ?? null;
}

// Persist EVERY mockup view (per variant) into product_media so back/side/
// model/lifestyle shots survive instead of collapsing to one image_urls entry.
async function upsertMedia(productId: string, detail: any): Promise<void> {
  const media = parseManufacturerMedia("printful", detail);
  if (media.length === 0) return;
  const rows = media.map((m) => ({
    product_id: productId,
    variant_key: m.variantKey,
    view_type: m.viewType,
    url: m.url,
    is_primary: m.isPrimary,
    is_transparent: m.isTransparent,
    position: m.position,
    source: "printful",
    metadata: m.metadata,
  }));
  await fetch(
    `${SUPABASE_URL}/rest/v1/product_media?on_conflict=product_id,variant_key,url`,
    {
      method: "POST",
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify(rows),
    },
  );
}

// Curation buffer: ensure draft channel rows exist for TikTok + Etsy so
// imports NEVER auto-publish to a marketplace. ignore-duplicates keeps an
// admin's already-published/curated status untouched on re-sync.
async function ensureDraftChannels(productId: string): Promise<void> {
  const rows = ["tiktok", "etsy"].map((channel) => ({
    product_id: productId,
    channel,
    status: "draft",
  }));
  await fetch(
    `${SUPABASE_URL}/rest/v1/channel_publications?on_conflict=product_id,channel`,
    {
      method: "POST",
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "resolution=ignore-duplicates,return=minimal",
      },
      body: JSON.stringify(rows),
    },
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const authError = await requireAdmin(req);
  if (authError) return authError;

  if (!PRINTFUL_API_KEY) return json({ error: "Missing PRINTFUL_API_KEY secret" }, 500);

  try {
    const listRes = await fetch("https://api.printful.com/sync/products", { headers: pfHeaders() });
    if (!listRes.ok) {
      return json({ error: `Printful list error ${listRes.status}: ${await listRes.text().catch(() => "")}` }, 502);
    }
    const { result } = (await listRes.json()) as { result: any[] };
    if (!result || result.length === 0) {
      return json({ synced: 0, total: 0, message: "No products found in Printful store" });
    }

    // Preserve the admin's manual publish/draft choices across syncs.
    // Map existing printful_id -> is_published so we don't re-publish a
    // product the admin deliberately drafted (the old frontend "restore"
    // hack did this and accidentally un-did tombstones).
    const publishedByPid = new Map<string, boolean>();
    try {
      const exRes = await fetch(
        `${SUPABASE_URL}/rest/v1/products?select=printful_id,is_published&printful_id=not.is.null`,
        { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } },
      );
      if (exRes.ok) {
        for (const r of (await exRes.json()) as any[]) {
          if (r.printful_id != null) publishedByPid.set(String(r.printful_id), !!r.is_published);
        }
      }
    } catch { /* fall back to default publish for all */ }

    let synced = 0;
    const errors: string[] = [];

    for (const item of result) {
      try {
        const detailRes = await fetch(`https://api.printful.com/sync/products/${item.id}`, { headers: pfHeaders() });
        if (!detailRes.ok) {
          errors.push(`Product ${item.id}: detail error ${detailRes.status}`);
          continue;
        }
        const { result: detail } = (await detailRes.json()) as { result: any };
        const syncProduct = detail.sync_product ?? {};
        const syncVariants: any[] = detail.sync_variants ?? [];

        const productName = syncProduct.name ?? item.name ?? `product-${item.id}`;
        const slug = productName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

        const validPrices = syncVariants
          .map((v: any) => Math.round(parseFloat(v.retail_price ?? "0") * 100))
          .filter((p: number) => Number.isFinite(p) && p > 0);
        const priceCents = validPrices.length > 0 ? Math.min(...validPrices) : 0;

        const imageUrls: string[] = Array.from(
          new Set(
            syncVariants
              .flatMap((v: any) => v.files || [])
              .map((f: any) => f.preview_url || f.thumbnail_url || f.url)
              .filter(Boolean),
          ),
        );
        if (imageUrls.length === 0 && syncProduct.thumbnail_url) imageUrls.push(syncProduct.thumbnail_url);
        if (imageUrls.length === 0 && item.thumbnail_url) imageUrls.push(item.thumbnail_url);

        const variants = syncVariants.map((v: any) => {
          const parts = (v.name ?? "").split("/").map((p: string) => p.trim());
          const attributes: Record<string, string> = {};
          parts.forEach((part: string, i: number) => {
            if (i === 0) attributes["size"] = part;
            else if (i === 1) attributes["color"] = part;
            else attributes[`option_${i}`] = part;
          });
          return {
            sku: v.sku ?? String(v.id),
            price_cents: Math.round(parseFloat(v.retail_price ?? "0") * 100),
            external_sku: String(v.id), // Printful sync_variant_id — used for fulfillment
            fulfillment_provider: "printful",
            attributes,
            // Carry Printful's live availability so the heartbeat can flip it.
            stock: v.availability_status === "active" || v.availability_status === undefined ? 999 : 0,
            availability_status: v.availability_status ?? "active",
          };
        });

        // Existing products keep the admin's publish choice; brand-new
        // products default to published. Live in Printful ⇒ never archived.
        const pid = String(item.id);
        const isPublished = publishedByPid.has(pid) ? publishedByPid.get(pid)! : true;

        const { error } = await dbUpsertProduct({
          title: productName,
          slug,
          description: syncProduct.external_name ?? productName,
          price_cents: priceCents,
          image_urls: imageUrls,
          is_archived: false,
          is_published: isPublished,
          printful_id: pid,
          source: "printful",
          raw_payload: detail,
          variants: variants.length > 0 ? variants : null,
          updated_at: new Date().toISOString(),
        });
        if (error) {
          errors.push(`Product ${item.id} (${productName}): ${error}`);
          continue;
        }

        // Persist all variant mockup views + seed the curation buffer.
        const productId = await getProductId(pid);
        if (productId) {
          try { await upsertMedia(productId, detail); } catch (e: any) { errors.push(`Media ${item.id}: ${e.message}`); }
          try { await ensureDraftChannels(productId); } catch { /* non-fatal */ }
        }
        synced++;
      } catch (e: any) {
        errors.push(`Product ${item.id}: ${e.message ?? "unknown error"}`);
      }
    }

    // Products no longer in Printful are HARD-DELETED so the admin list
    // stays clean (no orphan archived rows blocking a re-add). The FK on
    // page_events is ON DELETE SET NULL so analytics history survives.
    const liveIds = result.map((i: any) => String(i.id));
    let tombstoned = 0;
    try {
      const existingRes = await fetch(
        `${SUPABASE_URL}/rest/v1/products?select=id,printful_id,title&printful_id=not.is.null`,
        { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } },
      );
      const existing = existingRes.ok ? await existingRes.json() : [];
      const stale = (existing as any[]).filter((p) => !liveIds.includes(p.printful_id));
      for (const p of stale) {
        const del = await fetch(`${SUPABASE_URL}/rest/v1/products?id=eq.${p.id}`, {
          method: "DELETE",
          headers: {
            apikey: SERVICE_KEY,
            Authorization: `Bearer ${SERVICE_KEY}`,
            Prefer: "return=minimal",
          },
        });
        if (del.ok) tombstoned++;
      }
    } catch { /* non-fatal */ }

    return json({ synced, total: result.length, tombstoned, errors });
  } catch (e: any) {
    return json({ error: `Sync exception: ${e.message}` }, 500);
  }
});
