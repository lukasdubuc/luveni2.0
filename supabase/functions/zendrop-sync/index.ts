// ─────────────────────────────────────────────────────────────
//  Luveni GM — zendrop-sync (Supabase Edge Function)
//  Imports the Zendrop catalog into the curation buffer. Pulls the FULL
//  image gallery + per-variant images (fixes the single-photo loss) and
//  lands products UNPUBLISHED for curation.
//  Secret: ZENDROP_API_KEY  (Bearer auth on Zendrop's partner API)
// ─────────────────────────────────────────────────────────────

/* eslint-disable @typescript-eslint/no-explicit-any */

import { corsHeaders, json, requireAdmin } from "../_shared/http.ts";
import { persistImportedProduct, slugify } from "../_shared/import.ts";

const ZENDROP_API_KEY = Deno.env.get("ZENDROP_API_KEY") || "";
const ZENDROP_BASE = Deno.env.get("ZENDROP_API_BASE") || "https://api.zendrop.com";

const zHeaders = () => ({
  Authorization: `Bearer ${ZENDROP_API_KEY}`,
  Accept: "application/json",
});

function priceFromVariants(variants: any[]): number {
  const prices = variants
    .map((v) => Math.round(parseFloat(v?.price ?? v?.retail_price ?? "0") * 100))
    .filter((n) => Number.isFinite(n) && n > 0);
  return prices.length ? Math.min(...prices) : 0;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const authErr = await requireAdmin(req);
  if (authErr) return authErr;
  if (!ZENDROP_API_KEY) return json({ error: "ZENDROP_API_KEY secret not set" }, 500);

  const listRes = await fetch(`${ZENDROP_BASE}/v1/products`, { headers: zHeaders() });
  if (!listRes.ok) {
    return json({ error: `Zendrop list ${listRes.status}: ${await listRes.text().catch(() => "")}` }, 502);
  }
  const listData = await listRes.json().catch(() => ({}));
  const products: any[] = Array.isArray(listData) ? listData : listData?.data ?? listData?.products ?? [];

  let synced = 0;
  const errors: string[] = [];

  for (const item of products) {
    try {
      const externalId = String(item?.id ?? item?.product_id ?? "");
      if (!externalId) { errors.push("product missing id"); continue; }

      // Detail call (full gallery + variants); fall back to the list item.
      let detail = item;
      try {
        const dRes = await fetch(`${ZENDROP_BASE}/v1/products/${externalId}`, { headers: zHeaders() });
        if (dRes.ok) detail = (await dRes.json())?.data ?? (await dRes.json()) ?? item;
      } catch { /* use list item */ }

      const variantsRaw: any[] = detail?.variants ?? [];
      const variants = variantsRaw.map((v: any) => ({
        sku: String(v?.sku ?? v?.id ?? ""),
        external_sku: String(v?.id ?? v?.sku ?? ""),
        fulfillment_provider: "zendrop",
        price_cents: Math.round(parseFloat(v?.price ?? v?.retail_price ?? "0") * 100),
        attributes: { title: v?.title ?? "", option: v?.option1 ?? "" },
        stock: Number(v?.inventory ?? v?.stock ?? 999),
        availability_status: "active",
      }));

      const title = detail?.title ?? detail?.name ?? `zendrop-${externalId}`;
      const gallery: any[] = detail?.images ?? [];
      const imageUrls = Array.from(new Set(
        gallery.map((img: any) => (typeof img === "string" ? img : img?.src || img?.url)).filter(Boolean),
      )) as string[];

      const res = await persistImportedProduct("zendrop", {
        externalId,
        title,
        slug: slugify(title) || `zendrop-${externalId}`,
        description: detail?.description ?? title,
        priceCents: priceFromVariants(variantsRaw),
        imageUrls,
        variants,
        payload: detail,
      });
      if (!res.ok) { errors.push(`Zendrop ${externalId}: ${res.error}`); continue; }
      synced++;
    } catch (e: any) {
      errors.push(`Zendrop item: ${e.message}`);
    }
  }

  return json({ synced, total: products.length, errors });
});
