// ─────────────────────────────────────────────────────────────
//  Luveni — storefront display images (curated, transparent-preferred)
//
//  computeDisplayImages() is the ONE pure function that decides "which
//  images does a customer see for this product", built on
//  orderCatalogImages() — the same canonical ordering everywhere:
//    • admin-hidden photos (product_media.hidden) never show, and they
//      suppress the opaque original they came from;
//    • a GOOD transparent cutout replaces the opaque original it came from
//      (metadata.original_url) — galleries are transparent-only once a
//      product has clean cutouts;
//    • rows rank by their photo's position in the canonical catalog list
//      (deterministic; per-variant position collisions can't shuffle it),
//      with ungraded legacy cutouts demoted within a slot;
//    • raw catalog photos remain the never-empty fallback.
//
//  BOTH route loaders feed it the same product_media rows BEFORE first
//  paint: the shop grid tile is images[0] and the offer gallery renders the
//  same list, so the click-through shared-element morph animates between
//  two copies of the exact same (already-cached) image — no flash, no
//  post-paint reshuffle.
// ─────────────────────────────────────────────────────────────

/* eslint-disable @typescript-eslint/no-explicit-any */

import { supabase } from "@/integrations/supabase/client";
import { proxyImageUrl } from "./img";
import { orderCatalogImages } from "./darkHero";
import type { ProductMedia } from "./useProductMedia";

const MEDIA_COLUMNS =
  "id, product_id, variant_key, view_type, url, is_primary, is_transparent, position, hidden, metadata";

/** Loader-side fetch: media rows for one product (offer page). */
export async function fetchProductMedia(productId: string): Promise<ProductMedia[]> {
  const { data, error } = await (supabase as any)
    .from("product_media")
    .select(MEDIA_COLUMNS)
    .eq("product_id", productId)
    // Stable order: position collides across rows (per-variant mockups all
    // share 0/1), so tiebreak on id or the gallery reshuffles per request.
    .order("position", { ascending: true })
    .order("id", { ascending: true });
  if (error) {
    console.warn("fetchProductMedia:", error.message);
    return [];
  }
  return (data ?? []) as ProductMedia[];
}

/**
 * Loader-side fetch: ALL media rows grouped by product (shop grid). One
 * query for the whole catalog; RLS already limits anon reads to media of
 * published, non-archived products.
 */
export async function fetchAllProductMedia(): Promise<Record<string, ProductMedia[]>> {
  const { data, error } = await (supabase as any)
    .from("product_media")
    .select(MEDIA_COLUMNS)
    .order("position", { ascending: true })
    .order("id", { ascending: true });
  if (error) {
    console.warn("fetchAllProductMedia:", error.message);
    return {};
  }
  const byProduct: Record<string, ProductMedia[]> = {};
  for (const row of (data ?? []) as (ProductMedia & { product_id: string })[]) {
    (byProduct[row.product_id] ??= []).push(row);
  }
  return byProduct;
}

export type DisplayImages = {
  /** Final customer-visible image URLs (proxied), best first. Never reshuffles. */
  images: string[];
  /** raw source URL → display URL (its cutout when one exists). */
  sourceToDisplay: Record<string, string>;
};

export function computeDisplayImages(
  media: ProductMedia[] | null | undefined,
  imageUrls: string[] | null | undefined,
  variants?: any[] | null,
): DisplayImages {
  const rows = Array.isArray(media) ? media : [];
  const { images: catalog } = orderCatalogImages(imageUrls, variants);

  // Photos the admin deliberately hid — the row's URL and its source.
  const hiddenUrls = new Set<string>();
  for (const m of rows) {
    if (!m.hidden) continue;
    if (m.url) hiddenUrls.add(m.url);
    const orig = m.metadata?.original_url;
    if (orig) hiddenUrls.add(orig);
  }

  // Good cutouts (transparent + not hidden + not failed the quality gate).
  const good = rows.filter(
    (m) => !m.hidden && m.is_transparent && m.metadata?.quality_ok !== false,
  );

  // Map every source photo → its display URL (the cutout when one exists).
  const sourceToDisplay: Record<string, string> = {};
  for (const m of good) {
    const orig = m.metadata?.original_url;
    if (orig && !(orig in sourceToDisplay)) sourceToDisplay[orig] = m.url;
    sourceToDisplay[m.url] = m.url;
  }

  const catalogRank = new Map<string, number>();
  catalog.forEach((u, i) => {
    if (!hiddenUrls.has(u) && !catalogRank.has(u)) catalogRank.set(u, i);
  });
  // Rank rows purely by the canonical catalog list — the SAME list every
  // surface reads — never by a page-local heuristic. Dark-first for CJ is a
  // DATA rule (the dark cutout is image_urls[0]), so no surface can drift.
  const rankOf = (m: ProductMedia) =>
    catalogRank.get(m.url) ??
    (m.metadata?.original_url ? catalogRank.get(m.metadata.original_url) : undefined) ??
    Number.MAX_SAFE_INTEGER;

  const ordered = [...good].sort((a, b) => {
    const ra = rankOf(a), rb = rankOf(b);
    if (ra !== rb) return ra - rb;
    // Within a slot, quality-graded cutouts beat ungraded legacy ones.
    const qa = a.metadata?.quality_ok === true ? 0 : 1;
    const qb = b.metadata?.quality_ok === true ? 0 : 1;
    if (qa !== qb) return qa - qb;
    if (a.is_primary !== b.is_primary) return a.is_primary ? -1 : 1;
    if (a.position !== b.position) return a.position - b.position;
    return a.url.localeCompare(b.url);
  });

  const seen = new Set<string>();
  const images: string[] = [];
  const push = (raw: string | undefined | null) => {
    if (!raw || hiddenUrls.has(raw)) return;
    const u = proxyImageUrl(raw);
    if (seen.has(u)) return;
    seen.add(u);
    images.push(u);
  };

  for (const m of ordered) push(m.url);

  // Transparent-only once cutouts exist; raw catalog only as the
  // never-empty fallback for unprocessed products.
  if (images.length === 0) for (const u of catalog) push(u);

  return { images, sourceToDisplay };
}

/**
 * Resolve a raw catalog/variant photo URL to the display URL representing it
 * in `images` (its cutout when one exists) — used by color pickers to jump
 * the gallery to the right slide without positional guesswork.
 */
export function displayUrlFor(
  display: DisplayImages,
  sourceUrl?: string | null,
): string | null {
  if (!sourceUrl) return null;
  const mapped = display.sourceToDisplay[sourceUrl] ?? sourceUrl;
  const proxied = proxyImageUrl(mapped);
  return display.images.includes(proxied) ? proxied : null;
}

/** Session keys shared by the shop grid and the offer page so the exit morph
 *  lands on the exact tile of the product being viewed. */
export const LAST_VIEWED_PRODUCT_KEY = "luveni:last-viewed-product";
