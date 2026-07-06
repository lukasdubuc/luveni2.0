// ─────────────────────────────────────────────────────────────
//  Luveni — storefront display images (curated, transparent-preferred)
//
//  Single source of truth for "which images does a customer see for this
//  product". Consumes the transparency pipeline's product_media rows and
//  the product's own image_urls, and returns EVERY photo the shopper
//  should see — not just the one clean cutout:
//    • admin-hidden photos (product_media.hidden) are never shown, and
//      they suppress the opaque original they came from too;
//    • a GOOD transparent cutout is preferred over the opaque original it
//      replaced (metadata.original_url), so there are no look-alike dupes;
//    • originals that never got a good cutout are STILL shown (framed by
//      the caller), so a product with model/lifestyle shots that resist
//      background removal shows its whole gallery instead of a lone image;
//    • deduped, ordered primary/position first then catalog order.
//  Falls back to the raw image_urls when a product has no processed media.
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
    // Every URL an admin deliberately hid — both the (bad) cutout row's URL
    // and the opaque original it came from. These never surface again.
    const hiddenUrls = new Set<string>();
    for (const m of media) {
      if (!m.hidden) continue;
      if (m.url) hiddenUrls.add(m.url);
      const orig = m.metadata?.original_url;
      if (orig) hiddenUrls.add(orig);
    }

    // Printful lists the bare print/design file first (files.cdn.printful.com),
    // which is just the flat artwork, not a wearable mockup. Skip that first
    // image whenever the product has real mockups after it — for existing AND
    // future Printful products, and for both the good-cutout list and the
    // catalog fallback below. (The design row's product_media.url is the same
    // printful CDN url, so excluding by url removes it everywhere.)
    const base0 = Array.isArray(fallbackImageUrls) ? fallbackImageUrls.filter(Boolean) : [];
    if (base0.length > 1 && /files\.cdn\.printful\.com/i.test(base0[0])) {
      hiddenUrls.add(base0[0]);
    }

    // Good cutouts (transparent + passed quality gate + not hidden).
    const good = media
      .filter((m) => !m.hidden && m.is_transparent && m.metadata?.quality_ok !== false)
      .sort((a, b) => (a.is_primary === b.is_primary ? a.position - b.position : a.is_primary ? -1 : 1));

    // Opaque originals a good cutout already replaced — prefer the cutout.
    const superseded = new Set(
      good.map((m) => m.metadata?.original_url).filter((u): u is string => !!u),
    );

    const seen = new Set<string>();
    const out: string[] = [];
    const push = (raw: string | undefined | null) => {
      if (!raw || hiddenUrls.has(raw) || superseded.has(raw)) return;
      const u = proxyImageUrl(raw);
      if (seen.has(u)) return;
      seen.add(u);
      out.push(u);
    };

    // 1. Clean transparent cutouts first (primary leads).
    for (const m of good) push(m.url);

    // Once a product has clean cutouts, the gallery is transparent-ONLY —
    // every catalog photo either has a cutout (which replaced it) or failed
    // the quality gate (and must not appear as a look-alike opaque duplicate).
    // Old pipeline rows that never recorded original_url would otherwise
    // resurface their source photo next to its own cutout.
    if (out.length > 0) return out;

    // 2. No processed media at all — show the raw catalog so the page is
    //    never empty. Strip the leading design/logo mockup (Printful lists
    //    the bare print file first).
    let base = Array.isArray(fallbackImageUrls) ? fallbackImageUrls.filter(Boolean) : [];
    if (opts.stripFirstFallback && base.length > 1) base = base.slice(1);
    for (const b of base) push(b);

    return out;
  }, [media, fallbackImageUrls, opts.stripFirstFallback]);

  return { images, loading };
}
