import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { fetchProducts } from "@/lib/useProducts";
import { offer } from "@/config/site";
import { useCart } from "@/context/CartContext";
import { ZoomPanImage } from "@/components/site/ZoomPanImage";

// ─── Types ────────────────────────────────────────────────────────────────────

type ProductVariant = {
  sku: string;
  stock?: number;
  price_cents?: number;
  external_sku?: string;
  fulfillment_provider?: string;
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
    return {
      product: productResult.data ?? null,
      allProducts: allProducts ?? [],
    };
  },
  head: ({ loaderData }: any) => {
    const product = loaderData?.product;
    const title = product ? formatTitle(product.slug) : offer.name;
    const description = product?.description ?? offer.shortPitch;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
      ],
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
  const priority = ["size", "color", "colour"];
  return [...keys].sort((a, b) => {
    const ai = priority.indexOf(a.toLowerCase());
    const bi = priority.indexOf(b.toLowerCase());
    if (ai !== -1 || bi !== -1) return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    return a.localeCompare(b);
  });
}

function formatPrice(cents?: number | null) {
  if (cents == null) return "PRICE PENDING";
  return `$${(cents / 100).toFixed(2)}`;
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

// ─── Color Resolution Utility ────────────────────────────────────────────────

const _colorCache: Record<string, string> = {};

// Map remains constant; added explicit typing for clarity
const _colorMap: Record<string, string> = {
  white: "#ffffff", "off-white": "#f8f5f0", "off white": "#f8f5f0",
  black: "#111111", "jet black": "#0a0a0a", "vintage black": "#2a2a2a",
  charcoal: "#4a5568", gray: "#808080", grey: "#808080",
  blue: "#3182ce", navy: "#001f5b",
  green: "#38a169", forest: "#228b22",
  red: "#e53e3e", maroon: "#800000",
  pink: "#ed64a6", orange: "#ed8936",
  yellow: "#ecc94b", gold: "#d69e2e",
  purple: "#9f7aea", brown: "#a0522d",

  // Explicit garment color names — these follow a "{qualifier} {basecolor}"
  // pattern where the qualifier (heather/ice/carolina/stone/brick/etc.) is
  // neither a real CSS color nor a shading modifier, so the canvas check and
  // heuristic below both miss them. Mapped directly against every color name
  // actually present in the catalog rather than guessed at.
  agave: "#a7ab93",
  anthracite: "#33363a",
  ash: "#c7c8c6",
  "bio white": "#f5f5f0",
  birch: "#d7ccc0",
  bone: "#e3dac9",
  "brick red": "#a03c34",
  "carolina blue": "#7bafd4",
  cranberry: "#8c1f3b",
  "dark chocolate": "#3b2313",
  "dark green": "#1e4620",
  "dark grey": "#4a4a4a",
  "desert dust": "#c9a98d",
  "desert pink": "#d8a398",
  "green camo": "#5d6b3f",
  "heather charcoal": "#4b4b4d",
  "heather grey": "#a9a9ab",
  "heather royal": "#3f5fa0",
  heliconia: "#e0218a",
  "ice grey": "#d6d6d8",
  "jade dome": "#2e8b83",
  khaki: "#c3b091",
  "light blue": "#add8e6",
  "light pink": "#ffb6c1",
  mineral: "#7b8b8e",
  natural: "#ede6d6",
  "petrol blue": "#1f4e5f",
  sand: "#c2b280",
  "slate blue": "#647a8d",
  spruce: "#1f3a2e",
  stone: "#a79e8e",
  "stone grey": "#8f8a82",
  "vintage gold": "#c9a227",
  "vintage white": "#f0ead6",
};

/**
 * Uses browser canvas to validate if a string is a valid CSS color.
 */
function _canvasColor(name: string): string | null {
  if (typeof document === 'undefined') return null; // SSR safety
  try {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 1;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.fillStyle = "#010101";
    ctx.fillStyle = name;
    return ctx.fillStyle !== "#010101" ? ctx.fillStyle : null;
  } catch { return null; }
}

/**
 * Resolves any string to a Hex CSS color code.
 * Includes fallback logic for complex names and color shifting.
 */
export function resolveColor(value: string): string {
  const key = value.toLowerCase().trim();
  if (_colorCache[key]) return _colorCache[key];

  // 1. Direct Map
  if (_colorMap[key]) return (_colorCache[key] = _colorMap[key]);

  // 2. Already a valid CSS color (Hex/RGB/HSL)
  if (/^#([0-9a-f]{3,8})$/i.test(key) || /^rgba?\(|^hsla?\(/i.test(key)) {
    return (_colorCache[key] = key);
  }

  // 3. Browser Canvas Check
  const canvasCheck = _canvasColor(key);
  if (canvasCheck) return (_colorCache[key] = canvasCheck);

  // 4. Heuristic Modifier Logic
  const words = key.split(/[\s_\-\/]+/).filter(Boolean);
  if (words.length > 1) {
    const modifiers: Record<string, number> = {
      light: 60, pale: 70, soft: 50, bright: 30, neon: 40,
      dark: -60, deep: -70, vintage: -20, faded: 40, washed: 35
    };

    let shift = 0;
    const nonModifierWords: string[] = [];

    for (const word of words) {
      if (modifiers[word] !== undefined) shift += modifiers[word];
      else nonModifierWords.push(word);
    }

    // Garment color names are usually "{qualifier} {basecolor}" (Ice Grey,
    // Carolina Blue, Brick Red) — the LAST non-modifier word is the true
    // color family more often than the first (Green Camo is the exception,
    // so first-word is tried as a secondary fallback).
    const candidates = [
      nonModifierWords[nonModifierWords.length - 1],
      nonModifierWords[0],
    ].filter(Boolean);

    for (const baseWord of candidates) {
      const baseHex = _colorMap[baseWord] ?? _canvasColor(baseWord);
      if (baseHex && /^#[0-9a-f]{6}$/i.test(baseHex)) {
        const r = Math.max(0, Math.min(255, parseInt(baseHex.slice(1, 3), 16) + shift));
        const g = Math.max(0, Math.min(255, parseInt(baseHex.slice(3, 5), 16) + shift));
        const b = Math.max(0, Math.min(255, parseInt(baseHex.slice(5, 7), 16) + shift));
        const adjusted = `#${[r, g, b].map(v => v.toString(16).padStart(2, "0")).join("")}`;
        return (_colorCache[key] = adjusted);
      }
    }
  }

  return (_colorCache[key] = "#888888"); // Default fallback
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

// ─── Main Page Component ──────────────────────────────────────────────────────

function OfferSlugPage() {
  const { product, allProducts } = Route.useLoaderData() as {
    product: Product | null;
    allProducts: Product[];
  };
  const navigate = useNavigate();

  const { addItem } = useCart();
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

  const goToPrev = useCallback(() => {
    if (navigateCooldown.current || !prevProduct) return;
    navigateCooldown.current = true;
    navigate({ to: "/offer/$slug", params: { slug: prevProduct.slug } });
    setTimeout(() => { navigateCooldown.current = false; }, 500);
  }, [prevProduct, navigate]);

  const goToNext = useCallback(() => {
    if (navigateCooldown.current || !nextProduct) return;
    navigateCooldown.current = true;
    navigate({ to: "/offer/$slug", params: { slug: nextProduct.slug } });
    setTimeout(() => { navigateCooldown.current = false; }, 500);
  }, [nextProduct, navigate]);

  useEffect(() => {
    if (!product || allProducts.length === 0) return;

    [prevProduct, nextProduct].forEach((p) => {
      if (p?.image_urls?.[0]) {
        const link = document.createElement("link");
        link.rel = "preload";
        link.as = "image";
        link.href = proxyImageUrl(p.image_urls[0]);
        document.head.appendChild(link);
      }
    });

    [prevProduct, nextProduct].forEach((p) => {
      if (p) {
        const link = document.createElement("link");
        link.rel = "prefetch";
        link.href = `/offer/${p.slug}`;
        link.as = "document";
        document.head.appendChild(link);
      }
    });
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
      if (zoomOpen || justClosedZoom.current) return;
      const target = e.target as HTMLElement;
      if (target.closest("[data-gallery]")) return;
      if (Math.abs(e.deltaY) < 30) return;
      e.preventDefault();
      if (e.deltaY < 0) goToPrev(); else goToNext();
    };
    const handleTouchStart = (e: TouchEvent) => {
      if (zoomOpen || justClosedZoom.current) return;
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

  // Gallery: skip image_urls[0] (always the logo/design mockup), show all others.
  // Proxy each URL through wsrv.nl to eliminate Printful CDN CORS blocks.
  const galleryImages = useMemo(() => {
    if (!Array.isArray(product?.image_urls)) return [""];
    const all = product!.image_urls.filter(Boolean);
    const withoutLogo = all.length > 1 ? all.slice(1) : all;
    const proxied = withoutLogo.map(proxyImageUrl);
    return proxied.length > 0 ? proxied : [""];
  }, [product?.image_urls]);

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

  const visibleOptionKeys = useMemo(
    () => optionKeys.filter((key) => (optionValues[key]?.length ?? 0) > 1),
    [optionKeys, optionValues],
  );

  // Derived color option key and ordered color values (matches Printful image order)
  const colorOptionKey = useMemo(
    () => optionKeys.find((k) => isColorOption(k)),
    [optionKeys],
  );
  const colorValues = useMemo(
    () => (colorOptionKey ? optionValues[colorOptionKey] ?? [] : []),
    [colorOptionKey, optionValues],
  );

  const [selection, setSelection] = useState<Record<string, string>>({});
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [optionsOpen, setOptionsOpen] = useState(false);

  useEffect(() => {
    setActiveImageIndex(0);
    setOptionsOpen(false);
    setCurrentStep(null);
    setZoomOpen(false);
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

  // ── Jump gallery to the image matching the selected color ─────────────────
  // colorIndex 0 → galleryImages[0] (which is image_urls[1]), etc.
  const jumpGalleryToColor = useCallback((colorValue: string) => {
    if (!colorOptionKey || colorValues.length === 0) return;
    const colorIndex = colorValues.indexOf(colorValue);
    if (colorIndex === -1) return;
    // galleryImages already has logo stripped, so colorIndex maps directly
    const target = Math.min(colorIndex, galleryImages.length - 1);
    setActiveImageIndex(target);
  }, [colorOptionKey, colorValues, galleryImages.length]);

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
        image_url: proxyImageUrl(resolveVariantImage(
          product.image_urls ?? [],
          selection[colorOptionKey ?? ""] ?? selection["color"] ?? selection["colour"],
          colorValues,
        )),
        metadata: {
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
  }, [product, variants, optionKeys, selection, selectedPrice, colorOptionKey, colorValues, addItem]);

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
      {prevProduct && <link rel="prefetch" href={`/offer/${prevProduct.slug}`} as="document" />}
      {nextProduct && <link rel="prefetch" href={`/offer/${nextProduct.slug}`} as="document" />}
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
        .pdp-img-nav-btn { background: transparent; border: none; cursor: pointer; padding: 0.75rem 1.25rem; color: inherit; line-height: 1; transition: opacity 0.2s; font-family: inherit; }
        .pdp-img-nav-btn:hover { opacity: 0.4; }
        .pdp-img-nav-btn:disabled { opacity: 0.12; cursor: default; }
        @media (max-width: 640px) { .pdp-img-nav-btn { font-size: 44px !important; padding: 0.5rem 0.875rem; } }
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
          {/* ── Top-left: back arrow (guarded against ghost clicks during zoom cooldown) ── */}
          <Link
            to="/shop"
            preload="intent"
            onClick={(e) => {
              if (justClosedZoom.current) {
                e.preventDefault();
              }
            }}
            style={{
              position: "absolute", top: "1.25rem", left: "1.25rem", zIndex: 20,
              color: "inherit", textDecoration: "none",
              fontSize: "38px", fontWeight: 200, lineHeight: 1,
              opacity: 0.7, display: "flex", alignItems: "center",
            }}
            aria-label="Back to shop"
          >
            ‹
          </Link>

          {/* ── Top-right: sold out status ── */}
          <div
            style={{
              position: "absolute", top: "1.25rem", right: "1.25rem", zIndex: 20,
              fontSize: "11px", fontWeight: 400, letterSpacing: "0.02em",
              color: isSoldOut ? "#c00" : "inherit",
              opacity: isSoldOut ? 1 : 0.5,
            }}
          >
            {isSoldOut ? "SOLD OUT" : ""}
          </div>

          {/* ── Center column ── */}
          <div
            style={{
              display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center",
              width: "100%", maxWidth: "480px",
              padding: "3.5rem 2rem 2rem", boxSizing: "border-box",
              animation: "pdp-fade-in 0.15s linear both",
            }}
            key={product.slug}
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
              <button className="pdp-img-nav-btn" onClick={goPrevImage} disabled={activeImageIndex === 0} aria-label="Previous image"
                style={{ fontSize: "38px", fontWeight: 200, opacity: activeImageIndex === 0 ? 0.12 : 0.75 }}>
                ‹
              </button>

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
                    galleryImages.map((imgUrl, idx) => {
                      const isActive = idx === activeImageIndex;
                      return (
                        <img
                          key={imgUrl}
                          src={imgUrl}
                          alt={`${product.title} — image ${idx + 1}`}
                          loading="eager"
                          onClick={() => setZoomOpen(true)}
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
                          }}
                        />
                      );
                    })
                  ) : (
                    <div style={{
                      width: "100%", height: "100%",
                      display: "flex", alignItems: "center", justify_content: "center",
                      border: "1px solid var(--border)",
                      fontSize: "9px", fontWeight: 500, letterSpacing: "0.3em",
                      textTransform: "uppercase", opacity: 0.3,
                    }}>
                      IMAGE PENDING
                    </div>
                  )}
                </div>
              </div>

              <button className="pdp-img-nav-btn" onClick={goNextImage} disabled={activeImageIndex === galleryImages.length - 1} aria-label="Next image"
                style={{ fontSize: "38px", fontWeight: 200, opacity: activeImageIndex === galleryImages.length - 1 ? 0.15 : 0.75 }}>
                ›
              </button>
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

                      const isColor = isColorOption(option);
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
                            {normalizeOptionName(option)}
                          </div>

                          <div style={{
                            display: "flex", flexWrap: "wrap",
                            gap: "0.5rem", justifyContent: "center",
                          }}>
                            {optionValues[option]?.map((value) => {
                              const selected = selection[option] === value;
                              const available = isOptionAvailable(option, value);
                              const colorHex = isColor ? resolveColor(value) : null;

                              const handleChipClick = () => {
                                setSelection((cur) => ({ ...cur, [option]: value }));

                                // Jump gallery to matching color image immediately
                                if (isColor) jumpGalleryToColor(value);

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
                                      image_url: proxyImageUrl(resolveVariantImage(
                                        product.image_urls ?? [],
                                        updatedSelection[colorOptionKey ?? ""] ?? updatedSelection["color"] ?? updatedSelection["colour"],
                                        colorValues,
                                      )),
                                      metadata: {
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

                              if (isColor) {
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
                                      width: "24px", height: "24px",
                                      borderRadius: "50%",
                                      background: colorHex ?? "#888",
                                      outline: selected
                                        ? "2px solid var(--foreground)"
                                        : "2px solid transparent",
                                      outlineOffset: "3px",
                                      border: "1.5px solid color-mix(in srgb, var(--foreground) 20%, transparent)",
                                      cursor: available ? "pointer" : "not-allowed",
                                      opacity: available ? 1 : 0.25,
                                      transition: "outline 0.15s ease, opacity 0.15s ease",
                                      padding: 0, flexShrink: 0,
                                      WebkitAppearance: "none",
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
                                    textDecoration: selected ? "underline" : "none",
                                    textUnderlineOffset: "3px",
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
              color: "#fff", fontSize: "32px", fontWeight: 200,
              lineHeight: 1, cursor: "pointer", opacity: 0.7,
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
                cursor: "pointer", opacity: 0.6, fontFamily: "inherit",
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
                cursor: "pointer", opacity: 0.6, fontFamily: "inherit",
              }}
            >›</button>
          )}
        </div>
      )}
    </>
  );
}
