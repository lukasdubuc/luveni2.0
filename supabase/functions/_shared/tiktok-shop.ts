// ─────────────────────────────────────────────────────────────
//  Luveni GM — TikTok SHOP (Partner API) helpers (Deno)
//
//  DISTINCT from _shared/tiktok.ts. That file is the open-platform
//  Content Posting API (post videos/photos). THIS file is TikTok Shop —
//  the commerce API that owns product listings and their inventory. It is
//  what actually fixes "CJ listed my products to TikTok with 0 quantity":
//  the seller (us) must push stock to the listing; CJ never does.
//
//  Auth model (partner.tiktokshop.com / open-api.tiktokglobalshop.com):
//    • an app has app_key + app_secret
//    • the seller authorises the app → access_token (+ refresh_token)
//    • every call is signed HMAC-SHA256 over the sorted query string
//      (excluding sign/access_token) wrapped in the app_secret, and
//      carries shop_cipher for the target shop.
//
//  This module is a NO-OP unless ALL of these Edge Function secrets exist:
//    TIKTOK_SHOP_APP_KEY, TIKTOK_SHOP_APP_SECRET,
//    TIKTOK_SHOP_ACCESS_TOKEN, TIKTOK_SHOP_CIPHER
//  (mirrors the strip-background "off until a provider secret is set"
//  pattern). Wire them in Admin → Settings → Integrations once the TikTok
//  Shop app is approved, and the scheduled sync goes live with no deploy.
// ─────────────────────────────────────────────────────────────

/* eslint-disable @typescript-eslint/no-explicit-any */

export const TTS_BASE = Deno.env.get("TIKTOK_SHOP_API_BASE") || "https://open-api.tiktokglobalshop.com";

export interface TtsConfig {
  appKey: string;
  appSecret: string;
  accessToken: string;
  shopCipher: string;
}

export function ttsConfig(): TtsConfig | null {
  const appKey = Deno.env.get("TIKTOK_SHOP_APP_KEY") || "";
  const appSecret = Deno.env.get("TIKTOK_SHOP_APP_SECRET") || "";
  const accessToken = Deno.env.get("TIKTOK_SHOP_ACCESS_TOKEN") || "";
  const shopCipher = Deno.env.get("TIKTOK_SHOP_CIPHER") || "";
  if (!appKey || !appSecret || !accessToken || !shopCipher) return null;
  return { appKey, appSecret, accessToken, shopCipher };
}

/** HMAC-SHA256 signature per TikTok Shop spec: sort query params (excluding
 *  `sign` and `access_token`), concat as key+value, wrap with the request
 *  path, then HMAC with the app secret and hex-encode. Body is appended for
 *  non-multipart requests. */
async function sign(cfg: TtsConfig, path: string, query: Record<string, string>, body?: string): Promise<string> {
  const keys = Object.keys(query).filter((k) => k !== "sign" && k !== "access_token").sort();
  let base = path;
  for (const k of keys) base += k + query[k];
  if (body) base += body;
  const input = cfg.appSecret + base + cfg.appSecret;
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(cfg.appSecret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(input));
  return Array.from(new Uint8Array(mac)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Signed TikTok Shop API call. Returns parsed JSON `data`; throws on error. */
export async function ttsFetch(
  cfg: TtsConfig,
  method: "GET" | "POST" | "PUT",
  path: string,
  opts: { query?: Record<string, string>; body?: unknown } = {},
): Promise<any> {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const query: Record<string, string> = {
    app_key: cfg.appKey,
    shop_cipher: cfg.shopCipher,
    timestamp,
    ...(opts.query ?? {}),
  };
  const bodyStr = opts.body !== undefined ? JSON.stringify(opts.body) : undefined;
  query.sign = await sign(cfg, path, query, bodyStr);

  const url = new URL(TTS_BASE + path);
  for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);

  const res = await fetch(url.toString(), {
    method,
    headers: {
      "x-tts-access-token": cfg.accessToken,
      "Content-Type": "application/json",
    },
    body: bodyStr,
  });
  const d = await res.json().catch(() => ({}));
  if (!res.ok || (typeof d?.code === "number" && d.code !== 0)) {
    throw new Error(`TikTok Shop ${path} → ${res.status}/${d?.code}: ${d?.message ?? ""}`);
  }
  return d?.data ?? d;
}

/** Page through the seller's active TikTok Shop products. Returns a flat
 *  list of { productId, skus:[{ id, sellerSku }] } so callers can map a
 *  listing SKU back to our internal variant by seller_sku. */
export async function listShopProducts(cfg: TtsConfig): Promise<Array<{ productId: string; skus: Array<{ id: string; sellerSku: string }> }>> {
  const out: Array<{ productId: string; skus: Array<{ id: string; sellerSku: string }> }> = [];
  let pageToken = "";
  for (let guard = 0; guard < 50; guard++) {
    const query: Record<string, string> = { page_size: "100" };
    if (pageToken) query.page_token = pageToken;
    const data = await ttsFetch(cfg, "POST", "/product/202309/products/search", {
      query,
      body: { status: "ACTIVATE" },
    });
    for (const p of data?.products ?? []) {
      out.push({
        productId: String(p.id),
        skus: (p.skus ?? []).map((s: any) => ({ id: String(s.id), sellerSku: String(s.seller_sku ?? "") })),
      });
    }
    pageToken = data?.next_page_token || "";
    if (!pageToken) break;
  }
  return out;
}

/** Push new quantities to a TikTok Shop listing. `skus` maps TikTok sku_id →
 *  quantity. Uses the inventory/update endpoint (single warehouse). */
export async function updateInventory(
  cfg: TtsConfig,
  productId: string,
  skus: Array<{ skuId: string; quantity: number }>,
): Promise<void> {
  if (!skus.length) return;
  await ttsFetch(cfg, "POST", `/product/202309/products/${productId}/inventory/update`, {
    body: {
      skus: skus.map((s) => ({
        id: s.skuId,
        inventory: [{ quantity: Math.max(0, Math.floor(s.quantity)) }],
      })),
    },
  });
}
