// ─────────────────────────────────────────────────────────────
//  Luveni GM — server-side background removal core (Deno)
//
//  The ONE server-side implementation of the transparent-PNG step the
//  browser CjTransparencyPanel does client-side. Runs in the Supabase edge
//  runtime and is used by strip-background + strip-background-sweep.
//
//  Engine: a hosted background-removal API that returns a ready transparent
//  PNG in a single call — no ML bundled into the function (Supabase's edge
//  bundler cannot package onnxruntime/transformers.js). Provider is chosen
//  by whichever secret is set, so it stays flexible and cheap:
//    • REMOVE_BG_API_KEY  → api.remove.bg   (free tier ~50 imgs/mo)
//    • PHOTOROOM_API_KEY  → sdk.photoroom.com
//  If neither is set, the pipeline is a NO-OP that reports
//  reason="engine-not-configured" and leaves the product's original image
//  intact (never breaks a product) — set one key to switch enforcement on.
// ─────────────────────────────────────────────────────────────

/* eslint-disable @typescript-eslint/no-explicit-any */

import { SUPABASE_URL, SERVICE_KEY } from "./http.ts";

export const PRODUCT_MEDIA_BUCKET = "product-media";

const REMOVE_BG_API_KEY = Deno.env.get("REMOVE_BG_API_KEY") || "";
const PHOTOROOM_API_KEY = Deno.env.get("PHOTOROOM_API_KEY") || "";

