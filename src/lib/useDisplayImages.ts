// ─────────────────────────────────────────────────────────────
//  Luveni — storefront display images (curated, transparent-preferred)
//
//  Single source of truth for "which images does a customer see for this
//  product", built on orderCatalogImages() — the SAME canonical ordering
//  the shop tile uses — so the offer gallery's first image is always the
//  shop thumbnail (no click-through flash, ever):
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
//  Also returns displayUrlFor(sourceUrl): the display URL representing any
//  raw catalog/variant photo (its cutout when one exists), so color pickers
//  can jump the gallery to the right slide without positional guesswork.
// ─────────────────────────────────────────────────────────────

/* eslint-disable @typescript-eslint/no-explicit-any */

import { useMemo } from "react";
import { useProductMedia } from "./useProductMedia";
import { proxyImageUrl } from "./img";
import { orderCatalogImages } from "./darkHero";

export function useDisplayImages(
  productId: string | undefined,
  imageUrls: string[] | undefined,
  variants?: any[] | null,
): { images: string[]; loading: boolean; displayUrlFor: (sourceUrl?: string | null) => string | null } {
  const { media, loading } = useProductMedia(productId);

  const { images, sourceToDisplay } = useMemo(() => {
    const { images: catalog, heroSourceUrl } = orderCatalogImages(imageUrls, variants);

    // Photos the admin deliberately hid — the row's URL and its source.
    const hiddenUrls = new Set<string>();
    for (const m of media) {
      if (!m.hidden) continue;
      if (m.url) hiddenUrls.add(m.url);
      const orig = m.metadata?.original_url;
      if (orig) hiddenUrls.add(orig);
    }

    // Good cutouts (transparent + not hidden + not failed the quality gate).
    const good = media.filter(
      (m) => !m.hidden && m.is_transparent && m.metadata?.quality_ok !== false,
    );

    // Map every source photo → its display URL (the cutout when one exists).
    const sourceToDisplay = new Map<string, string>();
    for (const m of good) {
      const orig = m.metadata?.original_url;
      if (orig && !sourceToDisplay.has(orig)) sourceToDisplay.set(orig, m.url);
      sourceToDisplay.set(m.url, m.url);
    }

    const catalogRank = new Map<string, number>();
    catalog.forEach((u, i) => {
      if (!hiddenUrls.has(u) && !catalogRank.has(u)) catalogRank.set(u, i);
    });
    // Rank rows purely by the canonical catalog list — the SAME list the shop
    // tile reads — never by a page-local heuristic. Dark-first for CJ is a
    // DATA rule (the dark cutout is image_urls[0]), so both surfaces follow
    // it identically and one page can never drift from the other.
    void heroSourceUrl;
    const rankOf = (m: (typeof media)[number]) =>
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
    const out: string[] = [];
    const push = (raw: string | undefined | null) => {
      if (!raw || hiddenUrls.has(raw)) return;
      const u = proxyImageUrl(raw);
      if (seen.has(u)) return;
      seen.add(u);
      out.push(u);
    };

    for (const m of ordered) push(m.url);

    // Transparent-only once cutouts exist; raw catalog only as the
    // never-empty fallback for unprocessed products.
    if (out.length === 0) for (const u of catalog) push(u);

    return { images: out, sourceToDisplay };
  }, [media, imageUrls, variants]);

  const displayUrlFor = (sourceUrl?: string | null): string | null => {
    if (!sourceUrl) return null;
    const display = sourceToDisplay.get(sourceUrl) ?? sourceUrl;
    const proxied = proxyImageUrl(display);
    return images.includes(proxied) ? proxied : null;
  };

  return { images, loading, displayUrlFor };
}
