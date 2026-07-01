// ─────────────────────────────────────────────────────────────
//  Luveni GM — apliiq-sync (Supabase Edge Function)
//  Imports the Apliiq catalog into the curation buffer via the signed
//  Apliiq client. Products land UNPUBLISHED with all mockup views; the
//  admin curates and one-click publishes per channel later.
//  Secrets: APLIIQ_APP_ID, APLIIQ_SHARED_SECRET
// ─────────────────────────────────────────────────────────────

/* eslint-disable @typescript-eslint/no-explicit-any */

import { corsHeaders, json, requireAdmin } from "../_shared/http.ts";
import { apliiqFetch } from "../_shared/apliiq.ts";
import { persistImportedProduct, slugify } from "../_shared/import.ts";

const APP_ID = Deno.env.get("APLIIQ_APP_ID") || "";
const SHARED_SECRET = Deno.env.get("APLIIQ_SHARED_SECRET") || "";

function priceFromVariants(variants: any[]): number {
  const prices = variants
    .map((v) => Math.round(parseFloat(v?.retailPrice ?? v?.price ?? "0") * 100))
    .filter((n) => Number.isFinite(n) && n > 0);
  return prices.length ? Math.min(...prices) : 0;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const authErr = await requireAdmin(req);
  if (authErr) return authErr;
  if (!APP_ID || !SHARED_SECRET) return json({ error: "Apliiq credentials not configured" }, 500);

  // List the merchant's Apliiq products.
  const list = await apliiqFetch(APP_ID, SHARED_SECRET, { path: "/v1/Product" });
  if (!list.ok) return json({ error: `Apliiq list ${list.status}`, detail: list.data }, 502);
  const products: any[] = Array.isArray(list.data) ? list.data : list.data?.products ?? list.data?.result ?? [];

  let synced = 0;
  const errors: string[] = [];

  for (const item of products) {
    try {
      const externalId = String(item?.id ?? item?.productId ?? "");
      if (!externalId) { errors.push("product missing id"); continue; }

      // Detail call carries mockups + variants.
      const detailRes = await apliiqFetch(APP_ID, SHARED_SECRET, { path: `/v1/Product/${externalId}` });
      const detail = detailRes.ok ? detailRes.data : item;

      const variantsRaw: any[] = detail?.variants ?? detail?.options ?? [];
      const variants = variantsRaw.map((v: any) => {
        // Apliiq variant color/size aren't consistently top-level fields —
        // some responses carry them under an "options"/"attributes" array
        // instead (e.g. [{ name: "Color", value: "Black" }]). Try the direct
        // fields first, then search any nested option list, and only store
        // attributes we actually resolved a value for (an empty string would
        // otherwise render as a blank/invisible swatch on the storefront).
        const optionList: any[] = v?.options ?? v?.attributes ?? [];
        const findOption = (re: RegExp) =>
          optionList.find((o: any) => re.test(o?.name ?? o?.id ?? ""))?.value;

        const color = v?.color ?? v?.colorName ?? v?.color_name ?? findOption(/colou?r/i);
        const size = v?.size ?? v?.sizeName ?? v?.size_name ?? findOption(/size/i);

        const attributes: Record<string, string> = {};
        if (color) attributes["color"] = String(color);
        if (size) attributes["size"] = String(size);

        return {
          sku: String(v?.sku ?? v?.id ?? ""),
          external_sku: String(v?.id ?? v?.sku ?? ""),
          fulfillment_provider: "apliiq",
          price_cents: Math.round(parseFloat(v?.retailPrice ?? v?.price ?? "0") * 100),
          attributes,
          stock: 999,
          availability_status: "active",
        };
      });

      const title = detail?.name ?? detail?.title ?? `apliiq-${externalId}`;
      // imageUrls = the transparent/primary mockups (storefront grid pulls these).
      const mockups: any[] = detail?.mockups ?? detail?.images ?? [];
      const imageUrls = Array.from(new Set(
        mockups.map((m: any) => (typeof m === "string" ? m : m?.url || m?.image || m?.src)).filter(Boolean),
      )) as string[];

      const res = await persistImportedProduct("apliiq", {
        externalId,
        title,
        slug: slugify(title) || `apliiq-${externalId}`,
        description: detail?.description ?? title,
        priceCents: priceFromVariants(variantsRaw),
        imageUrls,
        variants,
        payload: detail,
      });
      if (!res.ok) { errors.push(`Apliiq ${externalId}: ${res.error}`); continue; }
      synced++;
    } catch (e: any) {
      errors.push(`Apliiq item: ${e.message}`);
    }
  }

  return json({ synced, total: products.length, errors });
});
