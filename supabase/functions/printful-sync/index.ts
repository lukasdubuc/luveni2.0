// ─────────────────────────────────────────────────────────────
//  Luveni GM — printful-sync (Supabase Edge Function)
//
//  Pulls the live Printful store catalog into public.products at the same
//  standard as cj-catalog-sync:
//   • COST captured from the Printful catalog API (what Printful charges us)
//     into cost_cents (product + per-variant) — never conflated with retail.
//   • RETAIL computed through _shared/pricing.ts (pricing_rules table), so
//     price_cents is always a sellable retail price with guaranteed margin.
//     Falls back to the store's retail_price only when cost is unavailable.
//   • Titles cleaned with formatTitle.
//   • FULL media capture (every mockup view per variant) into product_media.
//   • New products auto-publish (they arrive fully priced); existing
//     products keep the admin's publish choice.
//   • Callable by admins (Sync button) or by pg_cron via x-cron-key.
//
//  Secrets: PRINTFUL_API_KEY (+ optional PRINTFUL_STORE_ID), CRON_KEY.
// ─────────────────────────────────────────────────────────────

/* eslint-disable @typescript-eslint/no-explicit-any */

import { corsHeaders, json, requireAdmin, dbUpsert, dbSelect, SUPABASE_URL, SERVICE_KEY } from "../_shared/http.ts";
import { isCronOrService } from "../_shared/cj.ts";
import { loadPricingRules, matchRule, computeRetail, formatTitle, type PricingRule } from "../_shared/pricing.ts";
import { parseManufacturerMedia } from "../_shared/media-pipeline.ts";

const PRINTFUL_API_KEY = Deno.env.get("PRINTFUL_API_KEY") || "";
const PRINTFUL_STORE_ID = Deno.env.get("PRINTFUL_STORE_ID") || "";
const PF_BASE = "https://api.printful.com";

