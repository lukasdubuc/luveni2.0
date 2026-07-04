// ─────────────────────────────────────────────────────────────
//  Luveni — client-side transparent-PNG processing (shared)
//
//  Extracted from CjTransparencyPanel so BOTH the admin sweep panel and
//  the publish/save flow can call ONE implementation that treats EVERY
//  image of a product (all image_urls + every distinct variant image),
//  not just image_urls[0].
//
//  Runs @imgly/background-removal in the browser (free, WASM), uploads a
//  transparent PNG per image to the public `product-media` bucket, and
//  writes one product_media row per source image with correct position
//  ordering.
//
//  DATA CONTRACT the storefront relies on (see report):
//   • Each source image → one product_media row. `url` is the transparent
//     PNG. `metadata.original_url` is the opaque source it came from.
//   • Ordering: product_media.position (0-based, image_urls order first,
//     then variant images).
//   • is_primary=true on exactly one product-level row (the former
//     image_urls[0]); position 0.
//   • QUALITY FLAG: metadata.quality_ok === true AND is_transparent === true
//     ⇒ GOOD, safe to show. metadata.quality_ok === false (and
//     is_transparent === false) ⇒ BAD cutout, storefront must hide it.
//     metadata.quality_reason explains a bad result; metadata.opaque_fraction
//     records the measured opaque-pixel fraction.
// ─────────────────────────────────────────────────────────────

import { supabase } from "@/integrations/supabase/client";
import {
  PRODUCT_MEDIA_BUCKET,
  isOwnProductMediaUrl,
  isLikelyTransparentImage,
} from "@/lib/img";

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface ProcessableProduct {
  id: string;
  title?: string;
  image_urls: string[];
  variants?: any[] | null;
  source?: string | null;
}

export type ProcessPhase =
  | "fetching"
  | "removing"
  | "grading"
  | "uploading"
  | "saving"
  | "done"
  | "skipped"
  | "bad"
  | "error";

export interface ImageProgress {
  index: number;
  total: number;
  sourceUrl: string;
  phase: ProcessPhase;
  note?: string;
}

export interface ProcessSummary {
  processed: number; // good cutouts published
  bad: number; // stored but flagged quality_ok=false
  skipped: number; // already transparent / own upload
  failed: number; // errors
  total: number;
}

export type RemoveBackgroundFn = (blob: Blob) => Promise<Blob>;

// Quality-gate thresholds on the fraction of opaque pixels in the result.
const MIN_OPAQUE_FRACTION = 0.03; // subject almost fully erased ⇒ bad
const MAX_OPAQUE_FRACTION = 0.97; // almost nothing removed ⇒ bad

// ── Image fetch (CORS-dodging, mirrors the old panel) ──────────
async function fetchImageBlob(url: string): Promise<Blob> {
  try {
    const res = await fetch(url, { mode: "cors" });
    if (res.ok) return await res.blob();
  } catch {
    /* fall through to proxy */
  }
  const proxied = `https://wsrv.nl/?url=${encodeURIComponent(url)}&n=-1`;
  const res = await fetch(proxied);
  if (!res.ok) throw new Error(`Could not fetch source image (HTTP ${res.status})`);
  return await res.blob();
}

// ── Quality gate ───────────────────────────────────────────────
/**
 * Fraction of pixels whose alpha is meaningfully opaque (>32/255) in the
 * background-removed PNG. Used to reject cutouts that erased the subject
 * (near 0) or removed nothing (near 1).
 */
export async function measureOpaqueFraction(png: Blob): Promise<number> {
  const bitmap = await createImageBitmap(png);
  try {
    // Downscale to keep the read cheap and constant-time regardless of size.
    const maxSide = 256;
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));

    let ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null = null;
    if (typeof OffscreenCanvas !== "undefined") {
      const canvas = new OffscreenCanvas(w, h);
      ctx = canvas.getContext("2d") as OffscreenCanvasRenderingContext2D | null;
    } else {
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      ctx = canvas.getContext("2d");
    }
    if (!ctx) throw new Error("no 2d canvas context for quality grading");

    ctx.drawImage(bitmap as any, 0, 0, w, h);
    const { data } = ctx.getImageData(0, 0, w, h);
    let opaque = 0;
    const totalPixels = w * h;
    for (let i = 3; i < data.length; i += 4) {
      if (data[i] > 32) opaque++;
    }
    return totalPixels === 0 ? 0 : opaque / totalPixels;
  } finally {
    bitmap.close?.();
  }
}

// ── Storage upload (create-if-missing bucket) ──────────────────
async function uploadTransparentPng(productId: string, png: Blob): Promise<string> {
  const path = `products/${productId}/transparent-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}.png`;
  const storage = supabase.storage;

  let { error } = await storage
    .from(PRODUCT_MEDIA_BUCKET)
    .upload(path, png, { upsert: true, contentType: "image/png" });

  if (error && /bucket.*not.*found/i.test(error.message)) {
    const { error: createErr } = await storage.createBucket(PRODUCT_MEDIA_BUCKET, {
      public: true,
    });
    if (createErr) {
      throw new Error(
        `Storage bucket "${PRODUCT_MEDIA_BUCKET}" is missing and could not be created from the browser (${createErr.message}). Apply migration 20260703_product_media_bucket.sql.`,
      );
    }
    ({ error } = await storage
      .from(PRODUCT_MEDIA_BUCKET)
      .upload(path, png, { upsert: true, contentType: "image/png" }));
  }
  if (error) throw new Error(`Upload failed: ${error.message}`);

  const {
    data: { publicUrl },
  } = storage.from(PRODUCT_MEDIA_BUCKET).getPublicUrl(path);
  return publicUrl;
}

