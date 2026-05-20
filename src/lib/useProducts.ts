import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export type UseProductsOptions = { onlyPublished?: boolean };

export async function fetchProducts({ onlyPublished = true }: UseProductsOptions = {}) {
  let q = supabase.from("products").select("*").order("created_at", { ascending: false });
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
    window.addEventListener("productsUpdated", onUpdate);
    return () => window.removeEventListener("productsUpdated", onUpdate);
  }, [load]);

  return { products, loading, refresh: load } as const;
}
