// ─────────────────────────────────────────────────────────────
//  Luveni — dark-variant hero image
//
//  The catalog aesthetic leads with the black/dark colorway. This helper
//  picks the product image that belongs to the darkest color variant, and
//  BOTH surfaces use it — the shop tile and the offer gallery's first
//  image — so the click-through morph never flashes a different photo.
//
//  Resolution per provider:
//   • CJ: variants carry their own `image`; return the dark variant's image
//     (the storefront maps it to its transparent cutout via original_url).
//   • Printful: no per-variant image; colors map positionally into
//     image_urls (design at 0, then one mockup per color in variant order).
// ─────────────────────────────────────────────────────────────

/* eslint-disable @typescript-eslint/no-explicit-any */

const DARK_NAME =
  /\b(black|jet|charcoal|anthracite|graphite|onyx|obsidian|coal|ink|midnight)\b|dark/i;

type VariantLike = {
  image?: string;
  attributes?: Record<string, string>;
};

/** The color-ish attribute value of a variant (color/colour/option). */
function variantColor(v: VariantLike): string {
  const a = v?.attributes ?? {};
  return (a.color ?? a.colour ?? a.option ?? "").trim();
}

/** All distinct color values, in variant order (drives Printful mapping). */
function colorValues(variants: VariantLike[]): string[] {
  const out: string[] = [];
  for (const v of variants) {
    const c = variantColor(v);
    if (c && !out.includes(c)) out.push(c);
  }
  return out;
}

/**
 * Preferred hero image URL for a product — the dark colorway's photo when
 * one is identifiable, else null (callers keep their existing default).
 * `imageUrls` must be the RAW products.image_urls (positional mapping).
 */
export function pickDarkHeroUrl(
  variants: VariantLike[] | null | undefined,
  imageUrls: string[] | null | undefined,
): string | null {
  const vs = Array.isArray(variants) ? variants : [];
  const urls = Array.isArray(imageUrls) ? imageUrls.filter(Boolean) : [];
  if (vs.length === 0) return null;

  const colors = colorValues(vs);
  const darkColor = colors.find((c) => DARK_NAME.test(c));
  if (!darkColor) return null;

  // Per-variant image (CJ): the dark variant's own photo wins.
  const withImage = vs.find((v) => variantColor(v) === darkColor && v.image);
  if (withImage?.image) return withImage.image;

  // Positional mapping (Printful): image_urls[0] is the design artwork,
  // colors follow in variant order → colorIndex + 1.
  const idx = colors.indexOf(darkColor);
  if (idx >= 0 && urls[idx + 1]) return urls[idx + 1];
  return null;
}
