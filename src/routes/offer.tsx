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

export const Route = createFileRoute("/offer")({
  loader: async ({ params }: any) => {
    const slug = params?.slug as string | undefined;
    if (slug) {
      const { data: product } = await supabase
        .from("products")
        .select("*")
        .eq("slug", slug)
        .eq("is_published", true)
        .maybeSingle();
      return { product: product ?? null };
    }

    // First, try to find a featured product (newest if multiple)
    const { data: featuredProducts } = await supabase
      .from("products")
      .select("*")
      .eq("is_published", true)
      .eq("is_featured", true)
      .order("created_at", { ascending: false })
      .limit(1);

    if (featuredProducts && featuredProducts.length > 0) {
      return { product: featuredProducts[0] };
    }

    // Fallback: get the newest published product
    const { data: products } = await supabase
      .from("products")
      .select("*")
      .eq("is_published", true)
      .order("created_at", { ascending: false })
      .limit(1);

    return { product: products?.[0] ?? null };
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
  component: OfferPage,
});

function OfferPage() {
  const { product } = Route.useLoaderData();
  const products = product ? [product] : [];
  const variants = Array.isArray(product?.variants) ? (product.variants as ProductVariant[]) : [];
  const optionKeys = useMemo(
    () => Array.from(new Set(variants.flatMap((variant) => Object.keys(variant.attributes ?? {})))),
    [variants],
  );

  const [selection, setSelection] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!product) {
      setSelection({});
      return;
    }

    if (variants.length === 0) {
      setSelection({});
      return;
    }

    const defaultSelection: Record<string, string> = {};
    optionKeys.forEach((key) => {
      const values = Array.from(
        new Set(variants.map((variant) => variant.attributes?.[key]).filter(Boolean)),
      ) as string[];
      if (values.length > 0) defaultSelection[key] = values[0];
    });

    setSelection((current) => (Object.keys(current).length ? current : defaultSelection));
  }, [product?.id, optionKeys.join("|"), variants]);

  const selectedVariant = useMemo(() => {
    if (variants.length === 0) return undefined;
    return variants.find((variant) =>
      optionKeys.every((key) => variant.attributes?.[key] === selection[key]),
    );
  }, [variants, optionKeys, selection]);

  const buildOptionAvailability = (option: string, value: string) => {
    if (variants.length === 0) return false;
    return variants.some((variant) => {
      if (variant.attributes?.[option] !== value) return false;
      if ((variant.stock ?? 0) <= 0) return false;
      return optionKeys.every((key) => {
        if (key === option) return true;
        return !selection[key] || variant.attributes?.[key] === selection[key];
      });
    });
  };

  const selectedPrice = selectedVariant?.price_cents ?? product?.price_cents;
  const checkoutHref = product
    ? `/checkout?productId=${encodeURIComponent(product.id)}${selectedVariant?.sku ? `&variantSku=${encodeURIComponent(selectedVariant.sku)}` : ""}`
    : "/checkout";
  const checkoutDisabled = variants.length > 0 && !selectedVariant;
  const stockMessage = selectedVariant
    ? (selectedVariant.stock ?? 0) > 0
      ? `In stock · ${selectedVariant.stock} available`
      : "Sold out"
    : variants.length > 0
      ? "Select your variant"
      : "In stock";

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
        </div>
      </section>

      {product && variants.length > 0 && (
        <section className="bg-white py-10">
          <div className="mx-auto max-w-7xl px-4">
            <div className="border border-black/10 bg-white p-6">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-black">Product variants</p>
                  <p className="mt-2 text-sm text-black/55">Choose from the supplier’s available options.</p>
                </div>
                <div className="text-right text-sm font-medium text-black">
                  {selectedPrice != null ? `$${(selectedPrice / 100).toFixed(2)}` : "Price pending"}
                  <div className="text-xs text-black/55">{stockMessage}</div>
                </div>
              </div>

              <div className="mt-8 space-y-6">
                {optionKeys.map((option) => {
                  const values = Array.from(
                    new Set(variants.map((variant) => variant.attributes?.[option]).filter(Boolean)),
                  ) as string[];
                  return (
                    <div key={option} className="space-y-3">
                      <div className="flex items-center justify-between text-sm font-semibold text-black uppercase tracking-[0.2em]">
                        <span>{option}</span>
                        <span className="text-xs text-black/55">{selection[option] || "Choose"}</span>
                      </div>
                      <div className="flex flex-wrap gap-3">
                        {values.map((value) => {
                          const isSelected = selection[option] === value;
                          const available = buildOptionAvailability(option, value);
                          return (
                            <button
                              key={value}
                              type="button"
                              onClick={() => setSelection((current) => ({ ...current, [option]: value }))}
                              disabled={!available}
                              className={`border px-4 py-2 text-sm transition ${isSelected ? "border-black bg-black text-white" : "border-black/10 bg-white text-black hover:border-black"} ${!available ? "cursor-not-allowed opacity-50" : ""}`}
                            >
                              {value}
                              {!available && " · Sold out"}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-black/55">
                  {selectedVariant?.fulfillment_provider
                    ? `Fulfilled by ${selectedVariant.fulfillment_provider}`
                    : product.fulfillment_provider
                      ? `Fulfilled by ${product.fulfillment_provider}`
                      : "Fulfillment provider not set"}
                </p>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <a
                    href={checkoutHref}
                    className={`inline-flex items-center justify-center border border-black bg-black px-6 py-3 text-sm font-semibold text-white transition hover:bg-white hover:text-black ${checkoutDisabled ? "pointer-events-none opacity-50" : "hover:bg-white hover:text-black"}`}
                  >
                    {checkoutDisabled ? "Select a variant" : selectedVariant ? "Checkout this variant" : "Checkout"}
                  </a>
                  {selectedVariant?.sku && (
                    <span className="text-xs uppercase tracking-[0.2em] text-black/55">SKU: {selectedVariant.sku}</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      <OfferSection products={products} checkoutHref={checkoutHref} checkoutDisabled={checkoutDisabled} />
      <Testimonials />
      <FAQ />
      <CTASection />
    </>
  );
}
