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
    currentIndex < allProducts.length - 1
      ? allProducts[currentIndex + 1]
      : null;

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

  // ── Wheel / swipe gesture ────────────────────────────────────────────────
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
  const [infoExpanded, setInfoExpanded] = useState(false);

  useEffect(() => {
    setActiveImageIndex(0);
    setInfoExpanded(false);
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

  const stockMessage = selectedVariant
    ? selectedVariant.stock != null && selectedVariant.stock <= 0 ? "SOLD OUT" : "IN STOCK"
    : variants.length > 0 ? "SELECT OPTIONS" : "IN STOCK";

  const isSoldOut = selectedVariant?.stock != null && selectedVariant.stock <= 0;

  // ── Add to cart handler ──────────────────────────────────────────────────
  const handleAddToCart = useCallback(() => {
    if (!product || checkoutDisabled || isSoldOut) return;
    addItem({
      productId: product.id,
      variantSku: selectedVariant?.sku,
      title: selectedVariant?.sku ? `${product.title} (${selectedVariant.sku})` : product.title,
      price_cents: selectedPrice ?? product.price_cents,
    });
    setAddedFeedback(true);
    setTimeout(() => setAddedFeedback(false), 1200);
  }, [product, selectedVariant, selectedPrice, checkoutDisabled, isSoldOut, addItem]);

  // ── Image swipe within gallery ───────────────────────────────────────────
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

  // ── Not found ────────────────────────────────────────────────────────────
  if (!product) {
    return (
      <section className="flex min-h-screen flex-col items-center justify-center bg-background text-foreground px-4"
        style={{ fontFamily: "var(--font-mono, monospace)" }}>
        <p className="text-[10px] font-bold uppercase tracking-[0.35em] opacity-40">404</p>
        <h1 className="mt-3 text-3xl font-black uppercase tracking-[-0.04em]">Offer Not Found</h1>
        <p className="mt-3 text-xs uppercase tracking-[0.2em] opacity-50">
          This product is unavailable or no longer exists.
        </p>
        <a href="/shop"
          className="mt-8 inline-flex h-12 items-center border border-foreground bg-foreground text-background px-10 text-xs font-bold uppercase tracking-[0.25em] transition hover:bg-background hover:text-foreground">
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
        @keyframes pdp-zoom-in {
          from { opacity: 0; transform: scale(0.94); }
          to   { opacity: 1; transform: scale(1); }
        }
      `}</style>

      <div
        className="yeezy-pdp bg-background text-foreground"
        style={{
          position: "fixed",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          fontFamily: "var(--font-mono, 'Space Mono', monospace)",
          overflow: "hidden",
          zIndex: 0,
        }}
      >
        {/* ── Top bar ── */}
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0, zIndex: 20,
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "0 1.5rem", height: "3rem", background: "transparent",
        }}>
          <a href="/shop" style={{
            fontSize: "9px", fontWeight: 700, letterSpacing: "0.28em",
            textTransform: "uppercase", color: "inherit", textDecoration: "none",
            display: "flex", alignItems: "center", gap: "0.4rem",
          }}>
            <span style={{ fontSize: "11px" }}>←</span> SHOP
          </a>
          <span style={{
            fontSize: "9px", fontWeight: 700, letterSpacing: "0.28em",
            textTransform: "uppercase",
            color: isSoldOut ? "#c00" : "inherit",
            opacity: isSoldOut ? 1 : 0.4,
          }}>
            {stockMessage}
          </span>
        </div>

        {/* ── Image area ── */}
        <div
          style={{
            flex: "1 1 0", position: "relative", display: "flex",
            alignItems: "center", justifyContent: "center",
            overflow: "hidden", minHeight: 0,
          }}
          onTouchStart={handleImgTouchStart}
          onTouchEnd={handleImgTouchEnd}
        >
          <div
            key={product.slug}
            style={{
              position: "relative", width: "100%", height: "100%",
              display: "flex", alignItems: "center", justifyContent: "center",
              animation: "pdp-zoom-in 0.5s cubic-bezier(0.22, 1, 0.36, 1) both",
            }}
          >
            {galleryImages[activeImageIndex] ? (
              <img
                key={galleryImages[activeImageIndex]}
                src={galleryImages[activeImageIndex]}
                alt={`${product.title} — image ${activeImageIndex + 1}`}
                loading="eager"
                style={{
                  maxWidth: "min(560px, 90%)",
                  maxHeight: "calc(100% - 4rem)",
                  objectFit: "contain",
                  display: "block",
                  transition: "opacity 0.2s ease",
                }}
              />
            ) : (
              <div style={{
                width: "min(560px, 80%)", aspectRatio: "1",
                display: "flex", alignItems: "center", justifyContent: "center",
                border: "1px solid rgba(128,128,128,0.15)",
                fontSize: "9px", fontWeight: 700, letterSpacing: "0.3em",
                textTransform: "uppercase", opacity: 0.3,
              }}>
                IMAGE PENDING
              </div>
            )}
          </div>

          {/* ── Left nav arrow ── */}
          <button onClick={goToPrev} disabled={!prevProduct} aria-label="Previous product"
            style={{
              position: "absolute", left: "1rem", top: "50%", transform: "translateY(-50%)",
              zIndex: 10, background: "transparent", border: "none",
              cursor: prevProduct ? "pointer" : "default",
              padding: "0.75rem 0.5rem", display: "flex", alignItems: "center", justifyContent: "center",
              opacity: prevProduct ? 1 : 0.15, transition: "opacity 0.2s",
            }}>
            <span style={{ fontSize: "22px", fontWeight: 300, color: "inherit", lineHeight: 1, fontFamily: "serif" }}>‹</span>
          </button>

          {/* ── Right nav arrow ── */}
          <button onClick={goToNext} disabled={!nextProduct} aria-label="Next product"
            style={{
              position: "absolute", right: "1rem", top: "50%", transform: "translateY(-50%)",
              zIndex: 10, background: "transparent", border: "none",
              cursor: nextProduct ? "pointer" : "default",
              padding: "0.75rem 0.5rem", display: "flex", alignItems: "center", justifyContent: "center",
              opacity: nextProduct ? 1 : 0.15, transition: "opacity 0.2s",
            }}>
            <span style={{ fontSize: "22px", fontWeight: 300, color: "inherit", lineHeight: 1, fontFamily: "serif" }}>›</span>
          </button>

          {/* ── Image dot indicators ── */}
          {galleryImages.length > 1 && (
            <div style={{
              position: "absolute", bottom: "0.75rem", left: "50%",
              transform: "translateX(-50%)", display: "flex", gap: "5px", zIndex: 10,
            }}>
              {galleryImages.map((_, i) => (
                <button key={i} onClick={() => setActiveImageIndex(i)} aria-label={`Image ${i + 1}`}
                  style={{
                    width: i === activeImageIndex ? "18px" : "6px", height: "6px",
                    borderRadius: "3px", background: "currentColor",
                    opacity: i === activeImageIndex ? 1 : 0.25,
                    border: "none", cursor: "pointer", padding: 0,
                    transition: "all 0.25s ease",
                  }}
                />
              ))}
            </div>
          )}

          {/* ── Product counter ── */}
          {allProducts.length > 1 && (
            <div style={{
              position: "absolute", bottom: "0.75rem", right: "1.25rem",
              fontSize: "8px", fontWeight: 700, letterSpacing: "0.2em",
              color: "inherit", opacity: 0.35,
              fontFamily: "var(--font-mono, monospace)",
            }}>
              {String(currentIndex + 1).padStart(2, "0")} / {String(allProducts.length).padStart(2, "0")}
            </div>
          )}
        </div>

        {/* ── Info panel ── */}
        <div style={{
          flexShrink: 0,
          borderTop: "1px solid rgba(128,128,128,0.1)",
          padding: "1rem 1.5rem 0",
          maxHeight: infoExpanded ? "60vh" : "auto",
          overflowY: infoExpanded ? "auto" : "visible",
          transition: "max-height 0.3s ease",
        }}>
          {/* Title + price row */}
          <div style={{
            display: "flex", alignItems: "baseline",
            justifyContent: "space-between", gap: "1rem", marginBottom: "0.35rem",
          }}>
            <h1 style={{
              fontSize: "clamp(1.1rem, 4vw, 1.75rem)", fontWeight: 900,
              textTransform: "uppercase", letterSpacing: "-0.04em",
              lineHeight: 1, color: "inherit", margin: 0,
            }}>
              {product.title}
            </h1>
            <span style={{
              fontSize: "clamp(0.85rem, 2.5vw, 1.1rem)", fontWeight: 700,
              letterSpacing: "0.1em", color: "inherit", whiteSpace: "nowrap", flexShrink: 0,
            }}>
              {formatPrice(selectedPrice)}
            </span>
          </div>

          {/* Description toggle */}
          {product.description && (
            <button onClick={() => setInfoExpanded((v) => !v)} style={{
              background: "none", border: "none", padding: "0.25rem 0",
              cursor: "pointer", fontSize: "8px", fontWeight: 700,
              letterSpacing: "0.25em", textTransform: "uppercase",
              color: "inherit", opacity: 0.4, display: "flex", alignItems: "center", gap: "0.3rem",
              marginBottom: infoExpanded ? "0.75rem" : "0",
            }}>
              {infoExpanded ? "HIDE INFO ↑" : "INFO ↓"}
            </button>
          )}

          {infoExpanded && product.description && (
            <p style={{
              fontSize: "11px", lineHeight: 1.7, color: "inherit", opacity: 0.6,
              textTransform: "uppercase", letterSpacing: "0.08em",
              whiteSpace: "pre-line", marginBottom: "0.75rem", maxWidth: "560px",
            }}>
              {product.description}
            </p>
          )}

          {/* Options */}
          {optionKeys.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", paddingBottom: "0.75rem" }}>
              {optionKeys.map((option) => (
                <div key={option}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.4rem" }}>
                    <span style={{ fontSize: "8px", fontWeight: 700, letterSpacing: "0.3em", textTransform: "uppercase", color: "inherit" }}>
                      {normalizeOptionName(option)}
                    </span>
                    <span style={{ fontSize: "8px", fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: "inherit", opacity: 0.4 }}>
                      {selection[option] || "SELECT"}
                    </span>
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem" }}>
                    {optionValues[option]?.map((value) => {
                      const selected = selection[option] === value;
                      const available = isOptionAvailable(option, value);
                      return (
                        <button key={value} type="button"
                          onClick={() => setSelection((cur) => ({ ...cur, [option]: value }))}
                          disabled={!available} aria-pressed={selected}
                          style={{
                            minHeight: "2rem", minWidth: "2.5rem", padding: "0 0.75rem",
                            border: selected ? "1px solid currentColor" : "1px solid currentColor",
                            borderColor: selected ? "currentColor" : "rgba(128,128,128,0.2)",
                            background: selected ? "currentColor" : "transparent",
                            color: "inherit", filter: selected ? "invert(1)" : "none",
                            fontSize: "9px", fontWeight: 700, letterSpacing: "0.08em",
                            textTransform: "uppercase",
                            cursor: available ? "pointer" : "not-allowed",
                            opacity: available ? 1 : 0.3, transition: "all 0.15s ease",
                            fontFamily: "inherit",
                          }}>
                          {value}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Footer CTA ── */}
        <div style={{
          flexShrink: 0, background: "currentColor", height: "3.5rem",
          display: "flex", alignItems: "stretch",
        }}>
          {isSoldOut ? (
            <div style={{
              flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "9px", fontWeight: 700, letterSpacing: "0.35em",
              textTransform: "uppercase", color: "inherit", filter: "invert(1)",
              opacity: 0.4, fontFamily: "inherit",
            }}>
              SOLD OUT
            </div>
          ) : (
            <button
              onClick={handleAddToCart}
              disabled={checkoutDisabled}
              style={{
                flex: 1, display: "flex", alignItems: "center",
                justifyContent: "space-between", padding: "0 1.5rem",
                background: "transparent", border: "none",
                cursor: checkoutDisabled ? "not-allowed" : "pointer",
                opacity: checkoutDisabled ? 0.4 : 1,
                transition: "opacity 0.2s",
              }}
            >
              <span style={{
                fontSize: "9px", fontWeight: 700, letterSpacing: "0.35em",
                textTransform: "uppercase", color: "inherit",
                filter: "invert(1)", fontFamily: "inherit",
                transition: "opacity 0.15s",
              }}>
                {addedFeedback
                  ? "ADDED ✓"
                  : checkoutDisabled
                  ? "SELECT OPTIONS"
                  : "ADD TO CART"}
              </span>
              <span style={{
                fontSize: "20px", color: "inherit", filter: "invert(1)",
                lineHeight: 1, fontWeight: 300, fontFamily: "serif",
              }}>
                →
              </span>
            </button>
          )}
        </div>
      </div>
    </>
  );
}
