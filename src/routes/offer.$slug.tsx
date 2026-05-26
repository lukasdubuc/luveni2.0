import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { fetchProducts } from "@/lib/useProducts";
import { offer } from "@/config/site";
import { useCart } from "@/context/CartContext";

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
      supabase
        .from("products")
        .select("*")
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

// ─── Resolve any Printful color string to a CSS color ────────────────────────
// Handles: exact names, compound names ("light blue", "green camo"),
// raw hex/rgb/hsl, CSS keywords, and unknown fallbacks.
// Always returns a string — color swatches are always circles, never text.
const _colorCache: Record<string, string> = {};

// Full lookup: exact multi-word Printful names first, then single-word tokens.
// Compound names must come before their constituent words are checked.
const _colorMap: Record<string, string> = {
  // ── Multi-word compound names (Printful-specific) ──────────────────────
  "black heather":      "#3a3a3a",
  "dark heather":       "#404040",
  "heather gray":       "#b0a8a0",
  "heather grey":       "#b0a8a0",
  "heather blue":       "#7b9eb5",
  "heather red":        "#b55a5a",
  "heather green":      "#6a8f6a",
  "heather orange":     "#c87941",
  "sport grey":         "#c0bbb4",
  "light blue":         "#add8e6",
  "light pink":         "#ffb6c1",
  "light yellow":       "#ffffe0",
  "light green":        "#90ee90",
  "light gray":         "#d3d3d3",
  "light grey":         "#d3d3d3",
  "light purple":       "#dda0dd",
  "dark blue":          "#00008b",
  "dark green":         "#006400",
  "dark gray":          "#a9a9a9",
  "dark grey":          "#a9a9a9",
  "dark red":           "#8b0000",
  "dark navy":          "#000080",
  "dark brown":         "#5c3317",
  "dark chocolate":     "#3d1c02",
  "royal blue":         "#4169e1",
  "sky blue":           "#87ceeb",
  "baby blue":          "#89cff0",
  "powder blue":        "#b0e0e6",
  "steel blue":         "#4682b4",
  "slate blue":         "#6a5acd",
  "navy blue":          "#001f5b",
  "midnight blue":      "#191970",
  "cornflower blue":    "#6495ed",
  "forest green":       "#228b22",
  "hunter green":       "#355e3b",
  "olive green":        "#708238",
  "kelly green":        "#4cbb17",
  "mint green":         "#98ff98",
  "sage green":         "#8fbc8f",
  "army green":         "#4b5320",
  "military green":     "#4a5240",
  "green camo":         "#4b5320",
  "brown camo":         "#6b4c11",
  "desert camo":        "#c2a366",
  "camo green":         "#4b5320",
  "hot pink":           "#ff69b4",
  "deep pink":          "#ff1493",
  "dusty pink":         "#d9a8a0",
  "dusty rose":         "#dcb4b4",
  "dusty blue":         "#7b9eb5",
  "dusty purple":       "#a68eb5",
  "pale pink":          "#ffd1dc",
  "rose gold":          "#b76e79",
  "burnt orange":       "#cc5500",
  "dark orange":        "#ff8c00",
  "neon orange":        "#ff6700",
  "neon green":         "#39ff14",
  "neon yellow":        "#ffff00",
  "neon pink":          "#ff6ec7",
  "neon blue":          "#1b03a3",
  "electric blue":      "#7df9ff",
  "electric green":     "#00ff00",
  "deep purple":        "#673ab7",
  "dark purple":        "#4b0082",
  "light purple":       "#dda0dd",
  "true red":           "#cc0000",
  "cardinal red":       "#c41e3a",
  "brick red":          "#cb4154",
  "wine red":           "#722f37",
  "dark maroon":        "#5c0000",
  "off white":          "#faf9f6",
  "natural white":      "#fdf5e6",
  "vintage white":      "#f5f0e8",
  "soft cream":         "#fff5e4",
  "antique white":      "#faebd7",
  "ash grey":           "#b2beb5",
  "ash gray":           "#b2beb5",
  "storm gray":         "#7f8c8d",
  "storm grey":         "#7f8c8d",
  "cool gray":          "#8d9091",
  "cool grey":          "#8d9091",
  "warm gray":          "#9f9389",
  "warm grey":          "#9f9389",
  "dark charcoal":      "#333333",
  "light charcoal":     "#666666",
  "tan brown":          "#b5651d",
  "sandy brown":        "#f4a460",
  "golden yellow":      "#ffc200",
  "butter yellow":      "#fff1a8",
  "banana yellow":      "#ffe135",
  "denim blue":         "#1560bd",
  "washed blue":        "#7e9bb5",
  "faded black":        "#3a3a3a",
  "vintage black":      "#2c2c2c",
  "cotton candy":       "#ffbcd9",
  "tie dye":            "#9b59b6",
  // ── Single-word non-CSS vendor names ──────────────────────────────────
  charcoal:    "#4a5568",
  sand:        "#c2b280",
  rust:        "#b7410e",
  cobalt:      "#0047ab",
  cream:       "#fffdd0",
  ivory:       "#fffff0",
  khaki:       "#c3b091",
  navy:        "#001f5b",
  mint:        "#98ff98",
  jade:        "#00a86b",
  emerald:     "#50c878",
  ruby:        "#9b111e",
  sapphire:    "#0f52ba",
  rose:        "#ff007f",
  lemon:       "#fff44f",
  lavender:    "#e6e6fa",
  lilac:       "#c8a2c8",
  champagne:   "#f7e7ce",
  blush:       "#de5d83",
  dusty:       "#b0a090",
  stone:       "#928e85",
  fog:         "#d9d9d3",
  smoke:       "#848884",
  ash:         "#b2beb5",
  denim:       "#1560bd",
  forest:      "#228b22",
  hunter:      "#355e3b",
  burgundy:    "#800020",
  wine:        "#722f37",
  plum:        "#843179",
  eggplant:    "#614051",
  mocha:       "#967969",
  caramel:     "#c68642",
  mustard:     "#ffdb58",
  sunshine:    "#fffd37",
  poppy:       "#e35335",
  turquoise:   "#40e0d0",
  heather:     "#b0a8a0",
  camo:        "#4b5320",
  slate:       "#708090",
};

