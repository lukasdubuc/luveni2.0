// ─────────────────────────────────────────────────────────────
//  Luveni — THE storefront image-order rule (single source of truth)
//
//  orderCatalogImages() produces the canonical ordered image list for a
//  product from data BOTH pages already have (products.image_urls +
//  variants). The shop tile is list[0]; the offer gallery ranks its media
//  rows by position in this SAME list — so the tile and the first gallery
//  image can never disagree (no flash), and any future ordering change
//  happens here once instead of in two page-local heuristics.
//
//  Rules, in order:
//   1. Printful's bare print/design artwork (index 0) is dropped whenever
//      real mockups follow.
//   2. The DARKEST colorway leads: variant colors are ranked by true
//      luminance (black < charcoal < navy < …), not by name matching, so
//      "always the darkest one" holds for every current and future product.
//      CJ variants carry their own image; Printful maps colors positionally.
//   3. Everything else keeps catalog order, deduped.
// ─────────────────────────────────────────────────────────────

/* eslint-disable @typescript-eslint/no-explicit-any */

import { colorLuminance } from "./colors";

type VariantLike = { image?: string; attributes?: Record<string, string> };

function variantColor(v: VariantLike): string {
  const a = v?.attributes ?? {};
  return (a.color ?? a.colour ?? a.option ?? "").trim();
}

/** Distinct color values in variant order (drives Printful's positional map). */
function colorValues(variants: VariantLike[]): string[] {
  const out: string[] = [];
  for (const v of variants) {
    const c = variantColor(v);
    if (c && !out.includes(c)) out.push(c);
  }
  return out;
}

const DARK_NAME =
  /\b(black|jet|charcoal|anthracite|graphite|onyx|obsidian|coal|ink|midnight)\b|dark/i;

/**
 * The DARKEST color value a product offers, by resolved luminance.
 * Names that resolve rank by real luminance; unresolvable names that still
 * read dark ("Dark Camo") rank just above true black. Null when the product
 * has no identifiably dark colorway.
 */
export function darkestColor(variants: VariantLike[]): string | null {
  let best: string | null = null;
  let bestLum = Infinity;
  for (const c of colorValues(variants)) {
    // An explicit "black" always wins — mapped hexes would otherwise let a
    // very dark navy (#001f5b) numerically outrank black (#111111).
    const lum = /\bblack\b/i.test(c)
      ? 0
      : colorLuminance(c) ?? (DARK_NAME.test(c) ? 0.06 : null);
    if (lum != null && lum < bestLum) { bestLum = lum; best = c; }
  }
  // Only lead with it when it's actually dark — a catalog whose darkest
  // option is beige should keep its natural order.
  return bestLum <= 0.35 ? best : null;
}

/** The image URL belonging to a given color, per provider convention. */
function imageForColor(
  color: string,
  variants: VariantLike[],
  imageUrls: string[],
): string | null {
  // CJ: the variant carries its own photo.
  const withImage = variants.find((v) => variantColor(v) === color && v.image);
  if (withImage?.image) return withImage.image;
  // Printful: design at [0], one mockup per color in variant order.
  const idx = colorValues(variants).indexOf(color);
  if (idx >= 0 && imageUrls[idx + 1]) return imageUrls[idx + 1];
  return null;
}

/**
 * Canonical ordered catalog list (see header). `heroAliases` maps a URL in
 * the returned list to other URLs that represent the same photo (the opaque
 * original a transparent cutout came from), so media-row ranking can match
 * either form.
 */
export function orderCatalogImages(
  imageUrls: string[] | null | undefined,
  variants: VariantLike[] | null | undefined,
): { images: string[]; heroSourceUrl: string | null } {
  let urls = (Array.isArray(imageUrls) ? imageUrls : []).filter(Boolean);
  const vs = Array.isArray(variants) ? variants : [];

  // 1. Drop the Printful print/design artwork when real mockups follow.
  if (urls.length > 1 && /files\.cdn\.printful\.com/i.test(urls[0])) urls = urls.slice(1);

  // 2. Darkest colorway leads. The hero may live IN the list (Printful
  //    mockup, or a CJ cutout already placed in image_urls) or be the CJ
  //    variant's opaque source photo whose cutout is in the list — expose it
  //    as heroSourceUrl so media ranking can match by original_url too.
  const dark = darkestColor(vs);
  let heroSourceUrl: string | null = null;
  if (dark) {
    const heroImg = imageForColor(dark, vs, urls);
    if (heroImg) {
      if (urls.includes(heroImg)) {
        urls = [heroImg, ...urls.filter((u) => u !== heroImg)];
      } else {
        heroSourceUrl = heroImg;
      }
    }
  }

  // 3. Dedupe, preserving order.
  const seen = new Set<string>();
  const images = urls.filter((u) => !seen.has(u) && (seen.add(u), true));
  return { images, heroSourceUrl };
}
