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
  // optionsOpen now drives whether we're in "variant picking" mode
  const [optionsOpen, setOptionsOpen] = useState(false);

  useEffect(() => {
    setActiveImageIndex(0);
    setOptionsOpen(false);
    setCurrentStep(null);
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

  // ── Whether this product has variants at all ─────────────────────────────
  const hasVariants = variants.length > 0 && optionKeys.length > 0;

  // ── Add to cart (no-variant products, or after all variants are chosen) ──
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

    // No variants → add directly
    if (!hasVariants) {
      commitToCart();
      return;
    }

    // Has variants but options panel not open yet → open at step 0
    if (!optionsOpen) {
      setOptionsOpen(true);
      setCurrentStep(0);
      return;
    }

    // Options open but last step already resolved → commit
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
            {/* ── Image row ── */}
            <div style={{
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

            {/* ── CTA ZONE ─────────────────────────────────────────────────────
                Three states:
                1. Sold out          → static "SOLD OUT" text
                2. No variants       → the classic "+" button (original behavior)
                3. Has variants      → "+" opens inline option chips;
                                       final selection fires add-to-cart with
                                       same "ADDED" feedback animation
            ──────────────────────────────────────────────────────────────── */}
            {isSoldOut ? (
              /* ── State 1: Sold out ── */
              <div style={{
                fontSize: "10px", fontWeight: 500, letterSpacing: "0.2em",
                textTransform: "uppercase", opacity: 0.35, color: "var(--foreground)",
              }}>
                SOLD OUT
              </div>

            ) : !hasVariants ? (
              /* ── State 2: No variants — original "+" button, untouched ── */
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
              /* ── State 3: Has variants — options replace the "+" inline ── */
              <div style={{
                display: "flex", flexDirection: "column",
                alignItems: "center", width: "100%",
                animation: "pdp-fade-in 0.15s linear both",
              }}>
                {!optionsOpen ? (
                  /* Before any selection: the "+" acts as the entry point */
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
                  /* "ADDED" confirmation — same style as the no-variant state */
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
                  /* Options open: show current step's chips in the same spot the "+" was */
                  <div style={{
                    width: "100%", display: "flex", flexDirection: "column",
                    alignItems: "center", gap: "1rem",
                    animation: "pdp-option-in 0.15s linear both",
                  }}>
                    {optionKeys.map((option, idx) => {
                      // Only render the active step
                      if (idx !== currentStep && currentStep !== null) return null;
                      // If currentStep is null all steps are done — show add trigger
                      if (currentStep === null) return null;

                      return (
                        <div key={option} style={{
                          display: "flex", flexDirection: "column",
                          alignItems: "center", gap: "0.5rem",
                          width: "100%",
                        }}>
                          {/* Option label — same tiny uppercase style as the rest of the page */}
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
                            gap: "0.35rem", justifyContent: "center",
                          }}>
                            {optionValues[option]?.map((value) => {
                              const selected = selection[option] === value;
                              const available = isOptionAvailable(option, value);
                              const isLast = idx === optionKeys.length - 1;

                              return (
                                <button
                                  key={value}
                                  type="button"
                                  onClick={() => {
                                    setSelection((cur) => ({ ...cur, [option]: value }));

                                    if (!isLast) {
                                      // Advance to next step
                                      setCurrentStep(idx + 1);
                                    } else {
                                      // Last option chosen → fire cart immediately
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
                                  }}
                                  disabled={!available}
                                  aria-pressed={selected}
                                  style={{
                                    minHeight: "2rem", minWidth: "2.5rem",
                                    padding: "0 0.75rem",
                                    border: "1px solid",
                                    borderColor: selected ? "var(--foreground)" : "var(--border)",
                                    background: selected ? "var(--foreground)" : "transparent",
                                    color: selected ? "var(--background)" : "var(--foreground)",
                                    fontSize: "9px", fontWeight: 500,
                                    letterSpacing: "0.08em", textTransform: "uppercase",
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
                      );
                    })}

                    {/* If all steps resolved but cart hasn't fired (edge case) */}
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
