import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export type UseProductsOptions = { onlyPublished?: boolean };

export const PUBLIC_PRODUCT_COLUMNS =
  "id, slug, title, description, price_cents, price_cents_discounted, currency, image_urls, is_published, is_archived, display_order, variants, created_at, updated_at";

export async function fetchProducts({ onlyPublished = true }: UseProductsOptions = {}) {
  // Query the public-safe view to avoid exposing internal fulfillment columns to anon users.
  let q = (supabase as any).from("products_public").select(PUBLIC_PRODUCT_COLUMNS).order("created_at", { ascending: false });
  if (onlyPublished) q = q.eq("is_published", true);
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

export function useProducts(opts: UseProductsOptions = { onlyPublished: true }) {
  const { onlyPublished = true } = opts;
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const results = await fetchProducts({ onlyPublished });
      setProducts(results);
    } catch (e) {
      console.warn("useProducts: fetch error", e);
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, [onlyPublished]);

  useEffect(() => {
    load();
    const onUpdate = () => load();
    // Refetch when the visitor returns to the tab/window and on a light
    // interval, so catalog changes from the live inventory heartbeat show
    // up without a manual refresh. (Anon realtime is blocked by RLS, so we
    // poll rather than subscribe for the public shop.)
    const onVisible = () => { if (document.visibilityState === "visible") load(); };
    window.addEventListener("productsUpdated", onUpdate);
    window.addEventListener("focus", onUpdate);
    document.addEventListener("visibilitychange", onVisible);
    const poll = setInterval(() => {
      if (document.visibilityState === "visible") load();
    }, 120000);
    return () => {
      window.removeEventListener("productsUpdated", onUpdate);
      window.removeEventListener("focus", onUpdate);
      document.removeEventListener("visibilitychange", onVisible);
      clearInterval(poll);
    };
  }, [load]);

  return { products, loading, refresh: load } as const;
}
