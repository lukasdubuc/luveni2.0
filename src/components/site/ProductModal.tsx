// ─────────────────────────────────────────────────────────────
//  Luveni — fullscreen product overlay (Tamed Psychotic style)
//  Opens over the SPA on product click (no navigation). Selecting a
//  colour variant dynamically filters the carousel to that variant's
//  mockups (front/back/side/model/lifestyle); the active image lives in
//  the pan-zoom canvas. Adds the chosen size/colour variant to cart.
// ─────────────────────────────────────────────────────────────

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { useProductMedia, type ProductMedia } from "@/lib/useProductMedia";
import { useCart } from "@/context/CartContext";
import { proxyImageUrl } from "@/lib/img";
import { GarmentSilhouette, garmentKindFromTitle } from "./GarmentSilhouette";
import { ZoomPanImage } from "./ZoomPanImage";

export interface ModalProduct {
  id: string;
  title: string;
  slug: string;
  price_cents: number;
  discounted_price_cents?: number | null;
  image_urls?: string[];
  variants?: Array<{ sku?: string; attributes?: Record<string, string>; stock?: number }>;
}

function attr(v: ModalProduct["variants"] extends (infer T)[] ? T : never, key: string): string {
  return (v?.attributes?.[key] ?? "").trim();
}

export function ProductModal({ product, onClose }: { product: ModalProduct; onClose: () => void }) {
  const { media } = useProductMedia(product.id);
  const { addItem } = useCart();

  const variants = product.variants ?? [];
  const colors = useMemo(
    () => Array.from(new Set(variants.map((v) => attr(v, "color")).filter(Boolean))),
    [variants],
  );
  const sizes = useMemo(
    () => Array.from(new Set(variants.map((v) => attr(v, "size")).filter(Boolean))),
    [variants],
  );

  const [color, setColor] = useState<string>(colors[0] ?? "");
  const [size, setSize] = useState<string>(sizes[0] ?? "");
  const [activeIdx, setActiveIdx] = useState(0);

  // SKUs belonging to the selected colour → filter media to that colour.
  const colorSkus = useMemo(
    () => new Set(variants.filter((v) => attr(v, "color") === color).map((v) => String(v.sku))),
    [variants, color],
  );

  // Carousel = media for the selected colour (by variant_key) + product-wide
  // (null variant_key). Falls back to the flat image_urls if no media synced.
  const carousel: { url: string; label: string }[] = useMemo(() => {
    let rows: ProductMedia[] = media;
    if (color && colorSkus.size > 0) {
      rows = media.filter((m) => !m.variant_key || colorSkus.has(String(m.variant_key)));
    }
    const ordered = [...rows].sort((a, b) => {
      if (a.is_primary !== b.is_primary) return a.is_primary ? -1 : 1;
      return a.position - b.position;
    });
    const fromMedia = ordered.map((m) => ({ url: proxyImageUrl(m.url), label: m.view_type.replace("_", " ") }));
    if (fromMedia.length > 0) return fromMedia;
    return (product.image_urls ?? []).map((u, i) => ({ url: proxyImageUrl(u), label: i === 0 ? "front" : `view ${i + 1}` }));
  }, [media, color, colorSkus, product.image_urls]);

  useEffect(() => { setActiveIdx(0); }, [color]);
  // Esc to close + lock body scroll while open.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [onClose]);

  const hasDiscount = product.discounted_price_cents != null && product.discounted_price_cents < product.price_cents;
  const priceCents = hasDiscount ? product.discounted_price_cents! : product.price_cents;
  const active = carousel[Math.min(activeIdx, Math.max(0, carousel.length - 1))];
  const kind = garmentKindFromTitle(product.title);

  const selectedVariant = variants.find(
    (v) => (!color || attr(v, "color") === color) && (!size || attr(v, "size") === size),
  );

  const addToCart = () => {
    addItem({
      productId: product.id,
      variantSku: selectedVariant?.sku,
      title: product.title,
      price_cents: priceCents,
      image_url: active?.url ?? "",
      metadata: { color, size },
    });
    onClose();
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 z-[100] flex flex-col bg-white/95 font-mono backdrop-blur-md dark:bg-black/95 md:flex-row"
        role="dialog" aria-modal="true" aria-label={product.title}
      >
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute right-4 top-4 z-10 rounded-full p-2 text-current opacity-60 transition hover:opacity-100"
        >
          <X size={20} />
        </button>

        {/* Stage: pan-zoom canvas with silhouette underlay (no CLS). */}
        <div className="relative flex-1 md:h-full">
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-10">
            <GarmentSilhouette kind={kind} className="h-2/3 w-2/3 text-current" />
          </div>
          {active ? (
            <ZoomPanImage src={active.url} alt={`${product.title} — ${active.label}`} />
          ) : (
            <div className="flex h-full items-center justify-center text-[10px] uppercase tracking-[0.3em] opacity-30">
              No imagery
            </div>
          )}
        </div>

        {/* Rail: thumbnails + variant pickers + add to cart. */}
        <div className="flex w-full flex-col gap-6 overflow-y-auto p-6 md:w-[360px] md:p-8">
          <div>
            <h2 className="text-sm uppercase tracking-[0.15em]">{product.title}</h2>
            <div className="mt-2 flex items-center gap-2 text-sm">
              <span>${(priceCents / 100).toFixed(0)}</span>
              {hasDiscount && <span className="opacity-40 line-through">${(product.price_cents / 100).toFixed(0)}</span>}
            </div>
          </div>

          {carousel.length > 1 && (
            <div className="grid grid-cols-5 gap-2">
              {carousel.map((c, i) => (
                <button
                  key={c.url + i}
                  onClick={() => setActiveIdx(i)}
                  className={`aspect-square overflow-hidden border ${i === activeIdx ? "border-current" : "border-transparent opacity-60 hover:opacity-100"}`}
                  title={c.label}
                >
                  <img src={c.url} alt={c.label} loading="lazy" className="h-full w-full object-contain" />
                </button>
              ))}
            </div>
          )}

          {colors.length > 0 && (
            <div>
              <p className="mb-2 text-[10px] uppercase tracking-[0.2em] opacity-50">Color</p>
              <div className="flex flex-wrap gap-2">
                {colors.map((c) => (
                  <button
                    key={c}
                    onClick={() => setColor(c)}
                    className={`px-3 py-1 text-[11px] uppercase tracking-[0.1em] transition ${c === color ? "bg-current text-[var(--background,#fff)]" : "border border-current/30 hover:border-current"}`}
                    style={c === color ? { color: "var(--background)" } : undefined}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>
          )}

          {sizes.length > 0 && (
            <div>
              <p className="mb-2 text-[10px] uppercase tracking-[0.2em] opacity-50">Size</p>
              <div className="flex flex-wrap gap-2">
                {sizes.map((s) => (
                  <button
                    key={s}
                    onClick={() => setSize(s)}
                    className={`min-w-[40px] px-2 py-1 text-[11px] uppercase tracking-[0.1em] transition ${s === size ? "bg-current text-[var(--background,#fff)]" : "border border-current/30 hover:border-current"}`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          <button
            onClick={addToCart}
            className="mt-auto w-full bg-current py-3 text-[11px] uppercase tracking-[0.25em]"
            style={{ color: "var(--background, #fff)" }}
          >
            Add to cart
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
