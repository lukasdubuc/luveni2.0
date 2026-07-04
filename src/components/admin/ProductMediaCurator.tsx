// ─────────────────────────────────────────────────────────────
//  Luveni — per-product photo curator (admin)
//
//  The transparency pipeline auto-decides which photos are "good", but CJ
//  imagery ships near-identical shots and photos that resist background
//  removal. This panel lets the owner eyeball every photo and uncheck the
//  bad/duplicate ones — the storefront (useDisplayImages) reads the same
//  product_media.hidden flag, so unchecking a photo here removes it from
//  the shop grid, offer gallery and modal instantly.
//
//  Each product_media row is one source photo. We show the customer-facing
//  render (the transparent cutout when it graded good, otherwise the
//  original opaque photo the storefront falls back to) so what the owner
//  sees here is exactly what shoppers see.
// ─────────────────────────────────────────────────────────────

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Star, RefreshCw } from "lucide-react";
import { proxyImageUrl, isLikelyTransparentImage } from "@/lib/img";

/* eslint-disable @typescript-eslint/no-explicit-any */

interface MediaRow {
  id: string;
  url: string;
  is_primary: boolean;
  is_transparent: boolean;
  position: number;
  hidden: boolean;
  curated?: boolean;
  metadata?: { original_url?: string | null; quality_ok?: boolean } | null;
}

/** What the shopper actually sees for a row: the good cutout, else the
 *  original opaque photo (which the storefront frames). */
function renderUrl(m: MediaRow): string {
  const good = m.is_transparent && m.metadata?.quality_ok !== false;
  const raw = good ? m.url : (m.metadata?.original_url || m.url);
  return proxyImageUrl(raw);
}

export function ProductMediaCurator({
  productId,
  onChanged,
}: {
  productId: string;
  onChanged?: () => void;
}) {
  const [rows, setRows] = useState<MediaRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("product_media")
      .select("id, url, is_primary, is_transparent, position, hidden, metadata")
      .eq("product_id", productId)
      .order("is_primary", { ascending: false })
      .order("position", { ascending: true });
    setRows((data ?? []) as unknown as MediaRow[]);
    setLoading(false);
  }, [productId]);

  useEffect(() => { load(); }, [load]);

  // Rewrite products.image_urls to the visible, ordered, transparent-preferred
  // list so the shop grid thumbnail (which reads image_urls[0]) stays in sync
  // with what the owner curated here.
  const syncImageUrls = useCallback(async (next: MediaRow[]) => {
    const visible = next.filter((m) => !m.hidden);
    const urls: string[] = [];
    const seen = new Set<string>();
    const ordered = [...visible].sort((a, b) =>
      a.is_primary === b.is_primary ? a.position - b.position : a.is_primary ? -1 : 1,
    );
    for (const m of ordered) {
      const u = renderUrl(m);
      if (!seen.has(u)) { seen.add(u); urls.push(u); }
    }
    if (urls.length > 0) {
      await supabase.from("products").update({ image_urls: urls }).eq("id", productId);
      window.dispatchEvent(new Event("productsUpdated"));
    }
  }, [productId]);

  const toggleHidden = async (row: MediaRow) => {
    setBusy(row.id);
    const next = rows.map((r) => (r.id === row.id ? { ...r, hidden: !r.hidden, curated: true } : r));
    setRows(next);
    const { error } = await supabase
      .from("product_media")
      .update({ hidden: !row.hidden, curated: true } as any)
      .eq("id", row.id);
    if (error) { toast.error("Update failed: " + error.message); load(); }
    else { await syncImageUrls(next); onChanged?.(); }
    setBusy(null);
  };

  const makePrimary = async (row: MediaRow) => {
    if (row.hidden) { toast.error("Show the photo before making it primary."); return; }
    setBusy(row.id);
    const next = rows.map((r) => ({ ...r, is_primary: r.id === row.id }));
    setRows(next);
    // One primary per product: clear the rest, set this one.
    await supabase.from("product_media").update({ is_primary: false } as any).eq("product_id", productId);
    const { error } = await supabase.from("product_media").update({ is_primary: true, curated: true } as any).eq("id", row.id);
    if (error) { toast.error("Update failed: " + error.message); load(); }
    else { await syncImageUrls(next); onChanged?.(); }
    setBusy(null);
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-1 py-4 text-[10px] uppercase tracking-widest text-black/30">
        <Loader2 size={12} className="animate-spin" /> Loading photos…
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="px-1 py-4 text-[10px] uppercase tracking-widest text-black/25">
        No processed photos yet — publish or run the transparency sweep first.
      </div>
    );
  }

  const visibleCount = rows.filter((r) => !r.hidden).length;

  return (
    <div className="px-1 py-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-[10px] tracking-[0.25em] uppercase text-black/40">
          Photos — {visibleCount} shown / {rows.length} total
        </span>
        <button
          onClick={load}
          className="flex items-center gap-1 text-[9px] uppercase tracking-widest text-black/30 hover:text-black"
        >
          <RefreshCw size={10} /> Refresh
        </button>
      </div>

      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
        {rows.map((m) => {
          const url = renderUrl(m);
          const transparent = isLikelyTransparentImage(url);
          return (
            <div key={m.id} className="flex flex-col gap-1.5">
              <button
                type="button"
                onClick={() => toggleHidden(m)}
                disabled={busy === m.id}
                title={m.hidden ? "Hidden — click to show" : "Shown — click to hide"}
                className={`relative aspect-square overflow-hidden border transition ${
                  m.hidden ? "border-black/10 opacity-30 grayscale" : "border-black/60"
                }`}
              >
                <img
                  src={url}
                  alt="product photo"
                  loading="lazy"
                  className={`h-full w-full object-contain ${transparent ? "" : "bg-white p-1"}`}
                />
                {/* Checkbox indicator */}
                <span
                  className={`absolute left-1 top-1 flex h-4 w-4 items-center justify-center border text-[10px] font-bold leading-none ${
                    m.hidden ? "border-black/20 bg-white/70 text-transparent" : "border-black bg-black text-white"
                  }`}
                >
                  ✓
                </span>
                {m.is_primary && !m.hidden && (
                  <span className="absolute right-1 top-1 text-black">
                    <Star size={12} fill="currentColor" />
                  </span>
                )}
                {!(m.is_transparent && m.metadata?.quality_ok !== false) && (
                  <span className="absolute bottom-0 left-0 right-0 bg-black/70 py-0.5 text-center text-[7px] uppercase tracking-widest text-white">
                    original
                  </span>
                )}
                {busy === m.id && (
                  <span className="absolute inset-0 flex items-center justify-center bg-white/60">
                    <Loader2 size={14} className="animate-spin" />
                  </span>
                )}
              </button>
              {!m.hidden && !m.is_primary && (
                <button
                  type="button"
                  onClick={() => makePrimary(m)}
                  disabled={busy === m.id}
                  className="text-[8px] uppercase tracking-widest text-black/30 hover:text-black"
                >
                  Set primary
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