const svc = () => ({ apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const pfHeaders = (): Record<string, string> => {
  const h: Record<string, string> = { Authorization: `Bearer ${PRINTFUL_API_KEY}` };
  if (PRINTFUL_STORE_ID) h["X-PF-Store-Id"] = PRINTFUL_STORE_ID;
  return h;
};

async function pfGet(path: string): Promise<any> {
  const res = await fetch(`${PF_BASE}${path}`, { headers: pfHeaders() });
  if (!res.ok) throw new Error(`Printful ${path} → ${res.status}: ${(await res.text().catch(() => "")).slice(0, 160)}`);
  return (await res.json())?.result;
}

function slugify(s: string): string {
  return (s || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

// Catalog cost lookup: sync_variant.product.variant_id → Printful catalog
// price (our COST). One catalog call per distinct catalog product, cached
// for the whole run, maps every variant id to cents.
const catalogCostCache = new Map<number, Map<number, number>>();

async function catalogCosts(catalogProductId: number): Promise<Map<number, number>> {
  const hit = catalogCostCache.get(catalogProductId);
  if (hit) return hit;
  const map = new Map<number, number>();
  try {
    const res = await pfGet(`/products/${catalogProductId}`);
    for (const v of res?.variants ?? []) {
      const cents = Math.round(parseFloat(v?.price ?? "0") * 100);
      if (Number.isFinite(cents) && cents > 0 && v?.id != null) map.set(Number(v.id), cents);
    }
  } catch { /* cost stays unknown; retail falls back to store price */ }
  catalogCostCache.set(catalogProductId, map);
  return map;
}

// "{Product} - {Color} / {Size}" → attributes {color, size}.
function attributesFromName(name: string): Record<string, string> {
  const parts = String(name ?? "").split("/").map((p) => p.trim());
  const attributes: Record<string, string> = {};
  parts.forEach((part, i) => {
    if (i === 0) {
      const dashIdx = part.lastIndexOf(" - ");
      attributes["color"] = dashIdx !== -1 ? part.slice(dashIdx + 3).trim() : part;
    } else if (i === 1) attributes["size"] = part;
    else attributes[`option_${i}`] = part;
  });
  return attributes;
}

async function upsertMedia(productId: string, detail: any, thumbnail: string | null): Promise<void> {
  const media = parseManufacturerMedia("printful", detail);
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
  // Product-level thumbnail as a gallery row (variant media stays per-variant).
  if (thumbnail && !rows.some((r) => r.url === thumbnail)) {
    rows.unshift({
      product_id: productId, variant_key: null, view_type: "front_flat",
      url: thumbnail, is_primary: rows.length === 0, is_transparent: false,
      position: 0, source: "printful", metadata: {},
    });
  }
  if (!rows.length) return;
  await dbUpsert("product_media", rows, "product_id,variant_key,url").catch(() => {});
}

async function ensureDraftChannels(productId: string): Promise<void> {
  await fetch(`${SUPABASE_URL}/rest/v1/channel_publications?on_conflict=product_id,channel`, {
    method: "POST",
    headers: { ...svc(), "Content-Type": "application/json", Prefer: "resolution=ignore-duplicates,return=minimal" },
    body: JSON.stringify(["tiktok", "etsy"].map((channel) => ({ product_id: productId, channel, status: "draft" }))),
  }).catch(() => {});
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (!(await isCronOrService(req))) {
    const authErr = await requireAdmin(req);
    if (authErr) return authErr;
  }
  if (!PRINTFUL_API_KEY) return json({ error: "Missing PRINTFUL_API_KEY secret" }, 500);

  try {
    const result: any[] = (await pfGet("/sync/products")) ?? [];
    if (!result.length) return json({ synced: 0, total: 0, message: "No products found in Printful store" });

    // Preserve the admin's manual publish/draft choices across syncs.
    const publishedByPid = new Map<string, boolean>();
    for (const r of await dbSelect("products?select=printful_id,is_published&printful_id=not.is.null")) {
      if (r.printful_id != null) publishedByPid.set(String(r.printful_id), !!r.is_published);
    }

    const pricingRules = await loadPricingRules();

    let synced = 0;
    const errors: string[] = [];

    for (const item of result) {
      try {
        const detail = await pfGet(`/sync/products/${item.id}`);
        const syncProduct = detail?.sync_product ?? {};
        const syncVariants: any[] = detail?.sync_variants ?? [];
        await sleep(120); // stay well under Printful's 120 req/min

        const rawTitle = syncProduct.name ?? item.name ?? `product-${item.id}`;
        const title = formatTitle(rawTitle);
        const rule: PricingRule = matchRule(title, pricingRules);

        // Cost per variant from the catalog API (batched per catalog product).
        const catalogIds = Array.from(new Set(
          syncVariants.map((v: any) => Number(v?.product?.product_id)).filter((n: number) => Number.isFinite(n) && n > 0),
        ));
        const costByVariantId = new Map<number, number>();
        for (const cid of catalogIds) {
          for (const [vid, cents] of await catalogCosts(cid)) costByVariantId.set(vid, cents);
        }

        const variants = syncVariants.map((v: any) => {
          const costCents = costByVariantId.get(Number(v?.product?.variant_id ?? v?.variant_id)) ?? 0;
          const storeRetail = Math.round(parseFloat(v?.retail_price ?? "0") * 100);
          const priceCents = costCents > 0
            ? computeRetail(costCents, rule).retail_cents
            : (Number.isFinite(storeRetail) && storeRetail > 0 ? storeRetail : 0);
          return {
            sku: v?.sku ?? String(v?.id),
            external_sku: String(v?.id), // Printful sync_variant_id — used for fulfillment
            fulfillment_provider: "printful",
            cost_cents: costCents,
            price_cents: priceCents,
            attributes: attributesFromName(v?.name),
            // Carry Printful's live availability so the heartbeat can flip it.
            stock: v?.availability_status === "active" || v?.availability_status === undefined ? 999 : 0,
            availability_status: v?.availability_status ?? "active",
          };
        });

        const costs = variants.map((v) => v.cost_cents).filter((n) => n > 0);
        const costCents = costs.length ? Math.min(...costs) : null;
        const retails = variants.map((v) => v.price_cents).filter((n) => n > 0);
        const priceCents = retails.length ? Math.min(...retails)
          : (costCents ? computeRetail(costCents, rule).retail_cents : 0);

        const imageUrls: string[] = Array.from(new Set(
          syncVariants
            .flatMap((v: any) => v.files || [])
            .map((f: any) => f.preview_url || f.thumbnail_url || f.url)
            .filter(Boolean),
        ));
        if (!imageUrls.length && syncProduct.thumbnail_url) imageUrls.push(syncProduct.thumbnail_url);
        if (!imageUrls.length && item.thumbnail_url) imageUrls.push(item.thumbnail_url);

        // Existing products keep the admin's publish choice; new products
        // auto-publish (they arrive fully priced). Live in Printful ⇒ not archived.
        const pid = String(item.id);
        const isPublished = publishedByPid.has(pid) ? publishedByPid.get(pid)! : priceCents > 0;

        const up = await dbUpsert("products", {
          title,
          slug: slugify(title) || `printful-${pid}`,
          description: syncProduct.external_name ?? title,
          price_cents: priceCents,
          cost_cents: costCents,
          shipping_cents: rule.ship_first_cents,
          category: rule.key,
          image_urls: imageUrls,
          is_archived: false,
          is_published: isPublished,
          printful_id: pid,
          source: "printful",
          external_product_id: pid,
          raw_payload: detail,
          variants: variants.length > 0 ? variants : [],
          updated_at: new Date().toISOString(),
        }, "printful_id", "representation");
        if (!up.ok) { errors.push(`${title}: upsert ${up.status} ${JSON.stringify(up.data).slice(0, 160)}`); continue; }
        const productId = up.data?.[0]?.id;
        if (!productId) { errors.push(`${title}: no product id`); continue; }

        try { await upsertMedia(productId, detail, syncProduct.thumbnail_url ?? item.thumbnail_url ?? null); }
        catch (e: any) { errors.push(`Media ${pid}: ${e.message}`); }
        await ensureDraftChannels(productId);

        synced++;
      } catch (e: any) {
        errors.push(`Product ${item.id}: ${e.message ?? "unknown error"}`);
      }
    }

    // Products no longer in Printful are HARD-DELETED so the admin list
    // stays clean (no orphan archived rows blocking a re-add). The FK on
    // page_events is ON DELETE SET NULL so analytics history survives.
    const liveIds = new Set(result.map((i: any) => String(i.id)));
    let tombstoned = 0;
    try {
      const existing = await dbSelect("products?select=id,printful_id&printful_id=not.is.null");
      for (const p of existing.filter((p: any) => !liveIds.has(String(p.printful_id)))) {
        const del = await fetch(`${SUPABASE_URL}/rest/v1/products?id=eq.${p.id}`, {
          method: "DELETE",
          headers: { ...svc(), Prefer: "return=minimal" },
        });
        if (del.ok) tombstoned++;
      }
    } catch { /* non-fatal */ }

    return json({ synced, total: result.length, tombstoned, errors });
  } catch (e: any) {
    return json({ error: `Sync exception: ${e.message}` }, 500);
  }
});