function _canvasColor(name: string): string | null {
  try {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 1;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.fillStyle = "#010101";
    ctx.fillStyle = name;
    const result = ctx.fillStyle;
    return result !== "#010101" ? result : null;
  } catch (_) { return null; }
}

function resolveColor(value: string): string {
  const key = value.toLowerCase().trim();
  if (key in _colorCache) return _colorCache[key];

  // 1. Exact match in our map (handles compound names perfectly)
  if (_colorMap[key]) {
    _colorCache[key] = _colorMap[key];
    return _colorMap[key];
  }

  // 2. Raw hex / rgb / hsl — pass straight through
  if (/^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(key) ||
      /^rgba?/.test(key) || /^hsla?/.test(key)) {
    _colorCache[key] = key;
    return key;
  }

  // 3. Browser canvas parse (handles all 140+ CSS keywords natively)
  const canvas = _canvasColor(key);
  if (canvas) {
    _colorCache[key] = canvas;
    return canvas;
  }

  // 4. Compound name: check each word against our map + canvas.
  //    Use the most "colorful" word — skip modifiers like light/dark/heather
  //    only if a better match exists, otherwise use the modifier-adjusted color.
  const words = key.split(/[\s_\-/]+/).filter(Boolean);
  if (words.length > 1) {
    // Try progressively: last word, first word, any word with a map hit
    const modifiers: Record<string, number> = {
      light: 0.45, pale: 0.5, soft: 0.4, pastel: 0.45,
      dark: -0.35, deep: -0.4, rich: -0.2, bold: -0.15,
      bright: 0.2, neon: 0.3, electric: 0.25,
      dusty: -0.1, faded: 0.15, washed: 0.15, vintage: -0.1,
    };
    let baseColor: string | null = null;
    let modifier = 0;
    for (const word of words) {
      if (modifiers[word] !== undefined) {
        modifier += modifiers[word];
      } else {
        const hit = _colorMap[word] ?? _canvasColor(word);
        if (hit) { baseColor = hit; break; }
      }
    }
    if (baseColor) {
      // Apply lightness shift if modifier words were present
      if (modifier !== 0) {
        // Parse hex to RGB, shift lightness, return adjusted hex
        const hex = baseColor.replace("#", "");
        if (hex.length === 6) {
          let r = parseInt(hex.slice(0, 2), 16);
          let g = parseInt(hex.slice(2, 4), 16);
          let b = parseInt(hex.slice(4, 6), 16);
          const shift = Math.round(modifier * 180);
          r = Math.max(0, Math.min(255, r + shift));
          g = Math.max(0, Math.min(255, g + shift));
          b = Math.max(0, Math.min(255, b + shift));
          const adjusted = "#" + [r, g, b].map(v => v.toString(16).padStart(2, "0")).join("");
          _colorCache[key] = adjusted;
          return adjusted;
        }
      }
      _colorCache[key] = baseColor;
      return baseColor;
    }
  }

  // 5. Truly unknown — neutral grey so the circle is always visible
  const fallback = "#888888";
  _colorCache[key] = fallback;
  return fallback;
}

