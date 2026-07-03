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

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Wand2, Check, AlertTriangle, MinusCircle } from "lucide-react";
import {
  PRODUCT_MEDIA_BUCKET,
  isOwnProductMediaUrl,
  isLikelyTransparentImage,
} from "@/lib/img";

export type CjPanelProduct = {
  id: string;
  title: string;
  image_urls: string[];
  source?: string | null;
};

type ItemPhase = "idle" | "processing" | "done" | "skipped" | "error";
type ItemState = { phase: ItemPhase; note?: string };

// ── Image helpers ──────────────────────────────────────────────

/**
 * Fetch a vendor image as a Blob. Tries the CDN directly first; if the
 * host blocks cross-origin reads, falls back to the wsrv.nl image proxy
 * (the same CORS-dodging proxy the storefront already uses for Printful).
 */
async function fetchImageBlob(url: string): Promise<Blob> {
  try {
    const res = await fetch(url, { mode: "cors" });
    if (res.ok) return await res.blob();
  } catch {
    /* fall through to proxy */
  }
  const proxied = `https://wsrv.nl/?url=${encodeURIComponent(url)}&n=-1`;
  const res = await fetch(proxied);
  if (!res.ok) throw new Error(`Could not fetch source image (HTTP ${res.status})`);
  return await res.blob();
}

/** First image that is not one of our own already-processed uploads. */
function pickSourceImage(p: CjPanelProduct): string | null {
  const urls = Array.isArray(p.image_urls) ? p.image_urls.filter(Boolean) : [];
  return urls.find((u) => !isOwnProductMediaUrl(u)) ?? urls[0] ?? null;
}

/** Already treated? (own-storage transparent PNG sits first in image_urls) */
function primaryLooksTransparent(p: CjPanelProduct): boolean {
  const primary = p.image_urls?.[0];
  return !!primary && isOwnProductMediaUrl(primary) && isLikelyTransparentImage(primary);
}

// ── Storage upload (create-if-missing bucket) ──────────────────

async function uploadTransparentPng(productId: string, png: Blob): Promise<string> {
  const path = `products/${productId}/transparent-${Date.now()}.png`;
  const storage = supabase.storage;

  let { error } = await storage
    .from(PRODUCT_MEDIA_BUCKET)
    .upload(path, png, { upsert: true, contentType: "image/png" });

  if (error && /bucket.*not.*found/i.test(error.message)) {
    // Best effort: create the public bucket, then retry. Bucket creation is
    // usually reserved for the service role — if it fails, apply migration
    // 20260703_product_media_bucket.sql (or create the bucket in the
    // dashboard) and re-run.
    const { error: createErr } = await storage.createBucket(PRODUCT_MEDIA_BUCKET, {
      public: true,
    });
    if (createErr) {
      throw new Error(
        `Storage bucket "${PRODUCT_MEDIA_BUCKET}" is missing and could not be created from the browser (${createErr.message}). Apply migration 20260703_product_media_bucket.sql.`,
      );
    }
    ({ error } = await storage
      .from(PRODUCT_MEDIA_BUCKET)
      .upload(path, png, { upsert: true, contentType: "image/png" }));
  }
  if (error) throw new Error(`Upload failed: ${error.message}`);

  const {
    data: { publicUrl },
  } = storage.from(PRODUCT_MEDIA_BUCKET).getPublicUrl(path);
  return publicUrl;
}

// ── DB writes ──────────────────────────────────────────────────

async function persistTransparentImage(
  product: CjPanelProduct,
  publicUrl: string,
  sourceUrl: string,
) {
  // 1. products.image_urls — transparent PNG first, original kept after it.
  const rest = (product.image_urls ?? []).filter((u) => u && u !== publicUrl);
  const { error: prodErr } = await supabase
    .from("products")
    .update({ image_urls: [publicUrl, ...rest] })
    .eq("id", product.id);
  if (prodErr) throw new Error(`products update failed: ${prodErr.message}`);

  // 2. Demote the previous primary product-level media rows.
  const { error: demoteErr } = await supabase
    .from("product_media")
    .update({ is_primary: false })
    .eq("product_id", product.id)
    .eq("is_primary", true)
    .is("variant_key", null)
    .neq("url", publicUrl);
  if (demoteErr) throw new Error(`product_media demote failed: ${demoteErr.message}`);

  // 3. Upsert the new primary row. The table's unique key includes the
  //    nullable variant_key (NULLs never conflict), so upsert manually.
  const row = {
    view_type: "front_flat",
    is_primary: true,
    is_transparent: true,
    position: 0,
    source: "cj",
    metadata: { generated_by: "imgly-background-removal", original_url: sourceUrl },
  };
  const { data: existing, error: selErr } = await supabase
    .from("product_media")
    .select("id")
    .eq("product_id", product.id)
    .eq("url", publicUrl)
    .is("variant_key", null)
    .maybeSingle();
  if (selErr) throw new Error(`product_media lookup failed: ${selErr.message}`);

  const { error: upsertErr } = existing
    ? await supabase.from("product_media").update(row).eq("id", existing.id)
    : await supabase
        .from("product_media")
        .insert([{ product_id: product.id, variant_key: null, url: publicUrl, ...row }]);
  if (upsertErr) throw new Error(`product_media upsert failed: ${upsertErr.message}`);
}

