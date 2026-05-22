import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
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
        { title: `${title}` },
        { name: "description", content: description },
        { property: "og:title", content: `${title}` },
        { property: "og:description", content: description },
      ],
    };
  },
  component: OfferSlugPage,
});

function normalizeOptionName(key: string) {
  const lower = key.toLowerCase();
  if (lower === "size") return "SIZE";
  if (lower === "color" || lower === "colour") return "COLOR";
  return key.toUpperCase();
}

function sortOptionKeys(keys: string[]) {
  const priority = ["size", "color", "colour"];
  return [...keys].sort((a, b) => {
    const ai = priority.indexOf(a.toLowerCase());
    const bi = priority.indexOf(b.toLowerCase());
    if (ai !== -1 || bi !== -1) return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    return a.localeCompare(b);
  });
}

function formatPrice(cents?: number | null) {
  if (cents == null) return "PRICE PENDING";
  return `$${(cents / 100).toFixed(2)}`;
}

function OfferSlugPage() {
  const { product } = Route.useLoaderData() as { product: any };
  const variants: ProductVariant[] = useMemo(
    () => (Array.isArray(product?.variants) ? product.variants : []),
    [product?.variants],
  );
  const images: string[] = useMemo(
    () => (Array.isArray(product?.image_urls) ? product.image_urls.filter((image: string) => Boolean(image)) : []),
    [product?.image_urls],
  );
  const galleryImages = useMemo(() => (images.length > 0 ? images : [""]), [images]);

  const optionKeys = useMemo(
    () => sortOptionKeys(Array.from(new Set(variants.flatMap((variant) => Object.keys(variant.attributes ?? {}))))),
    [variants],
  );

  const optionValues = useMemo(() => {
    return optionKeys.reduce<Record<string, string[]>>((acc, key) => {
      acc[key] = Array.from(
        new Set(variants.map((variant) => variant.attributes?.[key]).filter(Boolean)),
      ) as string[];
      return acc;
    }, {});
  }, [optionKeys, variants]);

  const [selection, setSelection] = useState<Record<string, string>>({});
  const [activeImageIndex, setActiveImageIndex] = useState(0);

  useEffect(() => {
    if (!product || variants.length === 0) {
      setSelection({});
      return;
    }

    const defaults: Record<string, string> = {};
    optionKeys.forEach((key) => {
      const firstValue = optionValues[key]?.[0];
      if (firstValue) defaults[key] = firstValue;
    });

    setSelection((current) => {
      const hasValidSelection = optionKeys.every((key) => current[key]);
      return hasValidSelection ? current : defaults;
    });
  }, [product?.id, optionKeys, optionValues, variants.length]);

  const selectedVariant = useMemo(() => {
    if (!variants.length) return undefined;
    return variants.find((variant) =>
      optionKeys.every((key) => variant.attributes?.[key] === selection[key]),
    );
  }, [variants, optionKeys, selection]);

  const isOptionAvailable = (option: string, value: string) => {
    if (variants.length === 0) return true;
    return variants.some((variant) => {
      if (variant.attributes?.[option] !== value) return false;
      if (variant.stock != null && variant.stock <= 0) return false;
      return optionKeys.every((key) => {
        if (key === option) return true;
        return !selection[key] || variant.attributes?.[key] === selection[key];
      });
    });
  };

  const selectedPrice = selectedVariant?.price_cents ?? product?.discounted_price_cents ?? product?.price_cents;
  const checkoutHref = product
    ? `/checkout?productId=${encodeURIComponent(product.id)}${selectedVariant?.sku ? `&variantSku=${encodeURIComponent(selectedVariant.sku)}` : ""}`
    : "/checkout";
  const checkoutDisabled = variants.length > 0 && !selectedVariant;
  const stockMessage = selectedVariant
    ? selectedVariant.stock != null && selectedVariant.stock <= 0
      ? "SOLD OUT"
      : "IN STOCK"
    : variants.length > 0
      ? "SELECT OPTIONS"
      : "IN STOCK";

  if (!product) {
    return (
      <section className="min-h-screen bg-white px-4 py-24 text-black">
        <div className="mx-auto max-w-xl text-center">
          <p className="text-xs font-bold uppercase tracking-[0.35em]">Product unavailable</p>
          <h1 className="mt-4 text-4xl font-black uppercase tracking-[-0.04em]">Offer not found</h1>
          <p className="mt-4 text-sm text-black/60">This product is not published or no longer exists.</p>
          <a href="/shop" className="mt-8 inline-flex h-12 items-center justify-center border border-black bg-black px-8 text-sm font-bold uppercase text-white">
            Back to shop
          </a>
        </div>
      </section>
    );
  }

  return (
    <main className="bg-white text-black">
      <section className="grid min-h-screen bg-white lg:grid-cols-[minmax(0,1.18fr)_minmax(420px,0.82fr)]">
        <div className="bg-white lg:min-h-screen">
          <div className="grid gap-0 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
            {galleryImages.map((image, index) => (
              <button
                key={`${image || "placeholder"}-${index}`}
                type="button"
                onClick={() => setActiveImageIndex(index)}
                className="group relative flex min-h-[72vh] w-full items-center justify-center overflow-hidden border-0 bg-white p-8 outline-none transition focus-visible:outline focus-visible:outline-1 focus-visible:outline-black sm:min-h-[62vh] lg:min-h-screen xl:min-h-[50vw]"
                aria-label={`View product image ${index + 1}`}
              >
                {image ? (
                  <img
                    src={image}
                    alt={`${product.title} image ${index + 1}`}
                    className="h-full max-h-[86vh] w-full object-contain transition duration-500 ease-out group-hover:scale-[1.025]"
                    loading={index === 0 ? "eager" : "lazy"}
                  />
                ) : (
                  <div className="flex h-full min-h-[48vh] w-full items-center justify-center border border-black/10 text-xs font-bold uppercase tracking-[0.3em] text-black/35">
                    Image pending
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>

        <aside className="border-t border-black bg-white lg:sticky lg:top-0 lg:h-screen lg:border-l lg:border-t-0">
          <div className="flex h-full flex-col px-4 py-6 sm:px-8 lg:px-10 lg:py-10">
            <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-[0.28em] text-black">
              <a href="/shop" className="hover:underline">Back</a>
              <span>{stockMessage}</span>
            </div>

            <div className="mt-10 lg:mt-16">
              <h1 className="text-5xl font-black uppercase leading-[0.88] tracking-[-0.06em] sm:text-6xl lg:text-7xl">
                {product.title}
              </h1>
              <p className="mt-5 text-base font-bold uppercase tracking-[0.18em]">
                {formatPrice(selectedPrice)}
              </p>
              {product.description && (
                <p className="mt-8 max-w-xl whitespace-pre-line text-sm leading-6 text-black/65 lg:max-w-none">
                  {product.description}
                </p>
              )}
            </div>

            {galleryImages.length > 1 && (
              <div className="mt-8 flex flex-wrap gap-2" aria-label="Product image gallery">
                {galleryImages.map((_, index) => (
                  <button
                    key={index}
                    type="button"
                    onClick={() => setActiveImageIndex(index)}
                    className={`h-9 min-w-9 border px-3 text-xs font-bold uppercase transition ${
                      activeImageIndex === index
                        ? "border-black bg-black text-white"
                        : "border-black/25 bg-white text-black hover:border-black"
                    }`}
                    aria-label={`Go to product image ${index + 1}`}
                  >
                    {String(index + 1).padStart(2, "0")}
                  </button>
                ))}
              </div>
            )}

            {optionKeys.length > 0 && (
              <div className="mt-10 space-y-8">
                {optionKeys.map((option) => (
                  <fieldset key={option} className="space-y-3">
                    <legend className="flex w-full items-center justify-between text-xs font-bold uppercase tracking-[0.3em]">
                      <span>{normalizeOptionName(option)}</span>
                      <span className="tracking-[0.18em] text-black/45">{selection[option] || "SELECT"}</span>
                    </legend>
                    <div className="flex flex-wrap gap-2">
                      {optionValues[option]?.map((value) => {
                        const selected = selection[option] === value;
                        const available = isOptionAvailable(option, value);
                        return (
                          <button
                            key={value}
                            type="button"
                            onClick={() => setSelection((current) => ({ ...current, [option]: value }))}
                            disabled={!available}
                            className={`min-h-11 border px-5 text-sm font-bold uppercase tracking-[0.08em] transition ${
                              selected
                                ? "border-black bg-black text-white"
                                : "border-black/25 bg-white text-black hover:border-black"
                            } ${!available ? "cursor-not-allowed opacity-35" : ""}`}
                            aria-pressed={selected}
                          >
                            {value}
                          </button>
                        );
                      })}
                    </div>
                  </fieldset>
                ))}
              </div>
            )}

            <div className="mt-10 lg:mt-auto lg:pt-10">
              <a
                href={checkoutHref}
                aria-disabled={checkoutDisabled}
                className={`flex h-14 w-full items-center justify-center border border-black bg-black text-sm font-black uppercase tracking-[0.2em] text-white shadow-none transition hover:bg-white hover:text-black ${
                  checkoutDisabled ? "pointer-events-none opacity-40" : ""
                }`}
              >
                {checkoutDisabled ? "Select options" : "Add to cart"}
              </a>
              {selectedVariant?.sku && (
                <p className="mt-4 text-center text-[11px] font-bold uppercase tracking-[0.24em] text-black/45">
                  SKU {selectedVariant.sku}
                </p>
              )}
            </div>
          </div>
        </aside>
      </section>
    </main>
  );
}
