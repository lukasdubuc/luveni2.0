// ─────────────────────────────────────────────────────────────
//  Luveni GM — cj-catalog-sync (Supabase Edge Function)
//
//  Imports "my products" from CJ Dropshipping into the curation buffer:
//  full detail + image gallery + variants + untouched raw payload, landing
//  UNPUBLISHED (existing products keep their publish choice). Captures
//  everything so a later TikTok/Etsy publish has all data even if the
//  storefront doesn't show it.
//
//  IMPORTANT: price_cents is imported as CJ's COST price (what CJ charges
//  us). Set retail pricing in the admin before publishing.
//
//  Secrets: CJ_EMAIL, CJ_API_KEY (+ optional CJ_API_BASE), CRON_KEY.
// ─────────────────────────────────────────────────────────────

/* eslint-disable @typescript-eslint/no-explicit-any */

import { corsHeaders, json, requireAdmin, SUPABASE_URL, SERVICE_KEY } from "../_shared/http.ts";
import { cjConfigured, getCjToken, cjGet, isCronOrService } from "../_shared/cj.ts";

function slugify(s: string): string {
  return (s || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

const svc = () => ({ apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// "Yellow-M" → {color: "Yellow", size: "M"}; single part → {option: part}.
function attributesFromKey(key: string): Record<string, string> {
  const parts = String(key ?? "").split("-").map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 2) return { color: parts[0], size: parts.slice(1).join("-") };
  if (parts.length === 1) return { option: parts[0] };
  return {};
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (!(await isCronOrService(req))) {
    const authErr = await requireAdmin(req);
    if (authErr) return authErr;
  }
  if (!cjConfigured()) return json({ error: "CJ_EMAIL / CJ_API_KEY secrets not set" }, 500);

  let token: string;
  try { token = await getCjToken(); } catch (e: any) { return json({ error: e.message }, 502); }

  // Page through my products.
  const items: any[] = [];
  for (let page = 1; page <= 10; page++) {
    const data = await cjGet(token, `product/myProduct/query?pageNum=${page}&pageSize=20`).catch(() => null);
    const content: any[] = data?.content ?? [];
    items.push(...content);
    if (!content.length || items.length >= (data?.totalRecords ?? 0)) break;
    await sleep(150);
  }

  let synced = 0;
  const errors: string[] = [];

  for (const item of items) {
    try {
      const pid = String(item?.productId ?? "");
      if (!pid) { errors.push("item missing productId"); continue; }

      // Retry once on transient CJ failures (QPS blips surface as errors).
      let detail = await cjGet(token, `product/query?pid=${encodeURIComponent(pid)}`).catch(() => null);
      if (!detail) {
        await sleep(600);
        detail = await cjGet(token, `product/query?pid=${encodeURIComponent(pid)}`).catch(() => null);
      }
      await sleep(250);
      let variantsRaw = await cjGet(token, `product/variant/query?pid=${encodeURIComponent(pid)}`).catch(() => null);
      if (!Array.isArray(variantsRaw) || !variantsRaw.length) {
        await sleep(600);
        variantsRaw = await cjGet(token, `product/variant/query?pid=${encodeURIComponent(pid)}`).catch(() => []);
      }
      await sleep(250);

      const title = detail?.productNameEn ?? item?.nameEn ?? `cj-${pid}`;
      const gallery: string[] = Array.from(new Set(
        [...(detail?.productImageSet ?? []), detail?.bigImage, item?.bigImage].filter(Boolean),
      )) as string[];

      const variants = (Array.isArray(variantsRaw) ? variantsRaw : []).map((v: any) => ({
        sku: String(v?.variantSku ?? v?.vid ?? ""),
        external_sku: String(v?.vid ?? ""),
        fulfillment_provider: "cj",
        price_cents: Math.round(Number(v?.variantSellPrice ?? 0) * 100),
        attributes: attributesFromKey(v?.variantKey),
        image: v?.variantImage ?? null,
        stock: null, // filled by cj-inventory-sync
        availability_status: "active",
      }));

      const prices = variants.map((v) => v.price_cents).filter((n) => n > 0);
      const priceCents = prices.length ? Math.min(...prices) : Math.round(Number(item?.sellPrice ?? 0) * 100);

      // Preserve prior publish choice; new products land unpublished.
      const existing = await fetch(
        `${SUPABASE_URL}/rest/v1/products?select=id,is_published&source=eq.cj&external_product_id=eq.${encodeURIComponent(pid)}&limit=1`,
        { headers: svc() },
      ).then((r) => (r.ok ? r.json() : [])).catch(() => []);
      const prior = Array.isArray(existing) && existing[0];

      const up = await fetch(`${SUPABASE_URL}/rest/v1/products?on_conflict=source,external_product_id`, {
        method: "POST",
        headers: { ...svc(), "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=representation" },
        body: JSON.stringify({
          title,
          slug: slugify(title) || `cj-${pid}`,
          description: detail?.description ?? title,
          price_cents: priceCents,
          image_urls: gallery,
          is_archived: false,
          is_published: prior ? !!prior.is_published : false,
          source: "cj",
          external_product_id: pid,
          raw_payload: { detail, listItem: item, variants: variantsRaw },
          // products.variants is NOT NULL — always send an array.
          variants,
          updated_at: new Date().toISOString(),
        }),
      });
      if (!up.ok) { errors.push(`${title}: upsert ${up.status} ${await up.text().catch(() => "")}`); continue; }
      const productId = (await up.json().catch(() => []))?.[0]?.id;
      if (!productId) { errors.push(`${title}: no product id`); continue; }

      // Media: gallery (product-level) + per-variant images, keyed by vid.
      const mediaRows = [
        ...gallery.map((url, i) => ({
          product_id: productId, variant_key: null, view_type: "other",
          url, is_primary: i === 0, is_transparent: false, position: i,
          source: "cj", metadata: {},
        })),
        ...variants.filter((v) => v.image).map((v, i) => ({
          product_id: productId, variant_key: v.external_sku, view_type: "other",
          url: v.image, is_primary: true, is_transparent: false, position: i,
          source: "cj", metadata: { variant_sku: v.sku },
        })),
      ];
      if (mediaRows.length) {
        await fetch(`${SUPABASE_URL}/rest/v1/product_media?on_conflict=product_id,variant_key,url`, {
          method: "POST",
          headers: { ...svc(), "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" },
          body: JSON.stringify(mediaRows),
        }).catch(() => {});
      }

      // Seed channel drafts (no auto-publish).
      await fetch(`${SUPABASE_URL}/rest/v1/channel_publications?on_conflict=product_id,channel`, {
        method: "POST",
        headers: { ...svc(), "Content-Type": "application/json", Prefer: "resolution=ignore-duplicates,return=minimal" },
        body: JSON.stringify(["tiktok", "etsy"].map((channel) => ({ product_id: productId, channel, status: "draft" }))),
      }).catch(() => {});

      synced++;
    } catch (e: any) {
      errors.push(`CJ item: ${e.message}`);
    }
  }

  return json({ synced, total: items.length, errors });
});
