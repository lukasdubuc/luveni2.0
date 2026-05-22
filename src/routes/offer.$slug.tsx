import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { OfferSection } from "@/components/site/OfferSection";
import { Testimonials } from "@/components/site/Testimonials";
import { FAQ } from "@/components/site/FAQ";
import { CTASection } from "@/components/site/CTASection";
import { supabase } from "@/integrations/supabase/client";
import { offer } from "@/config/site";

type ProductVariant = {
  sku: string;
  stock?: number;
  price_cents?: number;
  external_sku?: string;
  fulfillment_provider?: string;
  attributes?: Record<string, string>;
};

export const Route = createFileRoute("/offer/$slug")({
  loader: async ({ params }) => {
    const { data: product } = await supabase
      .from("products")
      .select("*")
      .eq("slug", params.slug)
      .eq("is_published", true)
      .maybeSingle();
    return { product: product ?? null };
  },
  head: ({ loaderData }: any) => {
    const product = loaderData?.product;
    const title = product?.title ?? offer.name;
    const description = product?.description ?? offer.shortPitch;
    return {
      meta: [
        { title: `${title} — Northwind` },
        { name: "description", content: description },
        { property: "og:title", content: `${title} — Northwind` },
        { property: "og:description", content: description },
      ],
    };
  },
  component: OfferSlugPage,
});

function OfferSlugPage() {
  const { product } = Route.useLoaderData() as { product: any };
  const products = product ? [product] : [];
  const variants: ProductVariant[] = Array.isArray(product?.variants) ? product.variants : [];
  const optionKeys = useMemo(
    () => Array.from(new Set(variants.flatMap((v) => Object.keys(v.attributes ?? {})))),
    [variants],
  );

  const [selection, setSelection] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!product || variants.length === 0) {
      setSelection({});
      return;
    }
    const defaults: Record<string, string> = {};
    optionKeys.forEach((key) => {
      const values = Array.from(
        new Set(variants.map((v) => v.attributes?.[key]).filter(Boolean)),
      ) as string[];
      if (values.length) defaults[key] = values[0];
    });
    setSelection((current) => (Object.keys(current).length ? current : defaults));
  }, [product?.id, optionKeys.join("|"), variants]);

  const selectedVariant = useMemo(() => {
    if (!variants.length) return undefined;
    return variants.find((v) => optionKeys.every((k) => v.attributes?.[k] === selection[k]));
  }, [variants, optionKeys, selection]);

  const selectedPrice = selectedVariant?.price_cents ?? product?.price_cents;
  const checkoutHref = product
    ? `/checkout?productId=${encodeURIComponent(product.id)}${selectedVariant?.sku ? `&variantSku=${encodeURIComponent(selectedVariant.sku)}` : ""}`
    : "/checkout";
  const checkoutDisabled = variants.length > 0 && !selectedVariant;

  return (
    <>
      <section className="border-b border-black/10 bg-white">
        <div className="mx-auto max-w-3xl px-4 py-20 text-center">
          <p className="text-sm font-medium uppercase tracking-wider text-black">The offer</p>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight md:text-5xl">
            {product?.title || offer.name}
          </h1>
          <p className="mt-4 text-lg text-black/55">
            {product?.description || offer.shortPitch}
          </p>
          {selectedPrice != null && (
            <p className="mt-6 text-2xl font-semibold tracking-tight text-black">
              ${(selectedPrice / 100).toFixed(2)}
            </p>
          )}
        </div>
      </section>

      <OfferSection products={products} checkoutHref={checkoutHref} checkoutDisabled={checkoutDisabled} />
      <Testimonials />
      <FAQ />
      <CTASection />
    </>
  );
}
