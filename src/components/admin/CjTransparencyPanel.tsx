// ─────────────────────────────────────────────────────────────
//  Admin · CJ "Make Transparent" bulk tool
//
//  CJ Dropshipping imports arrive as JPG photos on white/colored
//  backgrounds, which breaks the transparent-PNG Yeezy-style grid.
//  This panel runs @imgly/background-removal fully in the browser
//  (free, WASM) on the primary image of each selected CJ product,
//  uploads the resulting PNG to the public `product-media` bucket,
//  puts it FIRST in products.image_urls (keeping the original), and
//  upserts a primary/transparent product_media row.
//
//  RLS: writes go straight from the admin's browser session — the
//  "Admins can manage products" / "Admins manage product_media"
//  policies allow it. Storage needs the `product-media` bucket with
//  admin insert/update policies (see migration
//  20260703_product_media_bucket.sql).
// ─────────────────────────────────────────────────────────────

import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Wand2, Check, AlertTriangle, MinusCircle } from "lucide-react";
import { isOwnProductMediaUrl, isLikelyTransparentImage } from "@/lib/img";
import { processProductImages, type ProcessableProduct } from "@/lib/transparency-processing";
import { supplierNeedsTransparency } from "@/lib/suppliers";

export type CjPanelProduct = {
  id: string;
  title: string;
  image_urls: string[];
  variants?: any[] | null;
  source?: string | null;
};

type ItemPhase = "idle" | "processing" | "done" | "skipped" | "error";
type ItemState = { phase: ItemPhase; note?: string };

// ── Treated detection ──────────────────────────────────────────

/** Already treated? (own-storage transparent PNG sits first in image_urls) */
function primaryLooksTransparent(p: CjPanelProduct): boolean {
  const primary = p.image_urls?.[0];
  return !!primary && isOwnProductMediaUrl(primary) && isLikelyTransparentImage(primary);
}

// ── Panel ──────────────────────────────────────────────────────

