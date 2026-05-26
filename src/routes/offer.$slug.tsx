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

// ─── Resolve color-matched image from Printful image_urls ────────────────────
// Printful always puts the logo/design mockup at index 0.
// Color variant images start at index 1, ordered to match the color option values.
function resolveVariantImage(
  imageUrls: string[],
  colorValue: string | undefined,
  colorValues: string[],
): string {
  if (!colorValue || colorValues.length === 0) return imageUrls[1] ?? imageUrls[0] ?? "";
  const colorIndex = colorValues.indexOf(colorValue);
  // imageUrls[0] is always the logo mockup — color images start at index 1
  const candidate = imageUrls[colorIndex + 1];
  return candidate ?? imageUrls[1] ?? imageUrls[0] ?? "";
}

// ─── Resolve any Printful / POD color string to a CSS color ─────────────────
// Handles 500+ exact names, compound names, raw hex/rgb/hsl, CSS keywords.
// Always returns a string — swatches are always circles, never text.
const _colorCache: Record<string, string> = {};

const _colorMap: Record<string, string> = {
  // ── Whites / off-whites ────────────────────────────────────────────────
  white:              "#ffffff", "off white":        "#f8f5f0",
  "off-white":        "#f8f5f0", "natural white":    "#fdf5e6",
  "vintage white":    "#f5f0e8", "soft cream":       "#fff5e4",
  "antique white":    "#faebd7", "warm white":       "#fdf8f0",
  "cloud white":      "#f9f9f9", "snow white":       "#fffafa",
  cream:              "#fffdd0", ivory:              "#fffff0",
  eggshell:           "#f0ead6", linen:              "#faf0e6",
  pearl:              "#f0ece4", parchment:          "#f2e8d0",
  // ── Blacks / near-blacks ───────────────────────────────────────────────
  black:              "#111111", "jet black":        "#0a0a0a",
  "faded black":      "#2c2c2c", "vintage black":    "#2a2a2a",
  "washed black":     "#333333", "soft black":       "#1a1a1a",
  "dark charcoal":    "#2d2d2d", "charcoal black":   "#222222",
  // ── Greys ─────────────────────────────────────────────────────────────
  charcoal:           "#4a5568", "light charcoal":   "#666666",
  "dark gray":        "#555555", "dark grey":        "#555555",
  "medium gray":      "#808080", "medium grey":      "#808080",
  "light gray":       "#d3d3d3", "light grey":       "#d3d3d3",
  "ash gray":         "#b2beb5", "ash grey":         "#b2beb5",
  ash:                "#b2beb5", "storm gray":       "#7f8c8d",
  "storm grey":       "#7f8c8d", "cool gray":        "#8d9091",
  "cool grey":        "#8d9091", "warm gray":        "#9f9389",
  "warm grey":        "#9f9389", "sport grey":       "#c0bbb4",
  "sport gray":       "#c0bbb4", smoke:              "#848884",
  fog:                "#d9d9d3", stone:              "#928e85",
  slate:              "#708090", silver:             "#c0c0c0",
  pewter:             "#8a898c", graphite:           "#474747",
  // ── Heathers ──────────────────────────────────────────────────────────
  heather:            "#b0a8a0", "black heather":    "#3a3a3a",
  "dark heather":     "#404040", "heather gray":     "#b0a8a0",
  "heather grey":     "#b0a8a0", "heather blue":     "#7b9eb5",
  "heather red":      "#b55a5a", "heather green":    "#6a8f6a",
  "heather orange":   "#c87941", "heather purple":   "#9b89ac",
  "heather navy":     "#3a4a6b", "heather teal":     "#5a9090",
  "heather maroon":   "#7a3a3a", "heather yellow":   "#c8b870",
  "heather cardinal": "#8b3a3a", "heather coral":    "#c87a6a",
  // ── Blues ─────────────────────────────────────────────────────────────
  blue:               "#3182ce", navy:               "#001f5b",
  "navy blue":        "#001f5b", "dark navy":        "#000f3c",
  "midnight blue":    "#191970", "royal blue":       "#4169e1",
  "cobalt blue":      "#0047ab", cobalt:             "#0047ab",
  "steel blue":       "#4682b4", "slate blue":       "#6a5acd",
  "cornflower blue":  "#6495ed", "sky blue":         "#87ceeb",
  "baby blue":        "#89cff0", "powder blue":      "#b0e0e6",
  "light blue":       "#add8e6", "pale blue":        "#cfe2f3",
  "dark blue":        "#00008b", "deep blue":        "#003580",
  "electric blue":    "#007fff", "neon blue":        "#1b03a3",
  "ocean blue":       "#006994", "teal blue":        "#367588",
  "peacock blue":     "#005f6a", "indigo blue":      "#4b0082",
  sapphire:           "#0f52ba", "sapphire blue":    "#0f52ba",
  "denim blue":       "#1560bd", denim:              "#1560bd",
  "washed blue":      "#7e9bb5", "dusty blue":       "#7b9eb5",
  "ice blue":         "#d0e8f0", "carolina blue":    "#7bafd4",
  "columbia blue":    "#c4d8e2", "periwinkle":       "#ccccff",
  teal:               "#008080", "dark teal":        "#004d4d",
  turquoise:          "#40e0d0", aqua:               "#00bcd4",
  cyan:               "#00bcd4", "robin egg":        "#00cccc",
  // ── Greens ────────────────────────────────────────────────────────────
  green:              "#38a169", "dark green":       "#006400",
  "forest green":     "#228b22", forest:             "#228b22",
  "hunter green":     "#355e3b", hunter:             "#355e3b",
  "army green":       "#4b5320", "military green":   "#4a5240",
  "olive green":      "#708238", olive:              "#808000",
  "kelly green":      "#4cbb17", "bright green":     "#00c800",
  "light green":      "#90ee90", "pale green":       "#98fb98",
  "mint green":       "#98ff98", mint:               "#98ff98",
  "sage green":       "#8fbc8f", sage:               "#8fbc8f",
  "moss green":       "#8a9a5b", moss:               "#8a9a5b",
  "lime green":       "#32cd32", lime:               "#9ae6b4",
  "neon green":       "#39ff14", "electric green":   "#00ff00",
  emerald:            "#50c878", "emerald green":    "#50c878",
  jade:               "#00a86b", "jade green":       "#00a86b",
  "bottle green":     "#006a4e", "racing green":     "#004225",
  "fern green":       "#4f7942", fern:               "#4f7942",
  "pine green":       "#01796f", pine:               "#01796f",
  "seafoam green":    "#93e9be", seafoam:            "#93e9be",
  "camo green":       "#4b5320", "green camo":       "#4b5320",
  "military camo":    "#4a5240", camo:               "#4b5320",
  "brown camo":       "#6b4c11", "desert camo":      "#c2a366",
  // ── Reds ──────────────────────────────────────────────────────────────
  red:                "#e53e3e", "true red":         "#cc0000",
  "bright red":       "#ff0000", "dark red":         "#8b0000",
  "deep red":         "#8b0000", crimson:            "#dc143c",
  scarlet:            "#ff2400", "cardinal red":     "#c41e3a",
  cardinal:           "#c41e3a", "brick red":        "#cb4154",
  brick:              "#cb4154", "fire red":         "#ce2029",
  ruby:               "#9b111e", "ruby red":         "#9b111e",
  maroon:             "#800000", "dark maroon":      "#5c0000",
  "wine red":         "#722f37", wine:               "#722f37",
  burgundy:           "#800020", "dark burgundy":    "#5c0016",
  "merlot":           "#73343a", garnet:             "#733635",
  // ── Pinks ─────────────────────────────────────────────────────────────
  pink:               "#ed64a6", "hot pink":         "#ff69b4",
  "deep pink":        "#ff1493", "bright pink":      "#ff007f",
  "light pink":       "#ffb6c1", "pale pink":        "#ffd1dc",
  "baby pink":        "#f4c2c2", "dusty pink":       "#d9a8a0",
  "dusty rose":       "#dcb4b4", "blush pink":       "#ffb3ba",
  blush:              "#de5d83", "soft pink":        "#ffb6c1",
  "mauve pink":       "#e0b0b0", "vintage rose":     "#c9a0a0",
  "neon pink":        "#ff6ec7", "bubblegum":        "#ff85cf",
  "cotton candy":     "#ffbcd9", "flamingo":         "#fc8eac",
  rose:               "#ff007f", "rose gold":        "#b76e79",
  "dusty mauve":      "#d4a5a5", fuchsia:            "#ff00ff",
  magenta:            "#ff00cc", "hot coral":        "#ff6b6b",
  // ── Oranges ───────────────────────────────────────────────────────────
  orange:             "#ed8936", "dark orange":      "#ff8c00",
  "burnt orange":     "#cc5500", "deep orange":      "#e64a19",
  "bright orange":    "#ff5500", "neon orange":      "#ff6700",
  "light orange":     "#ffa040", "pale orange":      "#ffc080",
  coral:              "#ff6b6b", "coral pink":       "#f88379",
  "salmon":           "#fa8072", "light salmon":     "#ffa07a",
  "dark salmon":      "#e9967a", peach:              "#ffcba4",
  "light peach":      "#ffddcc", apricot:            "#fbceb1",
  tangerine:          "#f28500", mango:              "#ff8243",
  rust:               "#b7410e", "burnt sienna":     "#e97451",
  poppy:              "#e35335", amber:              "#ffbf00",
  // ── Yellows ───────────────────────────────────────────────────────────
  yellow:             "#ecc94b", "bright yellow":    "#ffff00",
  "neon yellow":      "#ffff00", "light yellow":     "#ffffe0",
  "pale yellow":      "#fffacd", "golden yellow":    "#ffc200",
  gold:               "#d69e2e", "dark gold":        "#b8860b",
  "light gold":       "#f0d060", mustard:            "#ffdb58",
  "dark mustard":     "#c9a227", "mustard yellow":   "#e3a830",
  lemon:              "#fff44f", "lemon yellow":     "#fff44f",
  sunshine:           "#fffd37", "butter yellow":    "#fff1a8",
  "banana yellow":    "#ffe135", "maize":            "#fbec5d",
  sand:               "#c2b280", "sandy":            "#f4a460",
  wheat:              "#f5deb3", straw:              "#e4d96f",
  // ── Purples ───────────────────────────────────────────────────────────
  purple:             "#9f7aea", "dark purple":      "#4b0082",
  "deep purple":      "#673ab7", "light purple":     "#dda0dd",
  "bright purple":    "#8b00ff", violet:             "#ee82ee",
  "dark violet":      "#9400d3", indigo:             "#4b0082",
  lavender:           "#e6e6fa", "lavender purple":  "#967bb6",
  lilac:              "#c8a2c8", "dusty purple":     "#a68eb5",
  "pale purple":      "#dcd0e8", "soft purple":      "#c39bd3",
  plum:               "#843179", "dark plum":        "#5a1a5a",
  eggplant:           "#614051", "grape":            "#6f2da8",
  orchid:             "#da70d6", mauve:              "#e0b0ff",
  amethyst:           "#9966cc", periwinkle:         "#ccccff",
  "slate purple":     "#7b68ee",
  // ── Browns / Tans ─────────────────────────────────────────────────────
  brown:              "#a0522d", "dark brown":       "#5c3317",
  "light brown":      "#b5651d", "medium brown":     "#8b4513",
  "chocolate brown":  "#3d1c02", chocolate:          "#7b3f00",
  "dark chocolate":   "#3d1c02", mocha:              "#967969",
  coffee:             "#6f4e37", espresso:           "#4a2c2a",
  caramel:            "#c68642", "caramel brown":    "#c68642",
  tan:                "#d2b48c", "tan brown":        "#b5651d",
  "sandy brown":      "#f4a460", khaki:              "#c3b091",
  "dark khaki":       "#bdb76b", "khaki brown":      "#c3b091",
  beige:              "#f5f0e8", "light beige":      "#f7f0e6",
  "dark beige":       "#d2b48c", taupe:              "#8b7355",
  "dark taupe":       "#483c32", "light taupe":      "#c4b49a",
  walnut:             "#5d3a1a", "warm brown":       "#8b5e3c",
  toffee:             "#a07840", hazel:              "#8e7618",
  sienna:             "#a0522d", umber:              "#635147",
  "raw umber":        "#826644",
  // ── Metallics ─────────────────────────────────────────────────────────
  "light rose gold":  "#c8929a", champagne:          "#f7e7ce",
  "champagne gold":   "#f0d090", "vintage gold":     "#c5a028",
  "antique gold":     "#c9a84c", "brushed gold":     "#d4a843",
  "silver gray":      "#c0c0c0", "brushed silver":   "#b8b8b8",
  bronze:             "#cd7f32", copper:             "#b87333",
  // ── Misc / Patterns ───────────────────────────────────────────────────
  tie_dye:            "#9b59b6", "tie dye":          "#9b59b6",
  "acid wash":        "#7a8a7a", "snow wash":        "#a8b4b4",
  natural:            "#f5f0e6", "natural heather":  "#d4cfc8",
  athletic:           "#e8e8e8", "athletic gray":    "#c8c8c8",
  "athletic grey":    "#c8c8c8",
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

  // 1. Exact map hit (handles all compound names)
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

  // 3. Browser canvas — resolves all 140+ native CSS color keywords
  const canvas = _canvasColor(key);
  if (canvas) {
    _colorCache[key] = canvas;
    return canvas;
  }

  // 4. Compound: split on spaces/dashes, find base color + apply modifier shift
  const words = key.split(/[\s_\-\/]+/).filter(Boolean);
  if (words.length > 1) {
    const modifiers: Record<string, number> = {
      light: 60, pale: 70, soft: 50, pastel: 65, bright: 30, neon: 40,
      dark: -60, deep: -70, rich: -30, bold: -20, electric: 30,
      dusty: -15, faded: 40, washed: 35, vintage: -20, heather: 20,
    };
    let baseHex: string | null = null;
    let shift = 0;
    for (const word of words) {
      if (modifiers[word] !== undefined) {
        shift += modifiers[word];
      } else if (!baseHex) {
        baseHex = _colorMap[word] ?? _canvasColor(word);
      }
    }
    if (baseHex) {
      if (shift !== 0 && /^#[0-9a-f]{6}$/i.test(baseHex)) {
        const r = Math.max(0, Math.min(255, parseInt(baseHex.slice(1, 3), 16) + shift));
        const g = Math.max(0, Math.min(255, parseInt(baseHex.slice(3, 5), 16) + shift));
        const b = Math.max(0, Math.min(255, parseInt(baseHex.slice(5, 7), 16) + shift));
        const adjusted = "#" + [r, g, b].map(v => v.toString(16).padStart(2, "0")).join("");
        _colorCache[key] = adjusted;
        return adjusted;
      }
      _colorCache[key] = baseHex;
      return baseHex;
    }
  }

  // 5. Unknown — mid grey so circle is always visible
  _colorCache[key] = "#888888";
  return "#888888";
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

  // ── Resolve color values for image mapping ───────────────────────────────
  const colorOptionKey = useMemo(
    () => optionKeys.find((k) => isColorOption(k)),
    [optionKeys],
  );
  const colorValues = useMemo(
    () => (colorOptionKey ? optionValues[colorOptionKey] ?? [] : []),
    [colorOptionKey, optionValues],
  );

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
        title: product.title,
        price_cents: selectedPrice ?? product.price_cents,
        image_url: resolveVariantImage(
          product.image_urls ?? [],
          selection[colorOptionKey ?? ""] ?? selection["color"] ?? selection["colour"],
          colorValues,
        ),
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
                                      title: product.title,
                                      price_cents: variant?.price_cents ?? selectedPrice ?? product.price_cents,
                                      image_url: resolveVariantImage(
                                        product.image_urls ?? [],
                                        updatedSelection[colorOptionKey ?? ""] ?? updatedSelection["color"] ?? updatedSelection["colour"],
                                        colorValues,
                                      ),
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
                                // ── Color swatch: perfect circle, always visible ──
                                // Ring strategy:
                                //   inner 1.5px white gap  → separates swatch from ring
                                //   inner 1.5px black gap  → always-dark inner edge
                                //   outer 1.5px white ring → separates black from bg on dark
                                //   outer 1.5px black ring → always-dark outer edge on light
                                // Net effect: swatch is bracketed by both black AND white bands
                                // so it reads on any background. Selected adds a thicker accent.
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
                                      width: "22px", height: "22px",
                                      borderRadius: "50%",
                                      background: colorHex,
                                      // Layer (inside → out):
                                      //   2px white gap, 3.5px black ring, 5px white gap, 6.5px black outer
                                      // This ensures visibility on both light + dark backgrounds.
                                      // On selection the outermost ring becomes the foreground accent.
                                      boxShadow: selected
                                        ? "0 0 0 3px #fff, 0 0 0 5px #000, 0 0 0 7px #fff, 0 0 0 9px var(--foreground)"
                                        : "0 0 0 3px #fff, 0 0 0 5px #000, 0 0 0 7px #fff",
                                      // Solid border guarantees the swatch edge is always
                                      // visible: dark border on light bg, light border on dark bg.
                                      // Uses currentColor so it inherits the theme foreground.
                                      border: "1.5px solid currentColor",
                                      outline: "none",
                                      cursor: available ? "pointer" : "not-allowed",
                                      opacity: available ? 1 : 0.3,
                                      transition: "box-shadow 0.15s ease, opacity 0.15s ease",
                                      padding: 0,
                                      flexShrink: 0,
                                      WebkitAppearance: "none",
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
