import { createFileRoute, Link } from "@tanstack/react-router";
import { fetchProducts, useProducts } from "@/lib/useProducts";
import { useMemo, memo, useEffect } from "react";
import { trackEvent } from "@/lib/track";
import { proxyImageUrl, isLikelyTransparentImage, isOwnProductMediaUrl } from "@/lib/img";

type Product = {
  id: string;
  title: string;
  slug: string;
  price_cents: number;
  price_cents_discounted?: number | null;
  discounted_price_cents?: number | null;
  image_urls?: string[];
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
          {products.map((product, index) => (
            <ProductCell key={product.id} product={product} index={index} />
          ))}
        </div>
      )}
    </div>
  );
}

// Choose the storefront thumbnail: the flat product mockup, never the bare
// design/logo (Printful lists the print file first, so skip index 0 when
// there's a real mockup after it).
function gridImage(images?: string[]): string | null {
  if (!Array.isArray(images) || images.length === 0) return null;
  // Once processed, image_urls[0] is the clean transparent primary — prefer it.
  // Otherwise fall back to skipping index 0 (Printful lists the bare print file
  // first, so the real mockup is at [1]).
  if (isOwnProductMediaUrl(images[0]) || isLikelyTransparentImage(images[0])) return images[0];
  return images.length > 1 ? images[1] : images[0];
}

const ProductCell = memo(({ product, index }: { product: Product; index: number }) => {
  const raw = gridImage(product.image_urls);
  const imageUrl = raw ? proxyImageUrl(raw) : null;
  // Transparent PNGs (Printful mockups, admin-treated CJ uploads) float on the
  // bare grid. Untreated vendor photos (CJ JPGs on studio backdrops) get a
  // neutral rounded tile so they read as deliberate, not pasted rectangles.
  const framed = !!raw && !isLikelyTransparentImage(raw);

  const discounted = product.price_cents_discounted ?? product.discounted_price_cents ?? null;
  const hasDiscount = discounted != null && discounted < product.price_cents;
  const displayPrice = hasDiscount ? discounted! : product.price_cents;

  // First 6 products load eagerly and with high priority (above the fold).
  const isAboveFold = index < 6;

  return (
    <Link
      to="/offer/$slug"
      params={{ slug: product.slug }}
      preload="intent"
      viewTransition
      onClick={() => trackEvent("product_click", { product_id: product.id })}
      className="group relative z-0 block border-none bg-transparent outline-none transition-transform duration-300 ease-in-out hover:z-10 hover:scale-105 focus:outline-none focus-visible:outline-none"
    >
      <div className="relative flex aspect-square items-center justify-center overflow-hidden bg-transparent p-6 sm:p-8 md:p-10">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={product.title}
            width={600}
            height={600}
            sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, 16vw"
            className={
              framed
                ? "max-h-full max-w-full aspect-square rounded-2xl bg-white object-contain p-2 shadow-[0_1px_10px_rgba(0,0,0,0.06)] ring-1 ring-black/5"
                : "max-h-full max-w-full object-contain aspect-square"
            }
            loading={isAboveFold ? "eager" : "lazy"}
            decoding="async"
            {...(isAboveFold ? { fetchPriority: "high" } : {})}
            // Shared element: the browser morphs this thumbnail into the same
            // image on the offer page for a seamless zoom (Yeezy-style). Only
            // the clicked cell's name is live during a navigation, so per-id
            // names never collide.
            style={{ viewTransitionName: `product-media-${product.id}` }}
          />
        ) : (
          <span className="text-[7px] uppercase tracking-[0.3em] opacity-20">No Image</span>
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
