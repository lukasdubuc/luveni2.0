import { createFileRoute, Link } from "@tanstack/react-router";
import { fetchProducts, useProducts } from "@/lib/useProducts";

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
      { title: "Shop — Northwind" },
      { name: "description", content: "Browse all products." },
    ],
  }),
  component: ShopPage,
});

function ShopPage() {
  const loader = Route.useLoaderData();
  const { products: clientProducts } = useProducts({ onlyPublished: true });

  const products: Product[] =
    clientProducts && clientProducts.length > 0
      ? (clientProducts as Product[])
      : ((loader?.products as Product[]) ?? []);

  return (
    <div className="min-h-screen bg-black font-mono selection:bg-white selection:text-black">
      {/* ── Empty state ── */}
      {products.length === 0 ? (
        <div className="flex items-center justify-center h-screen">
          <span className="text-[10px] tracking-[0.3em] uppercase text-white/20">
            No Products Available
          </span>
        </div>
      ) : (
        /*
         * Grid: Yeezy.com 1:1
         *   No borders, no gaps.
         *   Pure black background.
         *   Transparent images.
         */
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 bg-black">
          {products.map((product) => (
            <ProductCell key={product.id} product={product} />
          ))}
        </div>
      )}
    </div>
  );
}

function ProductCell({ product }: { product: Product }) {
  const imageUrl =
    Array.isArray(product.image_urls) && product.image_urls.length > 0
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
      to={`/offer/${product.slug}`}
      className="group relative block bg-black overflow-hidden"
    >
      {/* Image — aspect-[1/1] like Yeezy.com, full-bleed, transparent */}
      <div className="aspect-square relative overflow-hidden flex items-center justify-center p-4 sm:p-8">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={product.title}
            className="max-w-full max-h-full object-contain transition-transform duration-500 ease-out group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          /* No-image fallback — pure void */
          <div className="absolute inset-0 flex items-center justify-center bg-black">
            <span className="text-[7px] tracking-[0.3em] uppercase text-white/10">
              No Image
            </span>
          </div>
        )}

        {/* Sale badge — minimal */}
        {hasDiscount && (
          <span className="absolute top-4 right-4 text-white text-[8px] tracking-[0.15em] uppercase font-bold">
            Sale
          </span>
        )}
      </div>

      {/* ── Info — Yeezy style ── */}
      <div className="text-center pb-8 px-4">
        <p className="text-[10px] tracking-[0.1em] uppercase text-white leading-tight mb-1">
          {product.title}
        </p>
        <div className="flex items-center justify-center gap-2">
          <span className="text-[10px] tracking-[0.05em] text-white">
            ${(displayPrice / 100).toFixed(0)}
          </span>
          {hasDiscount && (
            <span className="text-[9px] tracking-[0.05em] text-white/30 line-through">
              ${(product.price_cents / 100).toFixed(0)}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
