import { createFileRoute, Link } from "@tanstack/react-router";
import { fetchProducts, useProducts } from "@/lib/useProducts";
import { useMemo, memo, useEffect } from "react";
import { trackEvent } from "@/lib/track";

type Product = {
  id: string;
  title: string;
  slug: string;
  price_cents: number;
  discounted_price_cents?: number | null;
  image_urls: string[];
};

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
          {products.map((product) => (
            <ProductCell key={product.id} product={product} />
          ))}
        </div>
      )}
    </div>
  );
}

const ProductCell = memo(({ product }: { product: Product }) => {
  // Skip index 0 — Printful always puts the logo/design mockup there.
  // Fall back to index 0 only if there's a single image (no real photo yet).
  const imageUrl =
    Array.isArray(product.image_urls) && product.image_urls.length > 1
      ? product.image_urls[1]
      : Array.isArray(product.image_urls) && product.image_urls.length === 1
      ? product.image_urls[0]
      : null;
  const hasDiscount =
    product.discounted_price_cents != null &&
    product.discounted_price_cents < product.price_cents;
  const displayPrice = hasDiscount
    ? product.discounted_price_cents!
    : product.price_cents;

  return (
    <Link
      to="/offer/$slug"
      params={{ slug: product.slug }}
      preload="intent"
      viewTransition
      onClick={() => trackEvent("product_click", { product_id: product.id })}
      className="group relative z-0 block border-none bg-transparent outline-none transition-transform duration-300 ease-in-out hover:z-10 hover:scale-105 hover:border-transparent focus:outline-none focus-visible:outline-none"
      style={{ willChange: "transform" }}
    >
      <div className="relative flex aspect-square items-center justify-center overflow-hidden bg-transparent p-6 sm:p-8 md:p-10">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={product.title}
            width={400}
            height={400}
            className="max-h-full max-w-full object-contain aspect-square"
            loading="eager"
            decoding="async"
            style={{ willChange: "transform", backfaceVisibility: "hidden" }}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-transparent">
            <span className="text-[7px] uppercase tracking-[0.3em] opacity-20">
              No Image
            </span>
          </div>
        )}
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
    </Link>
  );
});
ProductCell.displayName = "ProductCell";