export function CjTransparencyPanel({
  products,
  onUpdated,
}: {
  products: CjPanelProduct[];
  onUpdated: () => void;
}) {
  // Only suppliers whose photos need it (CJ today) get background removal —
  // Printful/print-on-demand ship transparent mockups already, and treating a
  // clean image can only degrade it. Add a supplier to TRANSPARENCY_SUPPLIERS
  // to extend this. Already-transparent images are additionally skipped at
  // process time.
  const allProducts = useMemo(
    () => products.filter((p) => !!p.id && supplierNeedsTransparency(p.source)),
    [products],
  );

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [states, setStates] = useState<Record<string, ItemState>>({});
  const [running, setRunning] = useState(false);
  const [transparentIds, setTransparentIds] = useState<Set<string>>(new Set());

  // Which CJ products already have a transparent primary in product_media.
  useEffect(() => {
    if (allProducts.length === 0) {
      setTransparentIds(new Set());
      return;
    }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("product_media")
        .select("product_id")
        .in(
          "product_id",
          allProducts.map((p) => p.id),
        )
        .eq("is_primary", true)
        .eq("is_transparent", true)
        .is("variant_key", null);
      if (!cancelled) setTransparentIds(new Set((data ?? []).map((r) => r.product_id)));
    })();
    return () => {
      cancelled = true;
    };
  }, [allProducts]);

  const isTreated = (p: CjPanelProduct) =>
    transparentIds.has(p.id) || primaryLooksTransparent(p);

  // Auto-sweep: as soon as the dashboard loads, quietly convert any untreated
  // product to a transparent primary — no clicking required. Runs once per
  // mount after the treated-set query resolves, so we never re-process items
  // that already have a transparent PNG. Manual buttons below still work for
  // re-runs. Guarded by a ref so re-renders don't kick off a second pass.
  const autoSweptRef = useRef(false);
  useEffect(() => {
    if (autoSweptRef.current || running || allProducts.length === 0) return;
    const untreated = allProducts.filter((p) => !isTreated(p));
    if (untreated.length === 0) return;
    autoSweptRef.current = true;
    void processProducts(untreated);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allProducts, transparentIds]);

  const setState = (id: string, s: ItemState) =>
    setStates((prev) => ({ ...prev, [id]: s }));

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleAll = () =>
    setSelected((prev) =>
      prev.size === allProducts.length
        ? new Set()
        : new Set(allProducts.map((p) => p.id)),
    );

  async function processProducts(targets: CjPanelProduct[]) {
    if (targets.length === 0) {
      toast.info("No products to process.");
      return;
    }
    setRunning(true);
    let productsTouched = 0;
    let imagesDone = 0;
    let imagesBad = 0;
    let imagesFailed = 0;

    // Loaded once and shared across every product so the (large) WASM bundle
    // downloads a single time per sweep.
    let removeBackground: (blob: Blob) => Promise<Blob>;
    try {
      const mod = await import("@imgly/background-removal");
      removeBackground = (blob) => mod.removeBackground(blob);
    } catch (e) {
      toast.error(
        "Could not load the background-removal engine: " + (e as Error).message,
      );
      setRunning(false);
      return;
    }

    for (const product of targets) {
      try {
        const summary = await processProductImages(
          product as ProcessableProduct,
          {
            removeBackground,
            onProgress: (p) => {
              const label =
                p.phase === "skipped"
                  ? "already transparent"
                  : p.phase === "bad"
                    ? `image ${p.index + 1}/${p.total}: low quality`
                    : `image ${p.index + 1}/${p.total} · ${p.note ?? p.phase}`;
              setState(product.id, { phase: "processing", note: label });
            },
          },
        );

        imagesDone += summary.processed;
        imagesBad += summary.bad;
        imagesFailed += summary.failed;

        if (summary.processed > 0) {
          setTransparentIds((prev) => new Set(prev).add(product.id));
          productsTouched++;
          setState(product.id, {
            phase: "done",
            note:
              summary.bad || summary.failed
                ? `${summary.processed} ok · ${summary.bad} flagged · ${summary.failed} failed`
                : undefined,
          });
        } else if (summary.total > 0 && summary.skipped === summary.total) {
          setState(product.id, { phase: "skipped", note: "already transparent" });
        } else if (summary.bad > 0 || summary.failed > 0) {
          setState(product.id, {
            phase: "error",
            note: `${summary.bad} low-quality · ${summary.failed} failed`,
          });
        } else {
          setState(product.id, { phase: "skipped", note: "no images" });
        }
      } catch (e) {
        imagesFailed++;
        const message = (e as Error).message || "unknown error";
        setState(product.id, { phase: "error", note: message });
        toast.error(`${product.title}: ${message}`);
      }
    }

    setRunning(false);
    if (imagesDone > 0) {
      toast.success(
        `Made ${imagesDone} image${imagesDone === 1 ? "" : "s"} transparent across ${productsTouched} product${productsTouched === 1 ? "" : "s"}.` +
          (imagesBad ? ` ${imagesBad} flagged low-quality.` : "") +
          (imagesFailed ? ` ${imagesFailed} failed.` : ""),
      );
      onUpdated();
    } else if (imagesBad === 0 && imagesFailed === 0) {
      toast.info("Nothing to do — all images are already transparent.");
    }
  }

  if (allProducts.length === 0) return null;

  const selectedProducts = allProducts.filter((p) => selected.has(p.id));

  return (
    <div className="border-b border-black">
      <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 bg-[#fafafa]">
        <div>
          <span className="text-[11px] tracking-[0.3em] uppercase font-bold">
            Product Images · Make Transparent
          </span>
          <p className="text-[10px] text-black/40 mt-1 tracking-wide">
            Removes backgrounds in your browser (first run downloads a ~40&nbsp;MB
            model), uploads a transparent PNG and makes it the primary image.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => processProducts(selectedProducts)}
            disabled={running || selectedProducts.length === 0}
            className="flex items-center gap-2 border border-black bg-black text-white px-4 py-2 text-[11px] tracking-widest uppercase hover:bg-white hover:text-black transition-colors disabled:opacity-30"
          >
            {running ? (
              <Loader2 size={11} className="animate-spin" />
            ) : (
              <Wand2 size={11} />
            )}
            Selected ({selectedProducts.length})
          </button>
          <button
            onClick={() => processProducts(allProducts)}
            disabled={running}
            className="flex items-center gap-2 border border-black px-4 py-2 text-[11px] tracking-widest uppercase hover:bg-black hover:text-white transition-colors disabled:opacity-30"
          >
            <Wand2 size={11} />
            All ({allProducts.length})
          </button>
        </div>
      </div>

      <div className="hidden md:grid grid-cols-[auto_auto_2fr_1fr] items-center gap-3 border-t border-black/10 px-6 py-2 bg-[#fafafa]">
        <input
          type="checkbox"
          checked={selected.size === allProducts.length && allProducts.length > 0}
          onChange={toggleAll}
          disabled={running}
          className="accent-black"
          aria-label="Select all products"
        />
        <span className="w-8" />
        <span className="text-[9px] tracking-[0.3em] uppercase text-black/30">
          Product
        </span>
        <span className="text-[9px] tracking-[0.3em] uppercase text-black/30">
          Status
        </span>
      </div>

      {allProducts.map((p) => {
        const state: ItemState = states[p.id] ?? {
          phase: isTreated(p) ? "skipped" : "idle",
          note: isTreated(p) ? "already transparent" : undefined,
        };
        const thumb = p.image_urls?.[0];
        return (
          <div
            key={p.id}
            className="grid grid-cols-[auto_auto_2fr_1fr] items-center gap-3 border-t border-black/10 px-6 py-2.5 hover:bg-black/[0.015]"
          >
            <input
              type="checkbox"
              checked={selected.has(p.id)}
              onChange={() => toggle(p.id)}
              disabled={running}
              className="accent-black"
              aria-label={`Select ${p.title}`}
            />
            <span className="flex h-8 w-8 items-center justify-center overflow-hidden border border-black/10 bg-[repeating-conic-gradient(#eee_0%_25%,#fff_0%_50%)] bg-[length:10px_10px]">
              {thumb ? (
                <img
                  src={thumb}
                  alt=""
                  className="max-h-full max-w-full object-contain"
                  loading="lazy"
                />
              ) : (
                <MinusCircle size={12} className="text-black/20" />
              )}
            </span>
            <span className="truncate text-[12px] tracking-wide">{p.title}</span>
            <StatusBadge state={state} />
          </div>
        );
      })}
    </div>
  );
}

function StatusBadge({ state }: { state: ItemState }) {
  switch (state.phase) {
    case "processing":
      return (
        <span className="flex items-center gap-1.5 text-[10px] tracking-widest uppercase text-black/60">
          <Loader2 size={10} className="animate-spin" /> {state.note ?? "working"}
        </span>
      );
    case "done":
      return (
        <span className="flex items-center gap-1.5 text-[10px] tracking-widest uppercase text-emerald-700">
          <Check size={10} /> Transparent
        </span>
      );
    case "skipped":
      return (
        <span className="flex items-center gap-1.5 text-[10px] tracking-widest uppercase text-black/35">
          <Check size={10} /> {state.note ?? "skipped"}
        </span>
      );
    case "error":
      return (
        <span
          className="flex items-center gap-1.5 text-[10px] tracking-widest uppercase text-red-600"
          title={state.note}
        >
          <AlertTriangle size={10} />
          <span className="truncate">{state.note ?? "failed"}</span>
        </span>
      );
    default:
      return (
        <span className="text-[10px] tracking-widest uppercase text-black/25">
          Untreated
        </span>
      );
  }
}
