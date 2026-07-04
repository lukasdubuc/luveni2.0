// ─────────────────────────────────────────────────────────────
//  Luveni — storefront display images (quality-gated, deduped)
//
//  Single source of truth for "which images does a customer see for this
//  product". Consumes the transparency pipeline's product_media rows:
//    • only GOOD cutouts are shown — metadata.quality_ok === false marks a
//      bad background removal, which is hidden so a customer never sees it;
//    • a transparent row supersedes the opaque original it came from
//      (metadata.original_url), so there are never look-alike duplicates;
//    • ordered by product_media.position (primary first).
//  Falls back to the raw image_urls when a product has no processed media
//  yet (e.g. a Printful product that never needed treatment).
// ─────────────────────────────────────────────────────────────

import { useMemo } from "react";
import { useProductMedia } from "./useProductMedia";
import { proxyImageUrl } from "./img";

export function useDisplayImages(
  productId: string | undefined,
  fallbackImageUrls: string[] | undefined,
  opts: { stripFirstFallback?: boolean } = {},
): { images: string[]; loading: boolean } {
  const { media, loading } = useProductMedia(productId);

  const images = useMemo(() => {
    // URLs that a transparent row has already replaced — never show these.
    const superseded = new Set(
      media.map((m) => m.metadata?.original_url).filter((u): u is string => !!u),
    );

    const good = media
      .filter((m) => m.is_transparent && (m.metadata as any)?.quality_ok !== false)
      .filter((m) => !superseded.has(m.url))
      .sort((a, b) => (a.is_primary === b.is_primary ? a.position - b.position : a.is_primary ? -1 : 1));

    const seen = new Set<string>();
    const dedupe = (urls: string[]) => urls.filter((u) => u && !seen.has(u) && (seen.add(u), true));

    if (good.length > 0) {
      return dedupe(good.map((m) => proxyImageUrl(m.url)));
    }

    // No processed media — fall back to the raw catalog images.
    let base = Array.isArray(fallbackImageUrls) ? fallbackImageUrls.filter(Boolean) : [];
    if (opts.stripFirstFallback && base.length > 1) base = base.slice(1);
    return dedupe(base.map(proxyImageUrl));
  }, [media, fallbackImageUrls, opts.stripFirstFallback]);

  return { images, loading };
}