const svc = () => ({ apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` });

/** True when at least one background-removal provider is configured. */
export function bgEngineConfigured(): boolean {
  return !!(REMOVE_BG_API_KEY || PHOTOROOM_API_KEY);
}

// ── URL heuristics (mirror src/lib/img.ts) ─────────────────────

export function isOwnProductMediaUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  return url.includes(`/storage/v1/object/public/${PRODUCT_MEDIA_BUCKET}/`);
}

function unwrapProxiedUrl(url: string): string {
  if (url.startsWith("https://wsrv.nl/")) {
    try {
      const inner = new URL(url).searchParams.get("url");
      if (inner) return inner;
    } catch { /* keep original */ }
  }
  return url;
}

export function isLikelyTransparentImage(url: string | null | undefined): boolean {
  if (!url) return false;
  const path = unwrapProxiedUrl(url).split(/[?#]/)[0];
  return /\.png$/i.test(path);
}

// ── Engine: hosted API → ready transparent PNG bytes ───────────
// Providers fetch the source image themselves (we pass the URL), so the
// edge function never has to decode/re-encode pixels.

async function removeBackground(sourceUrl: string): Promise<{ png: Uint8Array; engine: string }> {
  if (REMOVE_BG_API_KEY) {
    const form = new FormData();
    form.set("image_url", sourceUrl);
    form.set("size", "auto");
    form.set("format", "png");
    const res = await fetch("https://api.remove.bg/v1.0/removebg", {
      method: "POST",
      headers: { "X-Api-Key": REMOVE_BG_API_KEY },
      body: form,
    });
    if (!res.ok) throw new Error(`remove.bg ${res.status}: ${(await res.text().catch(() => "")).slice(0, 200)}`);
    return { png: new Uint8Array(await res.arrayBuffer()), engine: "remove.bg" };
  }

  if (PHOTOROOM_API_KEY) {
    const form = new FormData();
    form.set("image_url", sourceUrl);
    form.set("format", "png");
    const res = await fetch("https://sdk.photoroom.com/v1/segment", {
      method: "POST",
      headers: { "x-api-key": PHOTOROOM_API_KEY },
      body: form,
    });
    if (!res.ok) throw new Error(`photoroom ${res.status}: ${(await res.text().catch(() => "")).slice(0, 200)}`);
    return { png: new Uint8Array(await res.arrayBuffer()), engine: "photoroom" };
  }

  throw new Error("no background-removal provider configured");
}

// ── Storage + DB ───────────────────────────────────────────────

async function uploadTransparentPng(productId: string, bytes: Uint8Array): Promise<string> {
  const path = `products/${productId}/transparent-${Date.now()}.png`;
  const objUrl = `${SUPABASE_URL}/storage/v1/object/${PRODUCT_MEDIA_BUCKET}/${path}`;

  const doUpload = () =>
    fetch(objUrl, {
      method: "POST",
      headers: { ...svc(), "Content-Type": "image/png", "x-upsert": "true" },
      body: bytes,
    });

  let res = await doUpload();
  if (!res.ok && /bucket/i.test(await res.clone().text().catch(() => ""))) {
    // Best-effort: create the public bucket, then retry once.
    await fetch(`${SUPABASE_URL}/storage/v1/bucket`, {
      method: "POST",
      headers: { ...svc(), "Content-Type": "application/json" },
      body: JSON.stringify({ id: PRODUCT_MEDIA_BUCKET, name: PRODUCT_MEDIA_BUCKET, public: true }),
    }).catch(() => {});
    res = await doUpload();
  }
  if (!res.ok) {
    throw new Error(`storage upload ${res.status}: ${(await res.text().catch(() => "")).slice(0, 200)}`);
  }
  return `${SUPABASE_URL}/storage/v1/object/public/${PRODUCT_MEDIA_BUCKET}/${path}`;
}

// ── Treated detection ──────────────────────────────────────────

interface ProductRow {
  id: string;
  image_urls: string[] | null;
  source: string | null;
}

async function loadProduct(productId: string): Promise<ProductRow | null> {
  const rows = await fetch(
    `${SUPABASE_URL}/rest/v1/products?id=eq.${encodeURIComponent(productId)}&select=id,image_urls,source&limit=1`,
    { headers: svc() },
  ).then((r) => (r.ok ? r.json() : [])).catch(() => []);
  return Array.isArray(rows) && rows[0] ? rows[0] : null;
}

async function hasTransparentPrimaryMedia(productId: string): Promise<{ treated: boolean; primaryUrl?: string }> {
  const rows = await fetch(
    `${SUPABASE_URL}/rest/v1/product_media?product_id=eq.${encodeURIComponent(productId)}&is_primary=eq.true&is_transparent=eq.true&variant_key=is.null&select=url&limit=1`,
    { headers: svc() },
  ).then((r) => (r.ok ? r.json() : [])).catch(() => []);
  const url = Array.isArray(rows) && rows[0]?.url;
  return { treated: !!url, primaryUrl: url || undefined };
}

function primaryLooksTransparent(p: ProductRow): boolean {
  const primary = (p.image_urls ?? [])[0];
  return !!primary && isOwnProductMediaUrl(primary) && isLikelyTransparentImage(primary);
}

/** First image that is not one of our own already-processed uploads. */
function pickSourceImage(p: ProductRow, override?: string | null): string | null {
  if (override) return override;
  const urls = Array.isArray(p.image_urls) ? p.image_urls.filter(Boolean) : [];
  return urls.find((u) => !isOwnProductMediaUrl(u)) ?? urls[0] ?? null;
}

async function persistTransparentImage(p: ProductRow, publicUrl: string, sourceUrl: string, engine: string) {
  // 1. products.image_urls — transparent PNG first, original kept after.
  const rest = (p.image_urls ?? []).filter((u) => u && u !== publicUrl);
  await fetch(`${SUPABASE_URL}/rest/v1/products?id=eq.${encodeURIComponent(p.id)}`, {
    method: "PATCH",
    headers: { ...svc(), "Content-Type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify({ image_urls: [publicUrl, ...rest] }),
  });

  // 2. Demote previous primary product-level media rows.
  await fetch(
    `${SUPABASE_URL}/rest/v1/product_media?product_id=eq.${encodeURIComponent(p.id)}&is_primary=eq.true&variant_key=is.null&url=neq.${encodeURIComponent(publicUrl)}`,
    {
      method: "PATCH",
      headers: { ...svc(), "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({ is_primary: false }),
    },
  ).catch(() => {});

  // 3. Upsert the new primary/transparent row.
  await fetch(`${SUPABASE_URL}/rest/v1/product_media?on_conflict=product_id,variant_key,url`, {
    method: "POST",
    headers: { ...svc(), "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify([{
      product_id: p.id,
      variant_key: null,
      view_type: "front_flat",
      url: publicUrl,
      is_primary: true,
      is_transparent: true,
      position: 0,
      source: p.source ?? "cj",
      metadata: { generated_by: engine, original_url: sourceUrl },
    }]),
  });
}

// ── Public entrypoint ──────────────────────────────────────────

export interface StripResult {
  ok: boolean;
  productId: string;
  skipped?: boolean;
  reason?: string;
  url?: string;
  engine?: string;
  error?: string;
}

/** Full pipeline for ONE product. Never throws — returns {ok:false,error}. */
export async function runStripBackground(productId: string, imageUrl?: string | null): Promise<StripResult> {
  try {
    const product = await loadProduct(productId);
    if (!product) return { ok: false, productId, error: "product not found" };

    // Already treated? (own-storage transparent primary OR flagged media row)
    if (primaryLooksTransparent(product)) return { ok: true, productId, skipped: true, reason: "already-transparent" };
    const media = await hasTransparentPrimaryMedia(productId);
    if (media.treated) return { ok: true, productId, skipped: true, reason: "already-transparent" };

    // No provider configured → leave the product untouched (never break it).
    if (!bgEngineConfigured()) return { ok: true, productId, skipped: true, reason: "engine-not-configured" };

    const sourceUrl = pickSourceImage(product, imageUrl) ?? media.primaryUrl ?? null;
    if (!sourceUrl) return { ok: false, productId, error: "no source image" };

    const { png, engine } = await removeBackground(sourceUrl);
    const publicUrl = await uploadTransparentPng(productId, png);
    await persistTransparentImage(product, publicUrl, sourceUrl, engine);

    return { ok: true, productId, url: publicUrl, engine };
  } catch (e: any) {
    return { ok: false, productId, error: e?.message ?? String(e) };
  }
}

/** Find up to `limit` published, non-archived products not yet treated. */
export async function findUntreatedProducts(limit: number, source?: string | null): Promise<ProductRow[]> {
  const src = source ? `&source=eq.${encodeURIComponent(source)}` : "";
  // Over-fetch, then filter in JS (treated-detection needs the image_urls
  // heuristic + a media check that PostgREST can't express in one query).
  const rows: ProductRow[] = await fetch(
    `${SUPABASE_URL}/rest/v1/products?is_published=eq.true&is_archived=eq.false${src}&select=id,image_urls,source&order=updated_at.desc&limit=${Math.max(limit * 6, 30)}`,
    { headers: svc() },
  ).then((r) => (r.ok ? r.json() : [])).catch(() => []);

  const out: ProductRow[] = [];
  for (const p of Array.isArray(rows) ? rows : []) {
    if (out.length >= limit) break;
    if (primaryLooksTransparent(p)) continue;
    const media = await hasTransparentPrimaryMedia(p.id);
    if (media.treated) continue;
    out.push(p);
  }
  return out;
}
