import { createFileRoute } from "@tanstack/react-router";
import { fetchProducts, useProducts } from "@/lib/useProducts";
import { useMemo, memo, useEffect, useState, useCallback } from "react";
import { trackEvent } from "@/lib/track";
import { proxyImageUrl } from "@/lib/img";
import { GarmentSilhouette, garmentKindFromTitle } from "@/components/site/GarmentSilhouette";
import { ProductModal, type ModalProduct } from "@/components/site/ProductModal";

type Product = ModalProduct;

export const Route = createFileRoute("/shop")({
  loader: async () => {
    const products = await fetchProducts({ onlyPublished: true });
    return { products: products ?? [] };
  },
  head: () => ({
    meta: [
      { title: "Shop" },
      { name: "description", content: "Browse all products." },
    ],
  }),
  component: ShopPage,
});

function ShopPage() {
  const loader = Route.useLoaderData();
  const { products: clientProducts } = useProducts({ onlyPublished: true });
  const products: Product[] = useMemo(() => {
    return clientProducts && clientProducts.length > 0
      ? (clientProducts as Product[])
      : ((loader?.products as Product[]) ?? []);
  }, [clientProducts, loader?.products]);

  // Tamed-Psychotic single-page modal: opening a product never navigates.
  const [active, setActive] = useState<Product | null>(null);
  const open = useCallback((p: Product) => {
    setActive(p);
    trackEvent("product_click", { product_id: p.id });
  }, []);

  useEffect(() => {
    trackEvent("page_view");
  }, []);

  return (
    <div className="min-h-screen overflow-x-hidden bg-inherit font-mono selection:bg-current selection:text-current">
      {products.length === 0 ? (
        <div className="flex h-screen items-center justify-center">
          <span className="text-[10px] uppercase tracking-[0.3em] opacity-30">
            No Products Available
          </span>
        </div>
      ) : (
        <div className="grid grid-cols-2 overflow-visible bg-inherit sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {products.map((product, index) => (
            <ProductCell key={product.id} product={product} index={index} onOpen={open} />
          ))}
        </div>
      )}
      {active && <ProductModal product={active} onClose={() => setActive(null)} />}
    </div>
  );
}

const ProductCell = memo(({ product, index, onOpen }: { product: Product; index: number; onOpen: (p: Product) => void }) => {
  // Grid prefers the flat transparent mockup (image_urls[1] is Printful's
  // flat preview when present, else [0]).
  const rawImageUrl =
    Array.isArray(product.image_urls) && product.image_urls.length > 1
      ? product.image_urls[1]
      : Array.isArray(product.image_urls) && product.image_urls.length === 1
      ? product.image_urls[0]
      : null;

  const imageUrl = rawImageUrl ? proxyImageUrl(rawImageUrl) : null;
  const kind = garmentKindFromTitle(product.title);

  const hasDiscount =
    product.discounted_price_cents != null &&
    product.discounted_price_cents < product.price_cents;
  const displayPrice = hasDiscount ? product.discounted_price_cents! : product.price_cents;

  // First 6 products load eagerly and with high priority (above the fold).
  const isAboveFold = index < 6;

  return (
    <button
      type="button"
      onClick={() => onOpen(product)}
      aria-label={`View ${product.title}`}
      className="group relative z-0 block cursor-pointer border-none bg-transparent text-left outline-none transition-transform duration-300 ease-in-out hover:z-10 hover:scale-105 focus:outline-none focus-visible:outline-none"
    >
      <div className="relative flex aspect-square items-center justify-center overflow-hidden bg-transparent p-6 sm:p-8 md:p-10">
        {/* Instant vector silhouette underlay — reserves the box, zero CLS. */}
        <GarmentSilhouette
          kind={kind}
          className="pointer-events-none absolute inset-0 m-auto h-2/3 w-2/3 text-current"
        />
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={product.title}
            width={600}
            height={600}
            sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, 16vw"
            className="relative max-h-full max-w-full object-contain aspect-square"
            loading={isAboveFold ? "eager" : "lazy"}
            decoding="async"
            {...(isAboveFold ? { fetchPriority: "high" } : {})}
          />
        ) : null}
        {hasDiscount && (
          <span className="absolute right-3 top-3 text-[8px] font-bold uppercase tracking-[0.15em] text-current">
            Sale
          </span>
        )}
      </div>
      <div className="px-2 pb-8 text-center">
        <p className="mb-1.5 text-[11px] leading-tight tracking-[0.02em] text-current opacity-90">
          {product.title}
        </p>
        <div className="flex items-center justify-center gap-2">
          <span className="text-[11px] tracking-[0.02em] text-current">
            ${(displayPrice / 100).toFixed(0)}
          </span>
          {hasDiscount && (
            <span className="text-[10px] tracking-[0.02em] opacity-45 line-through">
              ${(product.price_cents / 100).toFixed(0)}
            </span>
          )}
        </div>
      </div>
    </button>
  );
});
ProductCell.displayName = "ProductCell";