// ── Panel ──────────────────────────────────────────────────────

export function CjTransparencyPanel({
  products,
  onUpdated,
}: {
  products: CjPanelProduct[];
  onUpdated: () => void;
}) {
  const cjProducts = useMemo(
    () => products.filter((p) => (p.source ?? "") === "cj"),
    [products],
  );

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [states, setStates] = useState<Record<string, ItemState>>({});
  const [running, setRunning] = useState(false);
  const [transparentIds, setTransparentIds] = useState<Set<string>>(new Set());

  // Which CJ products already have a transparent primary in product_media.
  useEffect(() => {
    if (cjProducts.length === 0) {
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
          cjProducts.map((p) => p.id),
        )
        .eq("is_primary", true)
        .eq("is_transparent", true)
        .is("variant_key", null);
      if (!cancelled) setTransparentIds(new Set((data ?? []).map((r) => r.product_id)));
    })();
    return () => {
      cancelled = true;
    };
  }, [cjProducts]);

  const isTreated = (p: CjPanelProduct) =>
    transparentIds.has(p.id) || primaryLooksTransparent(p);

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
      prev.size === cjProducts.length
        ? new Set()
        : new Set(cjProducts.map((p) => p.id)),
    );

  async function processProducts(targets: CjPanelProduct[]) {
    if (targets.length === 0) {
      toast.info("No CJ products to process.");
      return;
    }
    setRunning(true);
    let done = 0;
    let skipped = 0;
    let failed = 0;

    // Loaded lazily so the (large) WASM bundle never ships with the page.
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
      if (isTreated(product)) {
        skipped++;
        setState(product.id, { phase: "skipped", note: "already transparent" });
        continue;
      }
      const sourceUrl = pickSourceImage(product);
      if (!sourceUrl) {
        failed++;
        setState(product.id, { phase: "error", note: "no source image" });
        continue;
      }
      try {
        setState(product.id, { phase: "processing", note: "fetching image" });
        const blob = await fetchImageBlob(sourceUrl);

        setState(product.id, { phase: "processing", note: "removing background" });
        const png = await removeBackground(blob);

        setState(product.id, { phase: "processing", note: "uploading PNG" });
        const publicUrl = await uploadTransparentPng(product.id, png);

        setState(product.id, { phase: "processing", note: "saving" });
        await persistTransparentImage(product, publicUrl, sourceUrl);

        setTransparentIds((prev) => new Set(prev).add(product.id));
        setState(product.id, { phase: "done" });
        done++;
      } catch (e) {
        failed++;
        const message = (e as Error).message || "unknown error";
        setState(product.id, { phase: "error", note: message });
        toast.error(`${product.title}: ${message}`);
      }
    }

    setRunning(false);
    if (done > 0) {
      toast.success(
        `Made ${done} product image${done === 1 ? "" : "s"} transparent.` +
          (skipped ? ` ${skipped} skipped.` : "") +
          (failed ? ` ${failed} failed.` : ""),
      );
      onUpdated();
    } else if (failed === 0) {
      toast.info("Nothing to do — all selected products are already transparent.");
    }
  }

  if (cjProducts.length === 0) return null;

  const selectedProducts = cjProducts.filter((p) => selected.has(p.id));

  return (
    <div className="border-b border-black">
      <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 bg-[#fafafa]">
        <div>
          <span className="text-[11px] tracking-[0.3em] uppercase font-bold">
            CJ Images · Make Transparent
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
            onClick={() => processProducts(cjProducts)}
            disabled={running}
            className="flex items-center gap-2 border border-black px-4 py-2 text-[11px] tracking-widest uppercase hover:bg-black hover:text-white transition-colors disabled:opacity-30"
          >
            <Wand2 size={11} />
            All CJ ({cjProducts.length})
          </button>
        </div>
      </div>

      <div className="hidden md:grid grid-cols-[auto_auto_2fr_1fr] items-center gap-3 border-t border-black/10 px-6 py-2 bg-[#fafafa]">
        <input
          type="checkbox"
          checked={selected.size === cjProducts.length && cjProducts.length > 0}
          onChange={toggleAll}
          disabled={running}
          className="accent-black"
          aria-label="Select all CJ products"
        />
        <span className="w-8" />
        <span className="text-[9px] tracking-[0.3em] uppercase text-black/30">
          Product
        </span>
        <span className="text-[9px] tracking-[0.3em] uppercase text-black/30">
          Status
        </span>
      </div>

      {cjProducts.map((p) => {
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
