import {
  createFileRoute,
  useNavigate,
  useRouter,
  useCanGoBack,
  Link,
} from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { fetchProducts } from "@/lib/useProducts";
import { offer } from "@/config/site";
import { useCart } from "@/context/CartContext";
import { ZoomPanImage } from "@/components/site/ZoomPanImage";
import { isLikelyTransparentImage } from "@/lib/img";
import {
  computeDisplayImages,
  displayUrlFor as resolveDisplayUrl,
  fetchProductMedia,
  LAST_VIEWED_PRODUCT_KEY,
} from "@/lib/displayImages";
import type { ProductMedia } from "@/lib/useProductMedia";
import { tryResolveColor } from "@/lib/colors";

// ─── Types ────────────────────────────────────────────────────────────────────

type ProductVariant = {
  sku: string;
  stock?: number;
  price_cents?: number;
  external_sku?: string;
  fulfillment_provider?: string;
  // CJ variants carry their own per-variant image; Printful variants do not
  // (Printful relies on positional image_urls indexing instead).
  image?: string;
  attributes?: Record<string, string>;
};

type Product = {
  id: string;
  title: string;
  slug: string;
  price_cents: number;
  discounted_price_cents?: number | null;
  image_urls: string[];
  description?: string | null;
  variants?: ProductVariant[];
  bullet_points?: string[];
  is_published?: boolean;
};

// ─── Route ────────────────────────────────────────────────────────────────────

const formatTitle = (slug: string) => {
  return slug.split("-").map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
};

export const Route = createFileRoute("/offer/$slug")({
  loader: async ({ params }) => {
    const [productResult, allProducts] = await Promise.all([
      (supabase as any)
        .from("products_public")
        .select("id, slug, title, description, price_cents, price_cents_discounted, currency, image_urls, is_published, is_archived, display_order, variants, created_at, updated_at")
        .eq("slug", params.slug)
        .eq("is_published", true)
        .maybeSingle(),
      fetchProducts({ onlyPublished: true }),
    ]);
    const product = productResult.data ?? null;
    // Curated media resolves IN the loader, so the gallery renders its final
    // image list on first paint — no post-paint reshuffle, and the first image
    // is byte-identical to the shop tile (the morph never flashes).
    const media = product ? await fetchProductMedia(product.id) : [];
    return {
      product,
      allProducts: allProducts ?? [],
      media,
    };
  },
  // Prev/next product flips reuse the cached loader data instead of
  // refetching the whole catalog on every wheel/swipe — no lag between
  // products.
  staleTime: 60_000,
  head: ({ loaderData }: any) => {
    const product = loaderData?.product;
    const title = product ? formatTitle(product.slug) : offer.name;
    const description = product?.description ?? offer.shortPitch;
    const canonical = product ? `https://luveni.lovable.app/offer/${product.slug}` : undefined;
    // Same hero the shop tile and gallery show — for link previews.
    const heroImage = product
      ? computeDisplayImages(loaderData?.media, product.image_urls, product.variants).images[0]
      : undefined;
    const priceCents = product?.price_cents_discounted ?? product?.price_cents;
    // schema.org Product + Offer → price/availability rich results in search.
    const jsonLd = product
      ? JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Product",
          name: product.title,
          ...(heroImage ? { image: [heroImage] } : {}),
          ...(product.description ? { description: product.description } : {}),
          offers: {
            "@type": "Offer",
            url: canonical,
            priceCurrency: (product.currency || "usd").toUpperCase(),
            price: priceCents != null ? (priceCents / 100).toFixed(2) : undefined,
            availability: "https://schema.org/InStock",
          },
        })
      : null;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        ...(heroImage ? [{ property: "og:image", content: heroImage }] : []),
        { property: "og:type", content: "product" },
      ],
      links: canonical ? [{ rel: "canonical", href: canonical }] : [],
      scripts: jsonLd
        ? [{ type: "application/ld+json", children: jsonLd }]
        : [],
    };
  },
  component: OfferSlugPage,
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function normalizeOptionName(key: string) {
  const lower = key.toLowerCase();
  if (lower === "size") return "SIZE";
  if (lower === "color" || lower === "colour") return "COLOR";
  return key.toUpperCase();
}

function sortOptionKeys(keys: string[]) {
  // Color first, then size — consistent with the shop modal (CJ ordering).
  const priority = ["color", "colour", "size"];
  return [...keys].sort((a, b) => {
    const ai = priority.indexOf(a.toLowerCase());
    const bi = priority.indexOf(b.toLowerCase());
    if (ai !== -1 || bi !== -1) return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    return a.localeCompare(b);
  });
}

function formatPrice(cents?: number | null) {
  if (cents == null) return "PRICE PENDING";
  // Whole-dollar prices drop the ".00" so the PDP matches the grid ($25, not
  // $25.00); real cents are kept ($32.99 never rounds to $33).
  return cents % 100 === 0 ? `$${cents / 100}` : `$${(cents / 100).toFixed(2)}`;
}

// ─── Color → image mapping ────────────────────────────────────────────────────
// Printful always puts the logo/design mockup at image_urls[0].
// Color images follow in the same order colors appear in the variants array.
// colorIndex 0 → image_urls[1], colorIndex 1 → image_urls[2], etc.
// ─── Resolve Image Logic ──────────────────────────────────────────────────────

/**
 * Maps a specific color value to a product image index.
 * Fallback order: Specific Color -> Generic Image -> Logo Mockup -> Empty String
 */
export function resolveVariantImage(
  imageUrls: string[],
  colorValue: string | undefined,
  colorValues: string[],
): string {
  if (!colorValue || colorValues.length === 0) return imageUrls[1] ?? imageUrls[0] ?? "";

  const colorIndex = colorValues.indexOf(colorValue);
  if (colorIndex === -1) return imageUrls[1] ?? imageUrls[0] ?? "";

  // +1 because imageUrls[0] is typically a logo/hero mockup
  return imageUrls[colorIndex + 1] ?? imageUrls[1] ?? imageUrls[0] ?? "";
}

