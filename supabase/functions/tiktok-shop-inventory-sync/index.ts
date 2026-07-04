// ─────────────────────────────────────────────────────────────
//  Luveni GM — tiktok-shop-inventory-sync (Supabase Edge Function)
//
//  Fixes "CJ listed my products to TikTok with 0 quantity, and I'm not
//  updating them by hand." Runs hands-off on a schedule: takes the live
//  CJ stock already mirrored onto products.variants[].stock by
//  cj-inventory-sync (every 30 min) and PUSHES it to the matching TikTok
//  Shop listings via the TikTok Shop Partner API, so the storefront and
//  the TikTok listing never drift.
//
//  Matching: our variant.sku / external_sku ↔ TikTok Shop sku.seller_sku
//  (CJ lists with the CJ SKU as seller_sku). Quantity pushed is the
//  BUFFERED quantity: max(0, stock − buffer_qty), the same oversell
//  dampener the storefront uses.
//
//  NO-OP until the TikTok Shop secrets are set (see _shared/tiktok-shop.ts).
//  Callable by: admin JWT (manual Sync), service-role bearer, or the
//  scheduled cron via x-cron-key.
// ─────────────────────────────────────────────────────────────

/* eslint-disable @typescript-eslint/no-explicit-any */

import { corsHeaders, json, requireAdmin, SUPABASE_URL, SERVICE_KEY } from "../_shared/http.ts";
import { isCronOrService } from "../_shared/cj.ts";
import { ttsConfig, listShopProducts, updateInventory } from "../_shared/tiktok-shop.ts";

const svc = () => ({ apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` });

function bufferedQty(stock: number, buffer: number): number {
  return Math.max(0, (Number(stock) || 0) - Math.max(0, Number(buffer) || 0));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (!(await isCronOrService(req))) {
    const authErr = await requireAdmin(req);
    if (authErr) return authErr;
  }

  const cfg = ttsConfig();
  if (!cfg) {
    // Deliberate no-op so the schedule is harmless until the seller connects
    // their TikTok Shop app. Surfaced (not an error) so the admin UI can show
    // "connect TikTok Shop to enable".
    return json({
      ok: true,
      skipped: "TikTok Shop not configured",
      needs: ["TIKTOK_SHOP_APP_KEY", "TIKTOK_SHOP_APP_SECRET", "TIKTOK_SHOP_ACCESS_TOKEN", "TIKTOK_SHOP_CIPHER"],
    });
  }

  // 1. Our CJ products + their fresh stock.
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/products?source=eq.cj&is_archived=eq.false&select=id,title,variants,buffer_qty`,
    { headers: svc() },
  );
  const products: any[] = res.ok ? await res.json().catch(() => []) : [];

  // 2. seller_sku → desired quantity (from our side).
  const desired = new Map<string, number>();
  for (const p of products) {
    const buffer = Number(p.buffer_qty) || 0;
    for (const v of Array.isArray(p.variants) ? p.variants : []) {
      const qty = bufferedQty(v?.stock, buffer);
      for (const key of [v?.sku, v?.external_sku]) {
        if (key) desired.set(String(key), qty);
      }
    }
  }
  if (desired.size === 0) return json({ ok: true, pushed: 0, note: "no CJ variants with stock" });

  // 3. TikTok Shop listings → map seller_sku to (productId, skuId).
  let listings;
  try {
    listings = await listShopProducts(cfg);
  } catch (e: any) {
    return json({ error: `TikTok Shop product search failed: ${e.message}` }, 502);
  }

  // 4. For each listing, collect the SKUs whose quantity we know, push per product.
  let productsUpdated = 0;
  let skusPushed = 0;
  const errors: string[] = [];

  for (const listing of listings) {
    const updates: Array<{ skuId: string; quantity: number }> = [];
    for (const sku of listing.skus) {
      if (sku.sellerSku && desired.has(sku.sellerSku)) {
        updates.push({ skuId: sku.id, quantity: desired.get(sku.sellerSku)! });
      }
    }
    if (updates.length === 0) continue;
    try {
      await updateInventory(cfg, listing.productId, updates);
      productsUpdated++;
      skusPushed += updates.length;
    } catch (e: any) {
      errors.push(`${listing.productId}: ${e.message}`);
    }
  }

  return json({
    ok: true,
    tiktok_listings: listings.length,
    products_updated: productsUpdated,
    skus_pushed: skusPushed,
    errors,
  });
});
