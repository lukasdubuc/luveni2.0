// ─────────────────────────────────────────────────────────────
//  Luveni — product media hook (storefront)
//  Reads public.product_media for a published product. RLS already
//  restricts anon reads to media of published, non-archived products.
// ─────────────────────────────────────────────────────────────

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type MediaViewType =
  | "front_flat" | "back_flat" | "side_flat" | "sleeve"
  | "model" | "lifestyle" | "detail" | "other";

export interface ProductMedia {
  id: string;
  variant_key: string | null;
  view_type: MediaViewType;
  url: string;
  is_primary: boolean;
  is_transparent: boolean;
  position: number;
  hidden?: boolean;
  metadata?: { original_url?: string | null; quality_ok?: boolean } | null;
}

export function useProductMedia(productId: string | undefined) {
  const [media, setMedia] = useState<ProductMedia[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!productId) { setMedia([]); return; }
    let cancelled = false;
    setLoading(true);
    (async () => {
      const { data, error } = await (supabase as any)
        .from("product_media")
        .select("id, variant_key, view_type, url, is_primary, is_transparent, position, hidden, metadata")
        .eq("product_id", productId)
        .order("position", { ascending: true });
      if (cancelled) return;
      if (error) { console.warn("useProductMedia:", error.message); setMedia([]); }
      else setMedia((data ?? []) as ProductMedia[]);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [productId]);

  return { media, loading };
}