/**
 * Unified variant → image resolver. Any provider that attaches a per-variant
 * image (CJ) wins outright — that image is the exact variant the shopper picked,
 * so the cart preview and gallery always match the selection. Providers with no
 * per-variant image (Printful) fall back to positional image_urls indexing.
 */
export function pickVariantImage(
  variant: { image?: string } | undefined,
  imageUrls: string[],
  colorValue: string | undefined,
  colorValues: string[],
): string {
  if (variant?.image) return variant.image;
  return resolveVariantImage(imageUrls, colorValue, colorValues);
}

// ─── Color Resolution ─────────────────────────────────────────────────────────
// Single source of truth lives in @/lib/colors (shared with the dark-hero
// catalog ordering rule) — re-exported here for existing importers.
export { tryResolveColor, resolveColor } from "@/lib/colors";

/** Size tokens (S/M/L/XL/2XL…, numeric, one-size). Used to classify options. */
const _sizeToken =
  /^(xxxs|xxs|xs|s|m|l|xl|xxl|xxxl|[2-6]xl|one[\s-]?size|os|free[\s-]?size|[0-9]{1,3}(\.[0-9])?|[0-9]{1,2}[\s-]?(months?|m|y))$/i;

export function isSizeValue(value: string): boolean {
  return _sizeToken.test(value.trim());
}

/**
 * Classify an option's *values* (not its key name) into a display role. Vendor
 * imports are wildly inconsistent — colors land under a "size" key, style codes
 * like "1Style" land under "color", product titles leak into "color" — so we
 * never trust the key. We look at what the values actually are.
 *
 *  - "size"   → values are size tokens → centered text chips
 *  - "color"  → values resolve to real colors → color circles
 *  - "style"  → multiple unresolvable values (e.g. 1Style/2Style) → image circles
 *  - "hidden" → a single degenerate value (a title/SKU) → no picker at all
 */
export function classifyOptionValues(values: string[]): "size" | "color" | "style" | "hidden" {
  const vals = values.map((v) => v?.trim()).filter(Boolean);
  if (vals.length <= 1) return "hidden";
  const threshold = Math.ceil(vals.length * 0.6);
  if (vals.filter(isSizeValue).length >= threshold) return "size";
  if (vals.filter((v) => tryResolveColor(v) !== null).length >= threshold) return "color";
  return "style";
}

export function isColorOption(key: string): boolean {
  return /^(color|colour)$/i.test(key);
}

/** Proxy Printful CDN images through wsrv.nl to avoid CORS blocks. */
function proxyImageUrl(url: string): string {
  if (!url) return url;
  if (url.includes("files.cdn.printful.com")) {
    return `https://wsrv.nl/?url=${encodeURIComponent(url)}&n=-1`;
  }
  return url;
}

// ─── Gallery image (with client-side background removal) ───────────────────────

function GalleryImg({
  src, framed, isActive, alt, onClick, sharedName,
}: {
  src: string;
  framed: boolean;
  isActive: boolean;
  alt: string;
  onClick: () => void;
  sharedName?: string;
}) {
  const showFrame = framed;
  return (
    <img
      src={src}
      alt={alt}
      loading={isActive ? "eager" : "lazy"}
      decoding="async"
      onClick={onClick}
      style={{
        position: "absolute",
        maxWidth: "100%",
        maxHeight: "100%",
        objectFit: "contain",
        display: "block",
        cursor: "zoom-in",
        transition: "opacity 0.15s ease-in-out, visibility 0.15s",
        opacity: isActive ? 1 : 0,
        visibility: isActive ? "visible" : "hidden",
        pointerEvents: isActive ? "auto" : "none",
        // Only the on-screen image claims the shared name, so it morphs from
        // the shop thumbnail on navigation (Yeezy-style zoom).
        ...(isActive && sharedName ? { viewTransitionName: sharedName } : null),
        ...(showFrame
          ? {
              background: "#fff",
              borderRadius: "16px",
              padding: "10px",
              boxShadow: "0 1px 12px rgba(0,0,0,0.06)",
            }
          : null),
      }}
    />
  );
}

// ─── Main Page Component ──────────────────────────────────────────────────────

