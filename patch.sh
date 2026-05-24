#!/bin/bash
cat << 'FILE_CONTENT' > src/routes/'offer.$slug.tsx'
/**
 * @LOCK_PROTOCOL_ACTIVE
 */
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { fetchProducts } from "@/lib/useProducts";
import { offer } from "@/config/site";

type ProductVariant = { sku: string; stock?: number; price_cents?: number; external_sku?: string; fulfillment_provider?: string; attributes?: Record<string, string>; };
type Product = { id: string; title: string; slug: string; price_cents: number; discounted_price_cents?: number | null; image_urls: string[]; description?: string | null; variants?: ProductVariant[]; bullet_points?: string[]; is_published?: boolean; };

export const Route = createFileRoute("/offer/$slug")({
  loader: async ({ params }) => {
    const { data } = await supabase.from("products").select("*").eq("slug", params.slug).eq("is_published", true).maybeSingle();
    return { product: data ?? null };
  },
  component: OfferSlugPage,
});

function OfferSlugPage() {
  const { product } = Route.useLoaderData() as { product: Product | null };
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  useEffect(() => { fetchProducts({ onlyPublished: true }).then(setAllProducts); }, []);
  return <div>{/* UI Placeholder */}</div>;
}
FILE_CONTENT
