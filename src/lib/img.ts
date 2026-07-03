// Proxy Printful/other CDN images through wsrv.nl to dodge CORS blocks
// and get on-the-fly resizing. Shared by the grid and the product modal.
export function proxyImageUrl(url: string): string {
  if (!url) return url;
  if (url.includes("files.cdn.printful.com")) {
    return `https://wsrv.nl/?url=${encodeURIComponent(url)}&n=-1`;
  }
  return url;
}

/** Public Supabase storage bucket that holds background-removed product PNGs. */
export const PRODUCT_MEDIA_BUCKET = "product-media";

/** True when the URL points into our own `product-media` storage bucket. */
export function isOwnProductMediaUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  return url.includes(`/storage/v1/object/public/${PRODUCT_MEDIA_BUCKET}/`);
}

/** Unwrap a wsrv.nl proxy URL so heuristics can inspect the original CDN URL. */
function unwrapProxiedUrl(url: string): string {
  if (url.startsWith("https://wsrv.nl/")) {
    try {
      const inner = new URL(url).searchParams.get("url");
      if (inner) return inner;
    } catch {
      /* keep original */
    }
  }
  return url;
}

/**
 * Heuristic transparency check for product imagery. PNG assets (our own
 * `product-media` uploads and Printful flat mockups) are treated as
 * transparent grid-eligible art; JPG/WEBP vendor photos (e.g. untreated CJ
 * Dropshipping imports) are not. Prefer product_media.is_transparent when a
 * row is available and fall back to this for plain image_urls entries.
 */
export function isLikelyTransparentImage(url: string | null | undefined): boolean {
  if (!url) return false;
  const raw = unwrapProxiedUrl(url);
  const path = raw.split(/[?#]/)[0];
  return /\.png$/i.test(path);
}