// ── Source-image collection ────────────────────────────────────

interface SourceImage {
  url: string;
  variantKey: string | null;
  /** Whether this came from a product variant (vs product-level image_urls). */
  isVariant: boolean;
}

/** Pull any http(s) image URLs out of a variant object. */
function variantImageUrls(v: any): string[] {
  if (!v || typeof v !== "object") return [];
  const out: string[] = [];
  const push = (u: unknown) => {
    if (typeof u === "string" && /^https?:\/\//i.test(u)) out.push(u);
  };
  // The storefront reads `variant.image`; accept a few common aliases too.
  push(v.image);
  push(v.imageUrl);
  push(v.image_url);
  push(v.variantImage);
  if (Array.isArray(v.images)) v.images.forEach(push);
  return out;
}

function variantKeyOf(v: any): string | null {
  if (!v || typeof v !== "object") return null;
  const k =
    v.value ?? v.key ?? v.sku ?? v.variantKey ?? v.id ?? v.color ?? v.label ?? null;
  return k == null ? null : String(k);
}

/**
 * Every distinct source image for a product, in stable order:
 * product-level image_urls first, then variant images. Deduped by URL.
 */
export function collectSourceImages(product: ProcessableProduct): SourceImage[] {
  const seen = new Set<string>();
  const out: SourceImage[] = [];
  const add = (url: string, variantKey: string | null, isVariant: boolean) => {
    if (!url || seen.has(url)) return;
    seen.add(url);
    out.push({ url, variantKey, isVariant });
  };

  for (const u of Array.isArray(product.image_urls) ? product.image_urls : []) {
    if (u) add(u, null, false);
  }
  for (const v of Array.isArray(product.variants) ? product.variants : []) {
    const key = variantKeyOf(v);
    for (const u of variantImageUrls(v)) add(u, key, true);
  }
  return out;
}

/**
 * A source URL that is ALREADY transparent and must never be reprocessed:
 * it's a .png we treat as transparent, or one of our own uploads.
 */
export function isAlreadyTransparent(url: string): boolean {
  return isOwnProductMediaUrl(url) || isLikelyTransparentImage(url);
}

// ── DB persistence for a single processed image ────────────────

interface PersistArgs {
  product: ProcessableProduct;
  publicUrl: string;
  sourceUrl: string;
  variantKey: string | null;
  position: number;
  isPrimary: boolean;
  qualityOk: boolean;
  opaqueFraction: number;
  qualityReason?: string;
}

async function upsertMediaRow(a: PersistArgs) {
  const row = {
    view_type: a.isPrimary ? "front_flat" : "other",
    is_primary: a.isPrimary,
    // GOOD ⇒ is_transparent true. BAD ⇒ false so the storefront's transparent
    // filters (and product_media.is_transparent lookups) never surface it.
    is_transparent: a.qualityOk,
    position: a.position,
    source: a.product.source ?? "cj",
    metadata: {
      generated_by: "imgly-background-removal",
      original_url: a.sourceUrl,
      quality_ok: a.qualityOk,
      opaque_fraction: Number(a.opaqueFraction.toFixed(4)),
      ...(a.qualityReason ? { quality_reason: a.qualityReason } : {}),
    },
  };

  // The unique key includes the nullable variant_key (NULLs never conflict),
  // so upsert manually on (product_id, variant_key, url).
  let query = supabase
    .from("product_media")
    .select("id")
    .eq("product_id", a.product.id)
    .eq("url", a.publicUrl);
  query = a.variantKey == null ? query.is("variant_key", null) : query.eq("variant_key", a.variantKey);
  const { data: existing, error: selErr } = await query.maybeSingle();
  if (selErr) throw new Error(`product_media lookup failed: ${selErr.message}`);

  const { error: upsertErr } = existing
    ? await supabase.from("product_media").update(row).eq("id", (existing as any).id)
    : await supabase
        .from("product_media")
        .insert([{ product_id: a.product.id, variant_key: a.variantKey, url: a.publicUrl, ...row }]);
  if (upsertErr) throw new Error(`product_media upsert failed: ${upsertErr.message}`);
}

/** Demote any previously-primary product-level rows other than publicUrl. */
async function demotePrimary(productId: string, publicUrl: string) {
  const { error } = await supabase
    .from("product_media")
    .update({ is_primary: false })
    .eq("product_id", productId)
    .eq("is_primary", true)
    .is("variant_key", null)
    .neq("url", publicUrl);
  if (error) throw new Error(`product_media demote failed: ${error.message}`);
}

// ── Public entrypoint ──────────────────────────────────────────

/** Which source URLs already have a GOOD transparent media row. */
async function alreadyProcessedOriginals(productId: string): Promise<Set<string>> {
  const done = new Set<string>();
  const { data } = await supabase
    .from("product_media")
    .select("url, is_transparent, metadata")
    .eq("product_id", productId)
    .eq("is_transparent", true);
  for (const r of (data ?? []) as any[]) {
    const orig = r?.metadata?.original_url;
    if (typeof orig === "string") done.add(orig);
    if (typeof r?.url === "string") done.add(r.url);
  }
  return done;
}

/**
 * Process EVERY untreated image of a product. Uploads a transparent PNG and
 * writes a product_media row per image (good OR bad-but-flagged). Updates
 * products.image_urls so the good transparent primary sits first.
 *
 * Never throws for a single image — collects per-image outcomes into the
 * summary. Loads @imgly/background-removal lazily unless `removeBackground`
 * is supplied (so callers can share one loaded engine across products).
 */
export async function processProductImages(
  product: ProcessableProduct,
  opts: {
    removeBackground?: RemoveBackgroundFn;
    onProgress?: (p: ImageProgress) => void;
  } = {},
): Promise<ProcessSummary> {
  const summary: ProcessSummary = { processed: 0, bad: 0, skipped: 0, failed: 0, total: 0 };

  const sources = collectSourceImages(product);
  summary.total = sources.length;
  if (sources.length === 0) return summary;

  let removeBackground = opts.removeBackground;
  if (!removeBackground) {
    const mod = await import("@imgly/background-removal");
    removeBackground = (blob: Blob) => mod.removeBackground(blob);
  }

  const doneOriginals = await alreadyProcessedOriginals(product.id);

  // Track transparent replacements for product-level image_urls entries.
  const replacements = new Map<string, string>(); // sourceUrl -> publicUrl (good only)
  let primaryAssigned = false;

  for (let i = 0; i < sources.length; i++) {
    const { url: sourceUrl, variantKey, isVariant } = sources[i];
    const emit = (phase: ProcessPhase, note?: string) =>
      opts.onProgress?.({ index: i, total: sources.length, sourceUrl, phase, note });

    // Skip anything already transparent or already processed.
    if (isAlreadyTransparent(sourceUrl) || doneOriginals.has(sourceUrl)) {
      summary.skipped++;
      emit("skipped", "already transparent");
      continue;
    }

    try {
      emit("fetching", "fetching image");
      const blob = await fetchImageBlob(sourceUrl);

      emit("removing", "removing background");
      const png = await removeBackground(blob);

      emit("grading", "checking quality");
      let opaqueFraction = 0;
      try {
        opaqueFraction = await measureOpaqueFraction(png);
      } catch {
        // If we can't grade it, treat as unknown-but-passable rather than block.
        opaqueFraction = 0.5;
      }
      const tooEmpty = opaqueFraction < MIN_OPAQUE_FRACTION;
      const tooFull = opaqueFraction > MAX_OPAQUE_FRACTION;
      const qualityOk = !tooEmpty && !tooFull;
      const qualityReason = tooEmpty
        ? "subject-erased"
        : tooFull
          ? "nothing-removed"
          : undefined;

      emit("uploading", "uploading PNG");
      const publicUrl = await uploadTransparentPng(product.id, png);

      // First GOOD product-level image becomes the primary.
      const isPrimary = qualityOk && !isVariant && !primaryAssigned;
      if (isPrimary) {
        primaryAssigned = true;
        await demotePrimary(product.id, publicUrl);
      }

      emit("saving", "saving");
      await upsertMediaRow({
        product,
        publicUrl,
        sourceUrl,
        variantKey,
        position: i,
        isPrimary,
        qualityOk,
        opaqueFraction,
        qualityReason,
      });

      doneOriginals.add(sourceUrl);
      if (qualityOk && !isVariant) replacements.set(sourceUrl, publicUrl);

      if (qualityOk) {
        summary.processed++;
        emit("done");
      } else {
        summary.bad++;
        emit("bad", qualityReason);
      }
    } catch (e) {
      summary.failed++;
      emit("error", (e as Error).message || "unknown error");
    }
  }

  // Rewrite products.image_urls: swap each good product-level original for its
  // transparent PNG (preserving order), drop the opaque original, and float the
  // primary transparent to the front. Best-effort — never blocks the summary.
  if (replacements.size > 0) {
    try {
      const original = Array.isArray(product.image_urls) ? product.image_urls : [];
      const mapped = original.map((u) => replacements.get(u) ?? u);
      // Move a good primary-slot transparent to front.
      const primaryUrl = replacements.get(original[0]) ?? mapped[0];
      const deduped: string[] = [];
      for (const u of [primaryUrl, ...mapped]) {
        if (u && !deduped.includes(u)) deduped.push(u);
      }
      await supabase.from("products").update({ image_urls: deduped }).eq("id", product.id);
    } catch {
      /* image_urls is a convenience mirror; product_media is the source of truth */
    }
  }

  return summary;
}
