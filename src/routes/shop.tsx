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
    <div className="min-h-screen bg-black font-mono">

      {/* ── Header strip ── */}
      <div className="border-b border-white/10 px-6 py-4 flex items-center justify-between">
        <span className="text-[10px] tracking-[0.3em] uppercase text-white font-bold">
          Shop
        </span>
        <div className="flex items-center gap-6">
          {/* Filter chips */}
          <div className="hidden sm:flex gap-3">
            <span className="text-[9px] tracking-[0.2em] uppercase text-white border-b border-white pb-px cursor-pointer">
              All
            </span>
            <span className="text-[9px] tracking-[0.2em] uppercase text-white/30 hover:text-white cursor-pointer transition-colors">
              New
            </span>
            <span className="text-[9px] tracking-[0.2em] uppercase text-white/30 hover:text-white cursor-pointer transition-colors">
              Sale
            </span>
          </div>
          <span className="text-[9px] tracking-[0.2em] uppercase text-white/20">
            {products.length}&nbsp;{products.length === 1 ? "Item" : "Items"}
          </span>
        </div>
      </div>

      {/* ── Empty state ── */}
      {products.length === 0 ? (
        <div className="flex items-center justify-center h-64">
          <span className="text-[10px] tracking-[0.3em] uppercase text-white/20">
            No Products Available
          </span>
        </div>
      ) : (
        /*
         * Grid:
         *   mobile  → 2 cols
         *   sm      → 3 cols
         *   lg      → 4 cols
         *   xl      → 6 cols  ← approved density
         *
         * No gap — 1px borders between cells only.
         * aspect-[3/4] portrait = compact editorial.
         */
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
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
      className="group relative block border-r border-b border-white/10 bg-[#0a0a0a] overflow-hidden"
    >
      {/* Image — aspect-[3/4] portrait */}
      <div className="aspect-[3/4] relative overflow-hidden">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={product.title}
            className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          /* No-image fallback — pure void */
          <div className="absolute inset-0 flex items-center justify-center bg-[#0d0d0d]">
            <span className="text-[8px] tracking-[0.3em] uppercase text-white/10">
              No Image
            </span>
          </div>
        )}

        {/* Sale badge — top right, white pill */}
        {hasDiscount && (
          <span className="absolute top-2 right-2 bg-white text-black text-[7px] tracking-[0.15em] uppercase px-1.5 py-0.5 font-bold">
            Sale
          </span>
        )}

        {/* Hover overlay — barely-there darkening */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/25 transition-colors duration-500" />
      </div>

      {/* ── Micro-bar — always visible ── */}
      <div className="flex items-baseline justify-between px-2 py-2 border-t border-white/10">
        <p className="text-[8px] tracking-[0.14em] uppercase text-white truncate leading-tight flex-1 min-w-0 pr-2">
          {product.title}
        </p>
        <div className="flex items-baseline gap-1.5 shrink-0">
          <span className="text-[8px] tracking-[0.1em] text-white/60">
            ${(displayPrice / 100).toFixed(0)}
          </span>
          {hasDiscount && (
            <span className="text-[7px] tracking-[0.1em] text-white/20 line-through">
              ${(product.price_cents / 100).toFixed(0)}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
