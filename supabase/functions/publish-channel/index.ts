// ─────────────────────────────────────────────────────────────
//  Luveni GM — publish-channel (Supabase Edge Function)
//
//  The curation buffer's manual, single-click publish trigger. Takes a
//  curated product + target channel and pushes a correctly-formatted
//  listing to TikTok Shop (≤9 images, 1 primary/variant) or Etsy (≤10).
//  Records the exact payload + result in channel_publications.
//
//  If the channel access token isn't configured, it still builds and
//  stores the formatted payload and marks the row `curated` (ready),
//  so the admin sees exactly what WOULD ship — never a blind failure.
//
//  Body: { productId, channel: "tiktok" | "etsy" }
//  Secrets (optional, per channel): TIKTOK_SHOP_TOKEN + TIKTOK_SHOP_ID,
//                                   ETSY_TOKEN + ETSY_SHOP_ID
// ─────────────────────────────────────────────────────────────

/* eslint-disable @typescript-eslint/no-explicit-any */

import { corsHeaders, json, requireAdmin, SUPABASE_URL, SERVICE_KEY, dbSelect } from "../_shared/http.ts";
import { selectTikTokImages, NormalizedMedia, TIKTOK_MAX_IMAGES } from "../_shared/media-pipeline.ts";

const svc = () => ({ apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` });

const ETSY_MAX_IMAGES = 10;

// product_media row → NormalizedMedia (the selector's input shape).
function toNormalized(rows: any[]): NormalizedMedia[] {
  return rows.map((r) => ({
    variantKey: r.variant_key ?? null,
    viewType: r.view_type,
    url: r.url,
    isPrimary: r.is_primary,
    isTransparent: r.is_transparent,
    position: r.position ?? 0,
    source: r.source,
    metadata: r.metadata ?? {},
  }));
}

async function recordPublication(
  productId: string,
  channel: string,
  patch: Record<string, unknown>,
): Promise<void> {
  // Upsert so a manual publish works even if the draft row was pruned.
  await fetch(`${SUPABASE_URL}/rest/v1/channel_publications?on_conflict=product_id,channel`, {
    method: "POST",
    headers: { ...svc(), "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({ product_id: productId, channel, ...patch }),
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const authErr = await requireAdmin(req);
  if (authErr) return authErr;

  const { productId, channel } = await req.json().catch(() => ({}));
  if (!productId || !["tiktok", "etsy"].includes(channel)) {
    return json({ error: "productId and channel ('tiktok'|'etsy') required" }, 400);
  }

  const products = await dbSelect(
    `products?id=eq.${productId}&select=id,title,description,price_cents,price_cents_discounted,variants&limit=1`,
  );
  const product = products[0];
  if (!product) return json({ error: "Product not found" }, 404);

  const mediaRows = await dbSelect(
    `product_media?product_id=eq.${productId}&select=variant_key,view_type,url,is_primary,is_transparent,position,source,metadata&order=position.asc`,
  );
  const media = toNormalized(mediaRows);
  if (media.length === 0) return json({ error: "No media to publish; run a sync first" }, 400);

  // Channel-specific image mapping.
  const images = channel === "tiktok"
    ? selectTikTokImages(media)
    : Array.from(new Set(media.map((m) => m.url))).slice(0, ETSY_MAX_IMAGES);

  const priceCents = product.price_cents_discounted || product.price_cents || 0;
  const payload = channel === "tiktok"
    ? {
        title: product.title,
        description: product.description ?? product.title,
        images,
        image_count: images.length,
        max_images: TIKTOK_MAX_IMAGES,
        price: (priceCents / 100).toFixed(2),
        skus: (product.variants ?? []).map((v: any) => ({
          sku: v.sku, price: ((v.price_cents ?? priceCents) / 100).toFixed(2),
          attributes: v.attributes ?? {},
        })),
      }
    : {
        title: product.title,
        description: product.description ?? product.title,
        images,
        price: (priceCents / 100).toFixed(2),
        quantity: 999,
        who_made: "i_did", when_made: "made_to_order", taxonomy_id: 1,
      };

  // Resolve channel credentials.
  const tokens: Record<string, { token: string; shopId: string; endpoint: string }> = {
    tiktok: {
      token: Deno.env.get("TIKTOK_SHOP_TOKEN") || "",
      shopId: Deno.env.get("TIKTOK_SHOP_ID") || "",
      endpoint: "https://open-api.tiktokglobalshop.com/product/202309/products",
    },
    etsy: {
      token: Deno.env.get("ETSY_TOKEN") || "",
      shopId: Deno.env.get("ETSY_SHOP_ID") || "",
      endpoint: `https://openapi.etsy.com/v3/application/shops/${Deno.env.get("ETSY_SHOP_ID") || ""}/listings`,
    },
  };
  const cfg = tokens[channel];

  // No token → store the ready payload, mark curated (dry-run), don't fail.
  if (!cfg.token) {
    await recordPublication(productId, channel, {
      status: "curated", payload, selected_media: images, last_error: null,
    });
    return json({
      ok: true, dryRun: true, channel, image_count: images.length,
      message: `${channel} token not configured — payload curated and ready, not pushed`,
      payload,
    });
  }

  // Push to the channel.
  try {
    const res = await fetch(cfg.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${cfg.token}`,
        ...(channel === "tiktok" ? { "x-tts-shop-id": cfg.shopId } : {}),
      },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      await recordPublication(productId, channel, {
        status: "error", payload, selected_media: images, last_error: `${res.status}: ${JSON.stringify(data).slice(0, 500)}`,
      });
      return json({ ok: false, channel, error: `${channel} ${res.status}`, detail: data }, 502);
    }
    const externalId = String(data?.data?.product_id ?? data?.listing_id ?? data?.id ?? "");
    await recordPublication(productId, channel, {
      status: "published", external_id: externalId, payload, selected_media: images,
      last_error: null, published_at: new Date().toISOString(),
    });
    return json({ ok: true, channel, external_id: externalId, image_count: images.length });
  } catch (e: any) {
    await recordPublication(productId, channel, { status: "error", payload, selected_media: images, last_error: e.message });
    return json({ ok: false, channel, error: e.message }, 500);
  }
});
