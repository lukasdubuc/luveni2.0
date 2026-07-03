// ─────────────────────────────────────────────────────────────
//  Luveni GM — cj-catalog-sync (Supabase Edge Function)
//
//  Imports "my products" from CJ Dropshipping into the curation buffer:
//  full detail + image gallery + variants + untouched raw payload, landing
//  UNPUBLISHED (existing products keep their publish choice). Captures
//  everything so a later TikTok/Etsy publish has all data even if the
//  storefront doesn't show it.
//
//  Pricing: CJ's COST lands in cost_cents (product + per-variant) and
//  retail is computed through _shared/pricing.ts (pricing_rules table),
//  so price_cents is always a sellable RETAIL price. Titles are cleaned
//  with formatTitle. New products auto-publish (they arrive fully priced);
//  existing products keep their publish choice.
//
//  Secrets: CJ_EMAIL, CJ_API_KEY (+ optional CJ_API_BASE), CRON_KEY.
// ─────────────────────────────────────────────────────────────

/* eslint-disable @typescript-eslint/no-explicit-any */

import { corsHeaders, json, requireAdmin, SUPABASE_URL, SERVICE_KEY } from "../_shared/http.ts";
import { cjConfigured, getCjToken, cjGet, isCronOrService } from "../_shared/cj.ts";
import { loadPricingRules, matchRule, computeRetail, formatTitle } from "../_shared/pricing.ts";
import { parseManufacturerMedia } from "../_shared/media-pipeline.ts";

function slugify(s: string): string {
  return (s || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

const svc = () => ({ apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// CJ variantKeys are hyphen-joined property values in no guaranteed order
// ("Yellow-M", "M-Yellow", "Light Blue-2XL", "Army Green-One Size"). We can't
// assume the color is first. Instead we identify the SIZE token(s) from a known
// vocabulary and treat everything else as the color, so color always loads.
const SIZE_RE =
  /^(one[\s-]?size|os|free[\s-]?size|xxxs|xxs|xs|s|m|l|xl|xxl|xxxl|xxxxl|[2-6]\s?xs|[2-6]\s?xl|\d{1,2}(\.\d)?|s\/m|m\/l|l\/xl)$/i;
const isSizeToken = (p: string) => SIZE_RE.test(p.trim());

function attributesFromKey(key: string): Record<string, string> {
  const parts = String(key ?? "").split("-").map((p) => p.trim()).filter(Boolean);
  if (parts.length === 0) return {};

  const sizeParts = parts.filter(isSizeToken);
  const colorParts = parts.filter((p) => !isSizeToken(p));

  const attrs: Record<string, string> = {};
  if (colorParts.length) attrs.color = colorParts.join(" ");
  if (sizeParts.length) attrs.size = sizeParts.join("-");

  // Single ambiguous part that matched nothing above: keep it as color so the
  // storefront's color picker still renders it (never a dead "option" key).
  if (!attrs.color && !attrs.size) attrs.color = parts.join(" ");
  return attrs;
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

  const pricingRules = await loadPricingRules();

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

      const rawTitle = detail?.productNameEn ?? item?.nameEn ?? `cj-${pid}`;
      const title = formatTitle(rawTitle);
      const rule = matchRule(title, pricingRules);
      const gallery: string[] = Array.from(new Set(
        [...(detail?.productImageSet ?? []), detail?.bigImage, item?.bigImage].filter(Boolean),
      )) as string[];

      const variants = (Array.isArray(variantsRaw) ? variantsRaw : []).map((v: any) => {
        const costCents = Math.round(Number(v?.variantSellPrice ?? 0) * 100); // CJ "sell price" = our cost
        return {
          sku: String(v?.variantSku ?? v?.vid ?? ""),
          external_sku: String(v?.vid ?? ""),
          fulfillment_provider: "cj",
          cost_cents: costCents,
          price_cents: costCents > 0 ? computeRetail(costCents, rule).retail_cents : 0,
          attributes: attributesFromKey(v?.variantKey),
          image: v?.variantImage ?? null,
          stock: null, // filled by cj-inventory-sync
          availability_status: "active",
        };
      });

      const costs = variants.map((v) => v.cost_cents).filter((n) => n > 0);
      const costCents = costs.length ? Math.min(...costs) : Math.round(Number(item?.sellPrice ?? 0) * 100);
      const retails = variants.map((v) => v.price_cents).filter((n) => n > 0);
      const priceCents = retails.length ? Math.min(...retails)
        : (costCents > 0 ? computeRetail(costCents, rule).retail_cents : 0);

      // Preserve prior publish choice; new products auto-publish (fully priced).
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
          cost_cents: costCents,
          shipping_cents: rule.ship_first_cents,
          category: rule.key,
          image_urls: gallery,
          is_archived: false,
          is_published: prior ? !!prior.is_published : priceCents > 0,
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

      // Media: run CJ's payload through the SAME normalizer every other
      // vendor uses, so CJ images land with proper view_type + transparency
      // flags (not hardcoded "other"/false) and render on the storefront
      // grid identically to Printful/Apliiq products.
      const mediaRows = parseManufacturerMedia("cj", { detail, listItem: item, variants: variantsRaw })
        .map((m) => ({
          product_id: productId, variant_key: m.variantKey, view_type: m.viewType,
          url: m.url, is_primary: m.isPrimary, is_transparent: m.isTransparent,
          position: m.position, source: "cj", metadata: m.metadata,
        }));
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