function OfferSlugPage() {
  const { product, allProducts, media } = Route.useLoaderData() as {
    product: Product | null;
    allProducts: Product[];
    media: ProductMedia[];
  };
  const navigate = useNavigate();
  const router = useRouter();
  const canGoBack = useCanGoBack();
  // Set when the shopper arrived from the shop grid (Link state). Exiting via
  // history.back() then restores the grid's scroll position AND lets the
  // shared-element morph land on the exact tile — no more "back at the top".
  const cameFromShop = !!(router.state.location.state as any)?.fromShop;

  const { addItem, count: cartCount } = useCart();
  const [addedFeedback, setAddedFeedback] = useState(false);
  const [currentStep, setCurrentStep] = useState<number | null>(null);

  const currentIndex = useMemo(
    () => allProducts.findIndex((p) => p.slug === product?.slug),
    [allProducts, product?.slug],
  );

  const prevProduct = currentIndex > 0 ? allProducts[currentIndex - 1] : null;
  const nextProduct =
    currentIndex < allProducts.length - 1 ? allProducts[currentIndex + 1] : null;

  const navigateCooldown = useRef(false);
  // Swallow scroll/touch inertia for a beat right after a product opens or
  // changes, so the momentum from the click/scroll that navigated here does
  // not immediately flip to the next product (the "glitch on open").
  const navSettleUntil = useRef(0);

  // Product flips REPLACE the history entry (never push): history stays
  // [shop, product], so the browser back button / × always returns to the
  // grid in one step with its scroll position intact, no matter how many
  // products were flipped through. `fromShop` rides along.
  const goToPrev = useCallback(() => {
    if (navigateCooldown.current || !prevProduct) return;
    navigateCooldown.current = true;
    navigate({
      to: "/offer/$slug",
      params: { slug: prevProduct.slug },
      replace: true,
      state: { fromShop: cameFromShop } as any,
    });
    setTimeout(() => { navigateCooldown.current = false; }, 500);
  }, [prevProduct, navigate, cameFromShop]);

  const goToNext = useCallback(() => {
    if (navigateCooldown.current || !nextProduct) return;
    navigateCooldown.current = true;
    navigate({
      to: "/offer/$slug",
      params: { slug: nextProduct.slug },
      replace: true,
      state: { fromShop: cameFromShop } as any,
    });
    setTimeout(() => { navigateCooldown.current = false; }, 500);
  }, [nextProduct, navigate, cameFromShop]);

  // The shop grid names ONLY this product's tile as the shared morph target,
  // so exiting zooms the image back into the exact cell being viewed.
  useEffect(() => {
    if (!product?.id) return;
    try {
      sessionStorage.setItem(LAST_VIEWED_PRODUCT_KEY, product.id);
    } catch { /* private mode */ }
  }, [product?.id]);

  const exitToShop = useCallback(() => {
    if (justClosedZoom.current) return;
    if (cameFromShop && canGoBack) router.history.back();
    else navigate({ to: "/shop" });
  }, [cameFromShop, canGoBack, router, navigate]);

  useEffect(() => {
    if (!product || allProducts.length === 0) return;

    // Warm the neighbouring product images without a `preload` (which the
    // browser warns about when the resource isn't used within seconds of load)
    // — a plain Image() prefetch primes the HTTP cache silently instead.
    const created: HTMLLinkElement[] = [];
    [prevProduct, nextProduct].forEach((p) => {
      if (p?.image_urls?.[0]) {
        const img = new Image();
        img.src = proxyImageUrl(p.image_urls[0]);
      }
      if (p) {
        const link = document.createElement("link");
        link.rel = "prefetch";
        link.href = `/offer/${p.slug}`;
        document.head.appendChild(link);
        created.push(link);
      }
    });
    return () => { created.forEach((l) => l.remove()); };
  }, [product, prevProduct, nextProduct]);

  const touchStartY = useRef<number | null>(null);
  const touchStartX = useRef<number | null>(null);
  const touchOnGallery = useRef(false);

  const [zoomOpen, setZoomOpen] = useState(false);
  
  // Transition lock and cooldown to ignore trailing trackpad/touch inertia on zoom out
  const justClosedZoom = useRef(false);
  const closedZoomTimeout = useRef<any>(null);
  const wasZoomOpen = useRef(false);

  useEffect(() => {
    if (!zoomOpen && wasZoomOpen.current) {
      justClosedZoom.current = true;
      if (closedZoomTimeout.current) clearTimeout(closedZoomTimeout.current);
      closedZoomTimeout.current = setTimeout(() => {
        justClosedZoom.current = false;
      }, 800); // 800ms cooldown threshold to swallow any kinetic scrolling inertia
    }
    wasZoomOpen.current = zoomOpen;
  }, [zoomOpen]);

  useEffect(() => {
    return () => {
      if (closedZoomTimeout.current) clearTimeout(closedZoomTimeout.current);
    };
  }, []);

  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      // Zoom modal is open or recently closed — lock product navigation so scrolling the
      // zoomed image doesn't flip to the next/previous product underneath.
      if (zoomOpen || justClosedZoom.current || Date.now() < navSettleUntil.current) return;
      const target = e.target as HTMLElement;
      if (target.closest("[data-gallery]")) return;
      if (Math.abs(e.deltaY) < 30) return;
      e.preventDefault();
      if (e.deltaY < 0) goToPrev(); else goToNext();
    };
    const handleTouchStart = (e: TouchEvent) => {
      if (zoomOpen || justClosedZoom.current || Date.now() < navSettleUntil.current) return;
      const target = e.target as HTMLElement;
      touchOnGallery.current = !!target.closest("[data-gallery]");
      touchStartY.current = e.touches[0].clientY;
      touchStartX.current = e.touches[0].clientX;
    };
    const handleTouchEnd = (e: TouchEvent) => {
      if (zoomOpen || justClosedZoom.current) return;
      if (touchOnGallery.current) {
        touchStartY.current = null;
        touchStartX.current = null;
        touchOnGallery.current = false;
        return;
      }
      if (touchStartY.current === null || touchStartX.current === null) return;
      const deltaY = touchStartY.current - e.changedTouches[0].clientY;
      const deltaX = touchStartX.current - e.changedTouches[0].clientX;
      if (Math.abs(deltaY) > Math.abs(deltaX) && Math.abs(deltaY) > 60) {
        if (deltaY < 0) goToPrev(); else goToNext();
      }
      touchStartY.current = null;
      touchStartX.current = null;
    };
    window.addEventListener("wheel", handleWheel, { passive: false });
    window.addEventListener("touchstart", handleTouchStart, { passive: true });
    window.addEventListener("touchend", handleTouchEnd, { passive: true });
    return () => {
      window.removeEventListener("wheel", handleWheel);
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("touchend", handleTouchEnd);
    };
  }, [goToPrev, goToNext, zoomOpen]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      // FIX: Escape closes zoom; arrow keys are blocked while zoom is open
      if (e.key === "Escape") { setZoomOpen(false); return; }
      if (zoomOpen) return;
      if (e.key === "ArrowLeft" || e.key === "ArrowUp") goToPrev();
      if (e.key === "ArrowRight" || e.key === "ArrowDown") goToNext();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [goToPrev, goToNext, zoomOpen]);

  const variants: ProductVariant[] = useMemo(
    () => (Array.isArray(product?.variants) ? product!.variants! : []),
    [product?.variants],
  );

  // Gallery images come exclusively from the display-image pipeline: only good,
  // quality-gated, deduped, transparent product media (bad cutouts hidden,
  // opaque originals superseded so there are never look-alike duplicates,
  // primary first), falling back to raw image_urls when a product has no
  // processed media. The media rows arrive via the route LOADER, so this list
  // is final on first paint — no async reshuffle — and images[0] is the exact
  // URL the shop tile shows (seamless, cache-hit morph).
  const display = useMemo(
    () => computeDisplayImages(media, product?.image_urls, variants),
    [media, product?.image_urls, variants],
  );
  const displayImages = display.images;
  const displayUrlFor = useCallback(
    (sourceUrl?: string | null) => resolveDisplayUrl(display, sourceUrl),
    [display],
  );

  // Sentinel [""] means "no images" — the gallery renders a tasteful
  // placeholder rather than a broken/opaque image.
  const galleryImages = useMemo(
    () => (displayImages.length > 0 ? displayImages : [""]),
    [displayImages],
  );

  // Transparent PNGs (Printful mockups / background-removed uploads) float on
  // the page background. Untreated opaque vendor photos (CJ JPGs on a white or
  // colored studio backdrop) get a neutral white tile so they read as
  // deliberate product shots, consistent with the shop grid.
  const galleryFramed = useMemo(
    () => galleryImages.map((u) => !!u && !isLikelyTransparentImage(u)),
    [galleryImages],
  );

  const optionKeys = useMemo(
    () => sortOptionKeys(Array.from(new Set(variants.flatMap((v) => Object.keys(v.attributes ?? {}))))),
    [variants],
  );

  const optionValues = useMemo(() => {
    return optionKeys.reduce<Record<string, string[]>>((acc, key) => {
      acc[key] = Array.from(
        new Set(
          variants
            .map((v) => v.attributes?.[key])
            .filter((val): val is string => val != null && val !== ""),
        ),
      );
      return acc;
    }, {});
  }, [optionKeys, variants]);

  // Role for every option, derived from its VALUES (never its key name) so the
  // storefront renders correctly no matter how the importer labeled things.
  const optionRole = useMemo(() => {
    return optionKeys.reduce<Record<string, "size" | "color" | "style" | "hidden">>((acc, key) => {
      acc[key] = classifyOptionValues(optionValues[key] ?? []);
      return acc;
    }, {});
  }, [optionKeys, optionValues]);

  // Visible pickers: skip degenerate single-value/junk options, and always show
  // colour/style (the visual pick) before size.
  const visibleOptionKeys = useMemo(() => {
    const roleOrder: Record<string, number> = { color: 0, style: 1, size: 2, hidden: 9 };
    return optionKeys
      .filter((key) => optionRole[key] !== "hidden")
      .sort((a, b) => (roleOrder[optionRole[a]] ?? 5) - (roleOrder[optionRole[b]] ?? 5));
  }, [optionKeys, optionRole]);

  // The option whose values are true colours drives positional image mapping.
  const colorOptionKey = useMemo(
    () => optionKeys.find((k) => optionRole[k] === "color"),
    [optionKeys, optionRole],
  );

  // Map every option value to a representative variant image (for style swatches
  // and colours that carry per-variant imagery). First match wins.
  const valueImage = useMemo(() => {
    const map: Record<string, string> = {};
    for (const key of optionKeys) {
      for (const v of variants) {
        const val = v.attributes?.[key];
        if (val && v.image && !(`${key}::${val}` in map)) map[`${key}::${val}`] = v.image;
      }
    }
    return map;
  }, [optionKeys, variants]);
  const colorValues = useMemo(
    () => (colorOptionKey ? optionValues[colorOptionKey] ?? [] : []),
    [colorOptionKey, optionValues],
  );

  const [selection, setSelection] = useState<Record<string, string>>({});
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [optionsOpen, setOptionsOpen] = useState(false);

  // True only after the shopper actively picks a variant. Until then the
  // gallery stays on the primary product photo (index 0) instead of jumping
  // to whatever image the default-selected variant happens to carry.
  const userPickedVariant = useRef(false);

  // Keep the active slide in range as the async display-image list resolves or
  // shrinks (e.g. duplicates/bad cutouts get filtered out after first paint).
  useEffect(() => {
    setActiveImageIndex((i) => Math.min(i, Math.max(0, galleryImages.length - 1)));
  }, [galleryImages.length]);

  useEffect(() => {
    setActiveImageIndex(0);
    setOptionsOpen(false);
    setCurrentStep(null);
    setZoomOpen(false);
    userPickedVariant.current = false;
    navSettleUntil.current = Date.now() + 450;
  }, [product?.id]);

  useEffect(() => {
    if (!product || variants.length === 0) { setSelection({}); return; }
    const defaults: Record<string, string> = {};
    optionKeys.forEach((key) => {
      const firstValue = optionValues[key]?.[0];
      if (firstValue) defaults[key] = firstValue;
    });
    setSelection((current) => {
      const hasValidSelection = optionKeys.every((key) => current[key]);
      return hasValidSelection ? current : defaults;
    });
  }, [product?.id, optionKeys, optionValues, variants.length]);

  const selectedVariant = useMemo(() => {
    if (!variants.length) return undefined;
    return variants.find((v) => optionKeys.every((key) => v.attributes?.[key] === selection[key]));
  }, [variants, optionKeys, selection]);

  const isOptionAvailable = (option: string, value: string) => {
    if (variants.length === 0) return true;
    return variants.some((v) => {
      if (v.attributes?.[option] !== value) return false;
      if (v.stock != null && v.stock <= 0) return false;
      return optionKeys.every((key) => {
        if (key === option) return true;
        return !selection[key] || v.attributes?.[key] === selection[key];
      });
    });
  };

  const selectedPrice = selectedVariant?.price_cents ?? product?.price_cents;
  const checkoutDisabled = variants.length > 0 && !selectedVariant;
  const isSoldOut = selectedVariant?.stock != null && selectedVariant.stock <= 0;

  const hasVariants = variants.length > 0 && visibleOptionKeys.length > 0;

  // Vendor descriptions often arrive as HTML — render as clean plain text.
  const descriptionText = useMemo(() => {
    const raw = product?.description ?? "";
    const text = raw
      .replace(/<[^>]*>/g, " ")
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/\s+/g, " ")
      .trim();
    return text.length > 5 ? text : null;
  }, [product?.description]);

  // Jump the gallery to the slide representing a source image URL — resolved
  // through the display pipeline (a photo's cutout supersedes it), never by
  // positional guessing, so reordering rules can't break color→image jumps.
  const jumpGalleryToImage = useCallback((rawUrl?: string) => {
    const display = displayUrlFor(rawUrl);
    if (!display) return;
    const idx = galleryImages.indexOf(display);
    if (idx >= 0) setActiveImageIndex(idx);
  }, [galleryImages, displayUrlFor]);

  // ── Jump gallery to the image matching the selected color ─────────────────
  const jumpGalleryToColor = useCallback((colorValue: string) => {
    const variant = variants.find((v) =>
      colorOptionKey ? v.attributes?.[colorOptionKey] === colorValue : false,
    );
    jumpGalleryToImage(pickVariantImage(variant, product?.image_urls ?? [], colorValue, colorValues));
  }, [variants, colorOptionKey, colorValues, product?.image_urls, jumpGalleryToImage]);

  // For variant-image products (CJ), keep the gallery locked to whatever variant
  // is currently selected — colour OR size change lands on the exact image, so
  // the preview always matches what goes to cart.
  useEffect(() => {
    if (userPickedVariant.current && selectedVariant?.image) {
      jumpGalleryToImage(selectedVariant.image);
    }
  }, [selectedVariant, jumpGalleryToImage]);

  // Human-readable variant attributes for the cart/checkout, keyed by role so
  // "color"/"style" collapse to color and size stays size — regardless of the
  // vendor's original attribute key names.
  const variantMeta = useCallback((sel: Record<string, string>) => {
    const meta: { color?: string; size?: string } = {};
    for (const key of optionKeys) {
      const role = optionRole[key];
      const val = sel[key];
      if (!val || role === "hidden") continue;
      if (role === "size") meta.size = val;
      else if (!meta.color) meta.color = val;
    }
    return meta;
  }, [optionKeys, optionRole]);

  const commitToCart = useCallback(() => {
    if (!product) return;
    const variant = variants.find((v) =>
      optionKeys.every((key) => v.attributes?.[key] === selection[key])
    );
    try {
      addItem({
        productId: product.id,
        variantSku: variant?.sku,
        title: product.title,
        price_cents: selectedPrice ?? product.price_cents,
        image_url: proxyImageUrl(pickVariantImage(
          variant,
          product.image_urls ?? [],
          selection[colorOptionKey ?? ""] ?? selection["color"] ?? selection["colour"],
          colorValues,
        )),
        metadata: {
          ...variantMeta(selection),
          external_sku: variant?.external_sku,
          fulfillment_provider: variant?.fulfillment_provider || "printful",
        },
      });
      setAddedFeedback(true);
      setOptionsOpen(false);
      setCurrentStep(null);
      setTimeout(() => setAddedFeedback(false), 1200);
    } catch (e) {
      console.error("Cart Engine Critical Failure:", e);
    }
  }, [product, variants, optionKeys, selection, selectedPrice, colorOptionKey, colorValues, addItem, variantMeta]);

  const handleAddToCart = useCallback(() => {
    if (!product) return;
    if (isSoldOut) return;

    if (!hasVariants) {
      commitToCart();
      return;
    }

    if (!optionsOpen) {
      setOptionsOpen(true);
      setCurrentStep(0);
      return;
    }

    if (currentStep === null) {
      commitToCart();
    }
  }, [product, hasVariants, optionsOpen, currentStep, isSoldOut, commitToCart]);

  const imgTouchStartX = useRef<number | null>(null);
  const handleImgTouchStart = (e: React.TouchEvent) => { imgTouchStartX.current = e.touches[0].clientX; };
  const handleImgTouchEnd = (e: React.TouchEvent) => {
    if (imgTouchStartX.current === null) return;
    const delta = imgTouchStartX.current - e.changedTouches[0].clientX;
    if (Math.abs(delta) > 50) {
      if (delta > 0) setActiveImageIndex((i) => Math.min(i + 1, galleryImages.length - 1));
      else setActiveImageIndex((i) => Math.max(i - 1, 0));
    }
    imgTouchStartX.current = null;
  };

  const goPrevImage = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setActiveImageIndex((i) => Math.max(i - 1, 0));
  }, []);

  const goNextImage = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setActiveImageIndex((i) => Math.min(i + 1, galleryImages.length - 1));
  }, [galleryImages.length]);

  if (!product) {
    return (
      <section
        className="flex min-h-screen flex-col items-center justify-center bg-background text-foreground px-4"
        style={{ fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif" }}
      >
        <p className="text-[10px] font-bold uppercase tracking-[0.35em] opacity-40">404</p>
        <h1 className="mt-3 text-3xl font-black uppercase tracking-[-0.04em]">Offer Not Found</h1>
        <p className="mt-3 text-xs uppercase tracking-[0.2em] opacity-50">
          This product is unavailable.
        </p>
        <Link
          to="/shop"
          preload="intent"
          className="mt-8 inline-flex h-12 items-center border border-foreground bg-foreground text-background px-10 text-xs font-bold uppercase tracking-[0.25em] transition hover:bg-background hover:text-foreground"
        >
          Back to Shop
        </Link>
      </section>
    );
  }

  return (
    <>
      {prevProduct && <link rel="prefetch" href={`/offer/${prevProduct.slug}`} />}
      {nextProduct && <link rel="prefetch" href={`/offer/${nextProduct.slug}`} />}
      <style>{`
        @keyframes pdp-fade-in {
          from { opacity: 0; transform: translateY(4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes pdp-option-in {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes zoom-fade-in {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        .pdp-plus-btn:hover { opacity: 0.5; }
        .pdp-plus-btn:active { transform: scale(0.92); }
        .pdp-img-nav-btn { background: transparent; border: none; cursor: pointer; padding: 0.75rem 1rem; color: inherit; line-height: 1; transition: opacity 0.2s; font-family: inherit; }
        .pdp-edge-btn:hover:not(:disabled) { opacity: 1 !important; }
        .pdp-img-nav-btn:disabled { cursor: default; }
        .pdp-exit-btn:hover { opacity: 1 !important; }
        /* Same large chevrons on every viewport — they must never shrink. */
        @media (max-width: 640px) { .pdp-edge-btn { padding: 0.75rem 0.6rem; } }
        html, body { background-color: var(--background) !important; color: var(--foreground) !important; }
      `}</style>

      <div
        className="flex min-h-screen flex-col bg-background text-foreground"
        style={{ overflow: "hidden", zIndex: 0 }}
      >
        <div
          style={{
            position: "fixed", inset: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
            overflow: "hidden", zIndex: 0,
          }}
        >
          {/* ── Top-right: × exit back to the grid (Yeezy convention). Goes
                 BACK in history when the shopper came from the grid, so the
                 grid reopens at the same scroll position and the image morphs
                 into its tile. Guarded against ghost clicks during the
                 zoom-close cooldown. ── */}
          <button
            type="button"
            onClick={exitToShop}
            className="pdp-exit-btn"
            style={{
              position: "absolute", top: "0.9rem", right: "1rem", zIndex: 20,
              background: "transparent", border: "none", cursor: "pointer",
              color: "inherit", textDecoration: "none",
              fontSize: "34px", fontWeight: 200, lineHeight: 1,
              opacity: 0.65, display: "flex", alignItems: "center",
              padding: "0.5rem", transition: "opacity 0.2s",
              fontFamily: "inherit",
            }}
            aria-label="Close and return to shop"
          >
            ×
          </button>

          {/* ── Top-left: sold-out flag, or CART(n) once something's in the
                 bag (Yeezy convention) — the PDP is no longer a checkout
                 dead-end ── */}
          {isSoldOut ? (
            <div
              style={{
                position: "absolute", top: "1.35rem", left: "1.25rem", zIndex: 20,
                fontSize: "11px", fontWeight: 400, letterSpacing: "0.02em",
                color: "#c00",
              }}
            >
              SOLD OUT
            </div>
          ) : cartCount > 0 ? (
            <Link
              to="/checkout"
              preload="intent"
              style={{
                position: "absolute", top: "1.35rem", left: "1.25rem", zIndex: 20,
                fontSize: "11px", fontWeight: 400, letterSpacing: "0.06em",
                color: "inherit", textDecoration: "none", opacity: 0.75,
                padding: "0.35rem 0.4rem", margin: "-0.35rem -0.4rem",
              }}
              aria-label={`Cart with ${cartCount} item${cartCount === 1 ? "" : "s"}`}
            >
              CART({cartCount})
            </Link>
          ) : null}

          {/* ── Viewport-edge image arrows (Yeezy convention: thin chevrons
                 pinned to the screen edges, vertically centered) ── */}
          {galleryImages.length > 1 && (
            <>
              <button
                className="pdp-img-nav-btn pdp-edge-btn"
                onClick={goPrevImage}
                aria-label="Previous image"
                style={{
                  position: "absolute", left: "0.5rem", top: "50%",
                  transform: "translateY(-50%)", zIndex: 15,
                  // Big, thin, unmissable — matches the zoom overlay's arrows
                  // so the chrome reads identically everywhere.
                  fontSize: "44px", fontWeight: 100, opacity: 0.7,
                  // Yeezy convention: the arrow simply isn't there at the end
                  // of the gallery — no greyed-out disabled state.
                  visibility: activeImageIndex === 0 ? "hidden" : "visible",
                }}
              >
                ‹
              </button>
              <button
                className="pdp-img-nav-btn pdp-edge-btn"
                onClick={goNextImage}
                aria-label="Next image"
                style={{
                  position: "absolute", right: "0.5rem", top: "50%",
                  transform: "translateY(-50%)", zIndex: 15,
                  fontSize: "44px", fontWeight: 100, opacity: 0.7,
                  visibility: activeImageIndex === galleryImages.length - 1 ? "hidden" : "visible",
                }}
              >
                ›
              </button>
            </>
          )}

          {/* ── Center column. NOTE: no entry animation on this wrapper — the
                 gallery inside is the shared view-transition element, and any
                 ancestor opacity animation gets baked into its snapshot and
                 makes the product image flash during the morph. The text block
                 below fades on its own. ── */}
          <div
            style={{
              display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center",
              width: "100%", maxWidth: "480px",
              padding: "3.5rem 2rem 2rem", boxSizing: "border-box",
            }}
          >
            {/* ── Image gallery ── */}
            <div
              data-gallery
              style={{
                width: "100%", display: "flex",
                alignItems: "center", justifyContent: "center",
                gap: "0.5rem", marginBottom: "1.5rem",
              }}
              onTouchStart={handleImgTouchStart}
              onTouchEnd={handleImgTouchEnd}
            >
              <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <div style={{
                  position: "relative",
                  width: "min(320px, 70vw)",
                  height: "min(320px, 45vh)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}>
                  {galleryImages[0] !== "" ? (
                    galleryImages.map((imgUrl, idx) => (
                      <GalleryImg
                        key={imgUrl}
                        src={imgUrl}
                        framed={galleryFramed[idx]}
                        isActive={idx === activeImageIndex}
                        alt={`${product.title} — image ${idx + 1}`}
                        onClick={() => setZoomOpen(true)}
                        sharedName={`product-media-${product.id}`}
                      />
                    ))
                  ) : (
                    <div style={{
                      width: "100%", height: "100%",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      border: "1px solid var(--border)",
                      fontSize: "9px", fontWeight: 500, letterSpacing: "0.3em",
                      textTransform: "uppercase", opacity: 0.3,
                    }}>
                      IMAGE PENDING
                    </div>
                  )}
                </div>
              </div>

            </div>

            {/* Image dots */}
            {galleryImages.length > 1 && (
              <div style={{ display: "flex", gap: "6px", marginBottom: "1.5rem" }}>
                {galleryImages.map((_, i) => (
                  <button key={i} onClick={() => setActiveImageIndex(i)} aria-label={`Image ${i + 1}`}
                    style={{
                      width: "6px", height: "6px", borderRadius: "50%",
                      background: "var(--foreground)",
                      opacity: i === activeImageIndex ? 0.8 : 0.2,
                      border: "none", cursor: "pointer", padding: 0,
                      transition: "opacity 0.2s ease",
                    }}
                  />
                ))}
              </div>
            )}

            {/* ── Info block: fades in per product (the gallery above does
                   NOT — it must stay snapshot-clean for the morph) ── */}
            <div
              key={product.slug}
              style={{
                width: "100%", display: "flex", flexDirection: "column",
                alignItems: "center",
                animation: "pdp-fade-in 0.15s linear both",
              }}
            >
            {/* Title */}
            <div style={{
              fontSize: "clamp(0.85rem, 2vw, 1rem)", fontWeight: 400,
              letterSpacing: "0.02em", color: "var(--foreground)",
              textAlign: "center", marginBottom: "0.4rem", opacity: 0.9,
            }}>
              {product.title}
            </div>

            {/* Price */}
            <div style={{
              fontSize: "clamp(0.85rem, 2vw, 1rem)", fontWeight: 400,
              letterSpacing: "0.02em", color: "var(--foreground)",
              textAlign: "center", marginBottom: "1.5rem", opacity: 0.9,
            }}>
              {formatPrice(selectedPrice)}
            </div>

            {/* ── CTA ZONE ── */}
            {isSoldOut ? (
              <div style={{
                fontSize: "10px", fontWeight: 500, letterSpacing: "0.2em",
                textTransform: "uppercase", opacity: 0.35, color: "var(--foreground)",
              }}>
                SOLD OUT
              </div>

            ) : !hasVariants ? (
              <button
                onClick={handleAddToCart}
                className="pdp-plus-btn"
                aria-label="Add to cart"
                style={{
                  background: "transparent", border: "none",
                  cursor: "pointer", color: "var(--foreground)",
                  fontSize: addedFeedback ? "10px" : "28px",
                  fontWeight: 200, lineHeight: 1, opacity: 0.8,
                  transition: "opacity 0.2s, transform 0.15s, font-size 0.15s",
                  letterSpacing: addedFeedback ? "0.2em" : "0",
                  textTransform: "uppercase", padding: "0.25rem",
                  fontFamily: "inherit",
                }}
              >
                {addedFeedback ? "ADDED" : "+"}
              </button>

            ) : (
              <div style={{
                display: "flex", flexDirection: "column",
                alignItems: "center", width: "100%",
                animation: "pdp-fade-in 0.15s linear both",
              }}>
                {!optionsOpen ? (
                  <button
                    onClick={handleAddToCart}
                    className="pdp-plus-btn"
                    aria-label="Choose options"
                    style={{
                      background: "transparent", border: "none",
                      cursor: "pointer", color: "var(--foreground)",
                      fontSize: "28px", fontWeight: 200, lineHeight: 1,
                      opacity: 0.8, transition: "opacity 0.2s, transform 0.15s",
                      padding: "0.25rem", fontFamily: "inherit",
                    }}
                  >
                    +
                  </button>

                ) : addedFeedback ? (
                  <div style={{
                    fontSize: "10px", fontWeight: 500,
                    letterSpacing: "0.2em", textTransform: "uppercase",
                    color: "var(--foreground)", opacity: 0.8,
                    animation: "pdp-fade-in 0.15s linear both",
                    fontFamily: "inherit",
                  }}>
                    ADDED
                  </div>

                ) : (
                  <div style={{
                    width: "100%", display: "flex", flexDirection: "column",
                    alignItems: "center", gap: "1rem",
                    animation: "pdp-option-in 0.15s linear both",
                  }}>
                    {visibleOptionKeys.map((option, idx) => {
                      if (idx !== currentStep && currentStep !== null) return null;
                      if (currentStep === null) return null;

                      const role = optionRole[option];
                      const isSize = role === "size";
                      const optionLabel = role === "size" ? "SIZE" : role === "style" ? "STYLE" : "COLOR";
                      const isLast = idx === visibleOptionKeys.length - 1;

                      return (
                        <div key={option} style={{
                          display: "flex", flexDirection: "column",
                          alignItems: "center", gap: "0.5rem", width: "100%",
                        }}>
                          <div style={{
                            fontSize: "9px", fontWeight: 500,
                            letterSpacing: "0.2em", textTransform: "uppercase",
                            opacity: 0.45, color: "var(--foreground)",
                            fontFamily: "inherit",
                          }}>
                            {optionLabel}
                          </div>

                          <div style={{
                            display: "flex", flexWrap: "wrap",
                            gap: isSize ? "0.4rem" : "0.6rem",
                            justifyContent: "center", alignItems: "center",
                            maxWidth: "320px",
                          }}>
                            {optionValues[option]?.map((value) => {
                              const selected = selection[option] === value;
                              const available = isOptionAvailable(option, value);
                              // Non-size swatches are circles: a real color fill
                              // when the value resolves to a color, otherwise the
                              // variant's own photo (style codes like "1Style").
                              const hex = isSize ? null : tryResolveColor(value);
                              const swatchImg = valueImage[`${option}::${value}`];
                              const useImageSwatch = !isSize && !hex && !!swatchImg;

                              const handleChipClick = () => {
                                userPickedVariant.current = true;
                                setSelection((cur) => ({ ...cur, [option]: value }));

                                // Jump gallery to matching color image immediately
                                if (role === "color") jumpGalleryToColor(value);

                                if (!isLast) {
                                  setCurrentStep(idx + 1);
                                } else {
                                  const updatedSelection = { ...selection, [option]: value };
                                  const variant = variants.find((v) =>
                                    optionKeys.every((k) => v.attributes?.[k] === updatedSelection[k])
                                  );
                                  try {
                                    addItem({
                                      productId: product.id,
                                      variantSku: variant?.sku,
                                      title: product.title,
                                      price_cents: variant?.price_cents ?? selectedPrice ?? product.price_cents,
                                      image_url: proxyImageUrl(pickVariantImage(
                                        variant,
                                        product.image_urls ?? [],
                                        updatedSelection[colorOptionKey ?? ""] ?? updatedSelection["color"] ?? updatedSelection["colour"],
                                        colorValues,
                                      )),
                                      metadata: {
                                        ...variantMeta(updatedSelection),
                                        external_sku: variant?.external_sku,
                                        fulfillment_provider: variant?.fulfillment_provider || "printful",
                                      },
                                    });
                                    setCurrentStep(null);
                                    setAddedFeedback(true);
                                    setTimeout(() => {
                                      setAddedFeedback(false);
                                      setOptionsOpen(false);
                                    }, 1200);
                                  } catch (e) {
                                    console.error("Cart Engine Critical Failure:", e);
                                  }
                                }
                              };

                              if (!isSize) {
                                return (
                                  <button
                                    key={value}
                                    type="button"
                                    onClick={handleChipClick}
                                    disabled={!available}
                                    aria-label={value}
                                    aria-pressed={selected}
                                    title={value}
                                    style={{
                                      display: "inline-block",
                                      boxSizing: "border-box",
                                      width: "26px", height: "26px",
                                      aspectRatio: "1 / 1",
                                      borderRadius: "9999px",
                                      overflow: "hidden",
                                      background: useImageSwatch
                                        ? `center/cover no-repeat url(${proxyImageUrl(swatchImg!)})`
                                        : (hex ?? "#888"),
                                      outline: selected
                                        ? "2px solid var(--foreground)"
                                        : "2px solid transparent",
                                      outlineOffset: "3px",
                                      border: "1.5px solid color-mix(in srgb, var(--foreground) 25%, transparent)",
                                      cursor: available ? "pointer" : "not-allowed",
                                      opacity: available ? 1 : 0.25,
                                      transition: "outline 0.15s ease, opacity 0.15s ease",
                                      padding: 0, flexShrink: 0,
                                      WebkitAppearance: "none", appearance: "none",
                                    }}
                                  />
                                );
                              }

                              return (
                                <button
                                  key={value}
                                  type="button"
                                  onClick={handleChipClick}
                                  disabled={!available}
                                  aria-pressed={selected}
                                  style={{
                                    minHeight: "2rem", minWidth: "2.5rem",
                                    padding: "0 0.5rem", border: "none",
                                    background: "transparent", color: "var(--foreground)",
                                    fontSize: "9px", fontWeight: selected ? 700 : 400,
                                    letterSpacing: "0.12em", textTransform: "uppercase",
                                    cursor: available ? "pointer" : "not-allowed",
                                    opacity: available ? (selected ? 1 : 0.55) : 0.2,
                                    transition: "all 0.15s ease", fontFamily: "inherit",
                                    textDecoration: "none",
                                  }}
                                >
                                  {value}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}

                    {currentStep === null && (
                      <button
                        onClick={commitToCart}
                        className="pdp-plus-btn"
                        style={{
                          background: "transparent", border: "none",
                          cursor: "pointer", color: "var(--foreground)",
                          fontSize: "10px", fontWeight: 500,
                          letterSpacing: "0.2em", textTransform: "uppercase",
                          opacity: 0.8, fontFamily: "inherit",
                          animation: "pdp-fade-in 0.15s linear both",
                        }}
                      >
                        ADD TO CART
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ── Trust line: quiet chrome at the moment of decision ── */}
            <div style={{
              marginTop: "1.6rem", fontSize: "9px", fontWeight: 500,
              letterSpacing: "0.18em", textTransform: "uppercase",
              opacity: 0.45, color: "var(--foreground)", textAlign: "center",
            }}>
              SECURE CHECKOUT ·{" "}
              <Link
                to="/refund"
                preload="intent"
                style={{ color: "inherit", textDecoration: "none" }}
              >
                30-DAY RETURNS
              </Link>
            </div>

            {/* ── Short description (plain text, clamped) ── */}
            {descriptionText && (
              <p style={{
                marginTop: "0.9rem", maxWidth: "340px",
                fontSize: "10px", lineHeight: 1.7, letterSpacing: "0.04em",
                opacity: 0.55, color: "var(--foreground)", textAlign: "center",
                display: "-webkit-box", WebkitLineClamp: 3,
                WebkitBoxOrient: "vertical", overflow: "hidden",
              }}>
                {descriptionText}
              </p>
            )}
            </div>
          </div>

          {/* ── Counter ── */}
          {allProducts.length > 1 && (
            <div style={{
              position: "absolute", bottom: "1.25rem", right: "1.5rem",
              fontSize: "9px", fontWeight: 400, letterSpacing: "0.15em",
              color: "var(--foreground)", opacity: 0.3, fontFamily: "inherit",
            }}>
              {String(currentIndex + 1).padStart(2, "0")} / {String(allProducts.length).padStart(2, "0")}
            </div>
          )}
        </div>
      </div>

      {zoomOpen && galleryImages[activeImageIndex] && (
        <div
          style={{
            position: "fixed", inset: 0, zIndex: 200,
            background: "rgba(0,0,0,0.92)",
            display: "flex", alignItems: "center", justifyContent: "center",
            animation: "zoom-fade-in 0.15s linear both",
            touchAction: "none",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "min(92vw, 900px)",
              height: "90vh",
              cursor: "default",
            }}
          >
            <ZoomPanImage
              src={galleryImages[activeImageIndex]}
              alt={`${product.title} — zoomed`}
            />
          </div>

          <button
            onClick={(e) => { e.stopPropagation(); setZoomOpen(false); }}
            aria-label="Close zoom"
            style={{
              position: "absolute", top: "1.25rem", right: "1.25rem",
              background: "transparent", border: "none",
              color: "#fff", fontSize: "34px", fontWeight: 200,
              lineHeight: 1, cursor: "pointer", opacity: 0.75,
              fontFamily: "inherit",
            }}
          >
            ×
          </button>

          {activeImageIndex > 0 && (
            <button
              onClick={(e) => { e.stopPropagation(); setActiveImageIndex(i => i - 1); }}
              aria-label="Previous image"
              style={{
                position: "absolute", left: "1rem", top: "50%", transform: "translateY(-50%)",
                background: "transparent", border: "none", color: "#fff",
                fontSize: "48px", fontWeight: 200, lineHeight: 1,
                cursor: "pointer", opacity: 0.75, fontFamily: "inherit",
              }}
            >‹</button>
          )}

          {activeImageIndex < galleryImages.length - 1 && (
            <button
              onClick={(e) => { e.stopPropagation(); setActiveImageIndex(i => i + 1); }}
              aria-label="Next image"
              style={{
                position: "absolute", right: "1rem", top: "50%", transform: "translateY(-50%)",
                background: "transparent", border: "none", color: "#fff",
                fontSize: "48px", fontWeight: 200, lineHeight: 1,
                cursor: "pointer", opacity: 0.75, fontFamily: "inherit",
              }}
            >›</button>
          )}
        </div>
      )}
    </>
  );
}