function isColorOption(key: string) {
  const lower = key.toLowerCase();
  return lower === "color" || lower === "colour";
}

// ─── Main Page Component ──────────────────────────────────────────────────────

function OfferSlugPage() {
  const { product, allProducts } = Route.useLoaderData() as {
    product: Product | null;
    allProducts: Product[];
  };
  const navigate = useNavigate();

  // ── Cart integration ─────────────────────────────────────────────────────
  const { addItem } = useCart();
  const [addedFeedback, setAddedFeedback] = useState(false);
  const [currentStep, setCurrentStep] = useState<number | null>(null);

  // ── Product list navigation ──────────────────────────────────────────────
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

  // ── Preload adjacent products and their images ──────────────────────────
  useEffect(() => {
    if (!product || allProducts.length === 0) return;

    [prevProduct, nextProduct].forEach((p) => {
      if (p?.image_urls?.[0]) {
        const link = document.createElement("link");
        link.rel = "preload";
        link.as = "image";
        link.href = p.image_urls[0];
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

  // ── Wheel / swipe gesture (navigates between products) ────────
  const touchStartY = useRef<number | null>(null);
  const touchStartX = useRef<number | null>(null);
  // Track whether the touch started on the image gallery area so we don't
  // accidentally fire product navigation when the user is swiping images.
  const touchOnGallery = useRef(false);

  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      // FIX: Don't intercept wheel events that originate inside the image gallery
      const target = e.target as HTMLElement;
      if (target.closest("[data-gallery]")) return;
      if (Math.abs(e.deltaY) < 30) return;
      e.preventDefault();
      if (e.deltaY < 0) goToPrev(); else goToNext();
    };
    const handleTouchStart = (e: TouchEvent) => {
      const target = e.target as HTMLElement;
      touchOnGallery.current = !!target.closest("[data-gallery]");
      touchStartY.current = e.touches[0].clientY;
      touchStartX.current = e.touches[0].clientX;
    };
    const handleTouchEnd = (e: TouchEvent) => {
      // FIX: Don't fire product navigation when touch started on the image gallery
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
  }, [goToPrev, goToNext]);

  // ── Keyboard navigation ──────────────────────────────────────────────────
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft" || e.key === "ArrowUp") goToPrev();
      if (e.key === "ArrowRight" || e.key === "ArrowDown") goToNext();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [goToPrev, goToNext]);

  // ── Variants & options ───────────────────────────────────────────────────
  const variants: ProductVariant[] = useMemo(
    () => (Array.isArray(product?.variants) ? product!.variants! : []),
    [product?.variants],
  );

  const images: string[] = useMemo(() => {
    if (!Array.isArray(product?.image_urls)) return [];
    // Skip the first image — Printful always puts the logo/design mockup there
    const all = product!.image_urls.filter(Boolean);
    return all.length > 1 ? all.slice(1) : all;
  }, [product?.image_urls]);
  const galleryImages = useMemo(() => (images.length > 0 ? images : [""]), [images]);

  const optionKeys = useMemo(
    () => sortOptionKeys(Array.from(new Set(variants.flatMap((v) => Object.keys(v.attributes ?? {}))))),
    [variants],
  );

  const optionValues = useMemo(() => {
    // FIX: build the map keyed per option so colors never bleed into sizes
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

  // FIX: filter out option keys that have only a single value — no need to ask
  const visibleOptionKeys = useMemo(
    () => optionKeys.filter((key) => (optionValues[key]?.length ?? 0) > 1),
    [optionKeys, optionValues],
  );

  const [selection, setSelection] = useState<Record<string, string>>({});
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [optionsOpen, setOptionsOpen] = useState(false);

  useEffect(() => {
    setActiveImageIndex(0);
    setOptionsOpen(false);
    setCurrentStep(null);
  }, [product?.id]);

  useEffect(() => {
    if (!product || variants.length === 0) { setSelection({}); return; }
    const defaults: Record<string, string> = {};
    // Auto-select every option (including single-value ones that are hidden)
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

  // FIX: hasVariants now uses visibleOptionKeys — if all options are single-value,
  // treat as no-variant product (add directly).
  const hasVariants = variants.length > 0 && visibleOptionKeys.length > 0;

  // ── Add to cart ──────────────────────────────────────────────────────────
  const commitToCart = useCallback(() => {
    if (!product) return;
    const variant = variants.find((v) =>
      optionKeys.every((key) => v.attributes?.[key] === selection[key])
    );
    try {
      addItem({
        productId: product.id,
        variantSku: variant?.sku,
        title: variant?.sku ? `${product.title} (${variant.sku})` : product.title,
        price_cents: selectedPrice ?? product.price_cents,
        image_url: product.image_urls?.[0] || "",
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
  }, [product, variants, optionKeys, selection, selectedPrice, addItem]);

  // ── Main CTA click handler ───────────────────────────────────────────────
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

  // ── Image swipe within gallery ──────────────────────────────────────────
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

  // ── Not found ────────────────────────────────────────────────────────────
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
        .pdp-plus-btn:hover { opacity: 0.5; }
        .pdp-plus-btn:active { transform: scale(0.92); }
        .pdp-img-nav-btn { background: transparent; border: none; cursor: pointer; padding: 0.75rem 1.25rem; color: inherit; line-height: 1; transition: opacity 0.2s; font-family: inherit; }
        .pdp-img-nav-btn:hover { opacity: 0.4; }
        .pdp-img-nav-btn:disabled { opacity: 0.12; cursor: default; }
        @media (max-width: 640px) { .pdp-img-nav-btn { font-size: 44px !important; padding: 0.5rem 0.875rem; } }
        html, body { background-color: var(--background) !important; color: var(--foreground) !important; }
      `}</style>

      {/* ── Full-screen storefront ── */}
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
          {/* ── Top-left: back arrow ── */}
          <Link
            to="/shop"
            preload="intent"
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

          {/* ── Center column: image + info ── */}
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
            {/* ── Image row — FIX: data-gallery attribute stops wheel/touch from firing product nav ── */}
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
              {/* FIX: goPrevImage / goNextImage now call e.stopPropagation() */}
              <button className="pdp-img-nav-btn" onClick={goPrevImage} disabled={activeImageIndex === 0} aria-label="Previous image"
                style={{ fontSize: "38px", fontWeight: 200, opacity: activeImageIndex === 0 ? 0.12 : 0.75 }}>
                ‹
              </button>

              <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
                {galleryImages[activeImageIndex] ? (
                  <img
                    key={galleryImages[activeImageIndex]}
                    src={galleryImages[activeImageIndex]}
                    alt={`${product.title} — image ${activeImageIndex + 1}`}
                    loading="eager"
                    style={{
                      maxWidth: "min(320px, 70vw)", maxHeight: "45vh",
                      objectFit: "contain", display: "block",
                    }}
                  />
                ) : (
                  <div style={{
                    width: "min(320px, 70vw)", aspectRatio: "1",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    border: "1px solid var(--border)",
                    fontSize: "9px", fontWeight: 500, letterSpacing: "0.3em",
                    textTransform: "uppercase", opacity: 0.3,
                  }}>
                    IMAGE PENDING
                  </div>
                )}
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
                  cursor: "pointer",
                  color: "var(--foreground)",
                  fontSize: addedFeedback ? "10px" : "28px",
                  fontWeight: 200, lineHeight: 1,
                  opacity: 0.8,
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
                      cursor: "pointer",
                      color: "var(--foreground)",
                      fontSize: "28px",
                      fontWeight: 200, lineHeight: 1,
                      opacity: 0.8,
                      transition: "opacity 0.2s, transform 0.15s",
                      padding: "0.25rem",
                      fontFamily: "inherit",
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
                    {/* FIX: iterate visibleOptionKeys (multi-value only), not optionKeys */}
                    {visibleOptionKeys.map((option, idx) => {
                      if (idx !== currentStep && currentStep !== null) return null;
                      if (currentStep === null) return null;

                      const isColor = isColorOption(option);
                      const isLast = idx === visibleOptionKeys.length - 1;

                      return (
                        <div key={option} style={{
                          display: "flex", flexDirection: "column",
                          alignItems: "center", gap: "0.5rem",
                          width: "100%",
                        }}>
                          {/* FIX: only show the option type label (SIZE / COLOR), never the product name */}
                          <div style={{
                            fontSize: "9px", fontWeight: 500,
                            letterSpacing: "0.2em", textTransform: "uppercase",
                            opacity: 0.45, color: "var(--foreground)",
                            fontFamily: "inherit",
                          }}>
                            {normalizeOptionName(option)}
                          </div>

                          {/* Value chips */}
                          <div style={{
                            display: "flex", flexWrap: "wrap",
                            gap: isColor ? "0.5rem" : "0.5rem",
                            justifyContent: "center",
                          }}>
                            {/* FIX: use optionValues[option] — correctly scoped per key */}
                            {optionValues[option]?.map((value) => {
                              const selected = selection[option] === value;
                              const available = isOptionAvailable(option, value);
                              const colorHex = isColor ? resolveColor(value) : null;

                              const handleChipClick = () => {
                                setSelection((cur) => ({ ...cur, [option]: value }));

                                if (!isLast) {
                                  setCurrentStep(idx + 1);
                                } else {
                                  // Last visible option chosen → fire cart immediately
                                  const updatedSelection = { ...selection, [option]: value };
                                  const variant = variants.find((v) =>
                                    optionKeys.every((k) => v.attributes?.[k] === updatedSelection[k])
                                  );
                                  try {
                                    addItem({
                                      productId: product.id,
                                      variantSku: variant?.sku,
                                      title: variant?.sku
                                        ? `${product.title} (${variant.sku})`
                                        : product.title,
                                      price_cents: variant?.price_cents ?? selectedPrice ?? product.price_cents,
                                      image_url: product.image_urls?.[0] || "",
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
                                // ── Color swatch: filled circle ──
                                // Always has a thin black ring (white gap in dark mode)
                                // so white/cream swatches don't disappear into the bg.
                                // Selected state uses a bolder outer ring.
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
                                      width: "22px", height: "22px",
                                      borderRadius: "50%",
                                      background: colorHex ?? "var(--foreground)",
                                      // Inner white gap then black ring — always visible.
                                      // In dark mode the "white" gap reads as the dark bg,
                                      // so we layer: color → white gap → black ring.
                                      // box-shadow stacks inside-out:
                                      //   1px white ring (gap), then 2px black outer ring.
                                      // Selected adds a 3rd outer ring in the foreground color.
                                      boxShadow: selected
                                        ? "0 0 0 2px var(--background), 0 0 0 3.5px #000, 0 0 0 5.5px var(--foreground)"
                                        : "0 0 0 2px var(--background), 0 0 0 3.5px #000",
                                      border: "none",
                                      outline: "none",
                                      cursor: available ? "pointer" : "not-allowed",
                                      opacity: available ? 1 : 0.25,
                                      transition: "box-shadow 0.15s ease, opacity 0.15s ease",
                                      padding: 0,
                                      flexShrink: 0,
                                    }}
                                  />
                                );
                              }

                              // ── Non-color (e.g. size): plain text, no border ──
                              return (
                                <button
                                  key={value}
                                  type="button"
                                  onClick={handleChipClick}
                                  disabled={!available}
                                  aria-pressed={selected}
                                  style={{
                                    minHeight: "2rem", minWidth: "2.5rem",
                                    padding: "0 0.5rem",
                                    border: "none",
                                    background: "transparent",
                                    color: "var(--foreground)",
                                    fontSize: "9px", fontWeight: selected ? 700 : 400,
                                    letterSpacing: "0.12em", textTransform: "uppercase",
                                    cursor: available ? "pointer" : "not-allowed",
                                    opacity: available ? (selected ? 1 : 0.55) : 0.2,
                                    transition: "all 0.15s ease",
                                    fontFamily: "inherit",
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
    </>
  );
}
