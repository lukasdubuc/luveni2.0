// ─────────────────────────────────────────────────────────────
//  Luveni GM — printful-webhook (Supabase Edge Function)
//  Live inventory heartbeat. Printful calls this whenever a product
//  or its stock changes; we update public.products immediately so the
//  shop reflects reality with no manual resync. The /admin dashboard
//  and shop re-render live via the realtime publication.
//
//  Configure once in Printful (Settings → Webhooks) pointing at:
//    https://<project>.supabase.co/functions/v1/printful-webhook?secret=<PRINTFUL_WEBHOOK_SECRET>
//  Events: product_updated, product_deleted, stock_updated.
// ─────────────────────────────────────────────────────────────

/* eslint-disable @typescript-eslint/no-explicit-any */

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const PRINTFUL_API_KEY = Deno.env.get("PRINTFUL_API_KEY") || "";
const PRINTFUL_STORE_ID = Deno.env.get("PRINTFUL_STORE_ID") || "";
const WEBHOOK_SECRET = Deno.env.get("PRINTFUL_WEBHOOK_SECRET") || "";

const ok = (body: unknown = { received: true }) =>
  new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });

const pfHeaders = (): Record<string, string> => {
  const h: Record<string, string> = { Authorization: `Bearer ${PRINTFUL_API_KEY}` };
  if (PRINTFUL_STORE_ID) h["X-PF-Store-Id"] = PRINTFUL_STORE_ID;
  return h;
};

async function patchByPrintfulId(printfulId: string, patch: any): Promise<void> {
  await fetch(`${SUPABASE_URL}/rest/v1/products?printful_id=eq.${printfulId}`, {
    method: "PATCH",
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify(patch),
  });
}

// Re-pull a single sync product and upsert it — same mapping as the
// full sync, so an edit in Printful is reflected exactly.
async function resyncProduct(syncProductId: string): Promise<void> {
  const detailRes = await fetch(`https://api.printful.com/sync/products/${syncProductId}`, { headers: pfHeaders() });
  if (!detailRes.ok) return;
  const { result: detail } = (await detailRes.json()) as { result: any };
  const syncProduct = detail.sync_product ?? {};
  const syncVariants: any[] = detail.sync_variants ?? [];

  const productName = syncProduct.name ?? `product-${syncProductId}`;
  const slug = productName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const validPrices = syncVariants
    .map((v: any) => Math.round(parseFloat(v.retail_price ?? "0") * 100))
    .filter((p: number) => Number.isFinite(p) && p > 0);
  const priceCents = validPrices.length > 0 ? Math.min(...validPrices) : 0;
  const imageUrls: string[] = Array.from(
    new Set(
      syncVariants.flatMap((v: any) => v.files || []).map((f: any) => f.preview_url || f.thumbnail_url || f.url).filter(Boolean),
    ),
  );
  if (imageUrls.length === 0 && syncProduct.thumbnail_url) imageUrls.push(syncProduct.thumbnail_url);

  const variants = syncVariants.map((v: any) => {
    const parts = (v.name ?? "").split("/").map((p: string) => p.trim());
    const attributes: Record<string, string> = {};
    parts.forEach((part: string, i: number) => {
      if (i === 0) attributes["size"] = part;
      else if (i === 1) attributes["color"] = part;
      else attributes[`option_${i}`] = part;
    });
    const inStock = v.availability_status === "active" || v.availability_status === undefined;
    return {
      sku: v.sku ?? String(v.id),
      price_cents: Math.round(parseFloat(v.retail_price ?? "0") * 100),
      external_sku: String(v.id),
      fulfillment_provider: "printful",
      attributes,
      stock: inStock ? 999 : 0,
      availability_status: v.availability_status ?? "active",
    };
  });

  await fetch(`${SUPABASE_URL}/rest/v1/products?on_conflict=printful_id`, {
    method: "POST",
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify({
      title: productName,
      slug,
      description: syncProduct.external_name ?? productName,
      price_cents: priceCents,
      image_urls: imageUrls,
      is_archived: false,
      printful_id: String(syncProductId),
      variants: variants.length > 0 ? variants : null,
      updated_at: new Date().toISOString(),
    }),
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return ok();

  // Lightweight auth: Printful can't sign requests, so we gate on a
  // shared secret carried in the webhook URL query string.
  if (WEBHOOK_SECRET) {
    const url = new URL(req.url);
    if (url.searchParams.get("secret") !== WEBHOOK_SECRET) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return ok({ received: true, ignored: "no body" });
  }

  const type = body?.type;
  const data = body?.data ?? {};
  // Printful nests the sync product under different keys per event.
  const syncProductId =
    data?.sync_product?.id ?? data?.product?.id ?? data?.sync_product_id ?? body?.sync_product?.id ?? null;

  try {
    switch (type) {
      case "product_updated":
      case "product_synced":
        if (syncProductId) await resyncProduct(String(syncProductId));
        break;

      case "product_deleted":
        // Hard-delete so the admin list stays clean. FK on page_events is
        // ON DELETE SET NULL so analytics history survives.
        if (syncProductId) {
          await fetch(`${SUPABASE_URL}/rest/v1/products?printful_id=eq.${syncProductId}`, {
            method: "DELETE",
            headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, Prefer: "return=minimal" },
          });
        }
        break;

      case "stock_updated":
      case "variant_stock_updated":
        // Stock change: re-sync the product so each variant's
        // availability_status + stock fields reflect Printful instantly.
        // Crucially we do NOT unpublish — the product stays live, only the
        // out-of-stock SIZES grey out on the offer page (variant picker
        // already gates on stock <= 0). If ALL variants are out, the offer
        // page shows "Sold out".
        if (syncProductId) await resyncProduct(String(syncProductId));
        break;

      default:
        // Unhandled event — acknowledge so Printful doesn't retry.
        return ok({ received: true, ignored: type ?? "unknown" });
    }
  } catch (e: any) {
    console.error("[printful-webhook] error", e?.message);
    // Still 200 so Printful doesn't hammer retries; we logged it.
    return ok({ received: true, error: e?.message });
  }

  return ok();
});
