/**
 * @LOCK_PROTOCOL_ACTIVE
 * DO NOT MODIFY. DO NOT REFACTOR. DO NOT RE-IMPLEMENT.
 * ACCESS RESTRICTED.
 */
import { createFileRoute, useNavigate } from "@tanstack/react-router";
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

  // ── Wheel / swipe gesture (navigates between products — unchanged) ────────
  const touchStartY = useRef<number | null>(null);
  const touchStartX = useRef<number | null>(null);

  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) < 30) return;
      e.preventDefault();
      if (e.deltaY < 0) goToPrev(); else goToNext();
    };
    const handleTouchStart = (e: TouchEvent) => {
      touchStartY.current = e.touches[0].clientY;
      touchStartX.current = e.touches[0].clientX;
    };
    const handleTouchEnd = (e: TouchEvent) => {
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

  // ── Keyboard navigation (unchanged) ──────────────────────────────────────
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

  const images: string[] = useMemo(
    () => Array.isArray(product?.image_urls) ? product!.image_urls.filter(Boolean) : [],
    [product?.image_urls],
  );
  const galleryImages = useMemo(() => (images.length > 0 ? images : [""]), [images]);

  const optionKeys = useMemo(
    () => sortOptionKeys(Array.from(new Set(variants.flatMap((v) => Object.keys(v.attributes ?? {}))))),
    [variants],
  );

  const optionValues = useMemo(() => {
    return optionKeys.reduce<Record<string, string[]>>((acc, key) => {
      acc[key] = Array.from(new Set(variants.map((v) => v.attributes?.[key]).filter(Boolean))) as string[];
      return acc;
    }, {});
  }, [optionKeys, variants]);

  const [selection, setSelection] = useState<Record<string, string>>({});
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [optionsOpen, setOptionsOpen] = useState(false);

  useEffect(() => {
    setActiveImageIndex(0);
    setOptionsOpen(false);
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

  // ── Add to cart handler ──────────────────────────────────────────────────
  const handleAddToCart = useCallback(() => {
    if (!product || checkoutDisabled || isSoldOut) return;
    if (optionKeys.length > 0 && !optionsOpen) {
      setOptionsOpen(true);
      return;
    }
    addItem({
      productId: product.id,
      variantSku: selectedVariant?.sku,
      title: selectedVariant?.sku ? `${product.title} (${selectedVariant.sku})` : product.title,
      price_cents: selectedPrice ?? product.price_cents,
      image_url: product.image_urls?.[0] || "",
    });
    setAddedFeedback(true);
    setOptionsOpen(false);
    setTimeout(() => setAddedFeedback(false), 1200);
  }, [product, selectedVariant, selectedPrice, checkoutDisabled, isSoldOut, addItem, optionKeys.length, optionsOpen]);

  // ── Image swipe within gallery (horizontal swipe cycles images) ──────────
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

  // ── Image arrow handlers (cycle gallery images, not products) ────────────
  const goPrevImage = useCallback(() => {
    setActiveImageIndex((i) => Math.max(i - 1, 0));
  }, []);

  const goNextImage = useCallback(() => {
    setActiveImageIndex((i) => Math.min(i + 1, galleryImages.length - 1));
  }, [galleryImages.length]);

  // ── Not found ────────────────────────────────────────────────────────────
  if (!product) {
    return (
      <section
        className="flex min-h-screen flex-col items-center justify-center bg-background text-foreground px-4"
        style={{ fontFamily: "var(--font-mono, monospace)" }}
      >
        <p className="text-[10px] font-bold uppercase tracking-[0.35em] opacity-40">404</p>
        <h1 className="mt-3 text-3xl font-black uppercase tracking-[-0.04em]">Offer Not Found</h1>
        <p className="mt-3 text-xs uppercase tracking-[0.2em] opacity-50">
          This product is unavailable or no longer exists.
        </p>
        <a
          href="/shop"
          className="mt-8 inline-flex h-12 items-center border border-foreground bg-foreground text-background px-10 text-xs font-bold uppercase tracking-[0.25em] transition hover:bg-background hover:text-foreground"
        >
          Back to Shop
        </a>
      </section>
    );
  }

  return (
    <>
      {prevProduct && <link rel="prefetch" href={`/offer/${prevProduct.slug}`} as="document" />}
      {nextProduct && <link rel="prefetch" href={`/offer/${nextProduct.slug}`} as="document" />}
      <style>{`
        @keyframes pdp-fade-in {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes pdp-img-in {
          from { opacity: 0; transform: scale(0.96); }
          to   { opacity: 1; transform: scale(1); }
        }
        .pdp-plus-btn:hover { opacity: 0.5; }
        .pdp-plus-btn:active { transform: scale(0.92); }
        .pdp-img-nav-btn { background: transparent; border: none; cursor: pointer; padding: 0.75rem 1.25rem; color: inherit; line-height: 1; transition: opacity 0.2s; font-family: inherit; }
        .pdp-img-nav-btn:hover { opacity: 0.4; }
        .pdp-img-nav-btn:disabled { opacity: 0.12; cursor: default; }
        @media (max-width: 640px) { .pdp-img-nav-btn { font-size: 44px !important; padding: 0.5rem 0.875rem; } }
      `}</style>

      {/* ── Full-screen container ── */}
      <div
        className="bg-background text-foreground"
        style={{
          position: "fixed",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
          overflow: "hidden",
          zIndex: 0,
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
            opacity: 0.7,
            display: "flex", alignItems: "center",
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
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            width: "100%",
            maxWidth: "480px",
            padding: "3.5rem 2rem 2rem",
            boxSizing: "border-box",
            animation: "pdp-fade-in 0.4s ease both",
          }}
          key={product.slug}
        >
          {/* ── Image row: left arrow + image + right arrow ── */}
          <div style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "0.5rem",
            marginBottom: "1.5rem",
          }}
            onTouchStart={handleImgTouchStart}
            onTouchEnd={handleImgTouchEnd}
          >
            {/* Left image arrow */}
            <button
              className="pdp-img-nav-btn"
              onClick={goPrevImage}
              disabled={activeImageIndex === 0}
              aria-label="Previous image"
              style={{ fontSize: "38px", fontWeight: 200, opacity: activeImageIndex === 0 ? 0.12 : 0.75 }}
            >
              ‹
            </button>

            {/* Product image */}
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
              {galleryImages[activeImageIndex] ? (
                <img
                  key={galleryImages[activeImageIndex]}
                  src={galleryImages[activeImageIndex]}
                  alt={`${product.title} — image ${activeImageIndex + 1}`}
                  loading="eager"
                  style={{
                    maxWidth: "min(320px, 70vw)",
                    maxHeight: "45vh",
                    objectFit: "contain",
                    display: "block",
                    animation: "pdp-img-in 0.4s cubic-bezier(0.22, 1, 0.36, 1) both",
                  }}
                />
              ) : (
                <div style={{
                  width: "min(320px, 70vw)", aspectRatio: "1",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  border: "1px solid rgba(128,128,128,0.15)",
                  fontSize: "9px", fontWeight: 500, letterSpacing: "0.3em",
                  textTransform: "uppercase", opacity: 0.3,
                }}>
                  IMAGE PENDING
                </div>
              )}
            </div>

            {/* Right image arrow */}
            <button
              className="pdp-img-nav-btn"
              onClick={goNextImage}
              disabled={activeImageIndex === galleryImages.length - 1}
              aria-label="Next image"
              style={{ fontSize: "22px", fontWeight: 300, opacity: activeImageIndex === galleryImages.length - 1 ? 0.15 : 0.7 }}
            >
              ›
            </button>
          </div>

          {/* Image dots */}
          {galleryImages.length > 1 && (
            <div style={{ display: "flex", gap: "6px", marginBottom: "1.5rem" }}>
              {galleryImages.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setActiveImageIndex(i)}
                  aria-label={`Image ${i + 1}`}
                  style={{
                    width: "6px", height: "6px",
                    borderRadius: "50%",
                    background: "currentColor",
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
            fontSize: "clamp(0.85rem, 2vw, 1rem)",
            fontWeight: 400,
            letterSpacing: "0.02em",
            color: "inherit",
            textAlign: "center",
            marginBottom: "0.4rem",
            opacity: 0.9,
          }}>
            {product.title}
          </div>

          {/* Price */}
          <div style={{
            fontSize: "clamp(0.85rem, 2vw, 1rem)",
            fontWeight: 400,
            letterSpacing: "0.02em",
            color: "inherit",
            textAlign: "center",
            marginBottom: "1.5rem",
            opacity: 0.9,
          }}>
            {formatPrice(selectedPrice)}
          </div>

          {/* Variant options (shown when optionsOpen) */}
          {optionsOpen && optionKeys.length > 0 && (
            <div style={{
              width: "100%", display: "flex", flexDirection: "column",
              gap: "1rem", marginBottom: "1.25rem",
              animation: "pdp-fade-in 0.25s ease both",
            }}>
              {optionKeys.map((option) => (
                <div key={option}>
                  <div style={{
                    fontSize: "9px", fontWeight: 500, letterSpacing: "0.2em",
                    textTransform: "uppercase", opacity: 0.45,
                    textAlign: "center", marginBottom: "0.5rem",
                  }}>
                    {normalizeOptionName(option)} — {selection[option] || "SELECT"}
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem", justifyContent: "center" }}>
                    {optionValues[option]?.map((value) => {
                      const selected = selection[option] === value;
                      const available = isOptionAvailable(option, value);
                      return (
                        <button
                          key={value}
                          type="button"
                          onClick={() => setSelection((cur) => ({ ...cur, [option]: value }))}
                          disabled={!available}
                          aria-pressed={selected}
                          style={{
                            minHeight: "2rem", minWidth: "2.5rem", padding: "0 0.75rem",
                            borderColor: selected ? "currentColor" : "rgba(128,128,128,0.25)",
                            border: "1px solid",
                            background: selected ? "currentColor" : "transparent",
                            color: "inherit",
                            filter: selected ? "invert(1)" : "none",
                            fontSize: "9px", fontWeight: 500, letterSpacing: "0.08em",
                            textTransform: "uppercase",
                            cursor: available ? "pointer" : "not-allowed",
                            opacity: available ? 1 : 0.3,
                            transition: "all 0.15s ease",
                            fontFamily: "inherit",
                          }}
                        >
                          {value}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* CTA: "+" button (or SOLD OUT / ADDED) */}
          {isSoldOut ? (
            <div style={{
              fontSize: "10px", fontWeight: 500, letterSpacing: "0.2em",
              textTransform: "uppercase", opacity: 0.35,
            }}>
              SOLD OUT
            </div>
          ) : (
            <button
              onClick={handleAddToCart}
              disabled={checkoutDisabled && optionsOpen}
              className="pdp-plus-btn"
              aria-label="Add to cart"
              style={{
                background: "transparent", border: "none",
                cursor: (checkoutDisabled && optionsOpen) ? "not-allowed" : "pointer",
                color: "inherit",
                fontSize: addedFeedback ? "10px" : "28px",
                fontWeight: 200,
                lineHeight: 1,
                opacity: (checkoutDisabled && optionsOpen) ? 0.3 : 0.8,
                transition: "opacity 0.2s, transform 0.15s, font-size 0.15s",
                letterSpacing: addedFeedback ? "0.2em" : "0",
                textTransform: "uppercase",
                padding: "0.25rem",
                fontFamily: "inherit",
              }}
            >
              {addedFeedback ? "ADDED" : "+"}
            </button>
          )}
        </div>

        {/* ── Bottom-right: product counter ── */}
        {allProducts.length > 1 && (
          <div style={{
            position: "absolute", bottom: "1.25rem", right: "1.5rem",
            fontSize: "9px", fontWeight: 400, letterSpacing: "0.15em",
            color: "inherit", opacity: 0.3,
            fontFamily: "inherit",
          }}>
            {String(currentIndex + 1).padStart(2, "0")} / {String(allProducts.length).padStart(2, "0")}
          </div>
        )}
      </div>
    </>
  );
}
