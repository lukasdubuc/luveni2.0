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
      <div className="border-b border-white px-6 py-4 flex items-center justify-between">
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
         * Grid: 60% size reduction achieved by increasing column density
         *   mobile  → 3 cols (was 2)
         *   sm      → 4 cols (was 3)
         *   md      → 5 cols (was 4)
         *   lg      → 6 cols (was 4)
         *   xl      → 8 cols (was 6)
         *
         * No gap — 1px white borders between cells only.
         * aspect-[2/3] portrait = editorial, high-fashion look.
         */
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 border-l border-t border-white">
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
      className="group relative block border-r border-b border-white bg-black overflow-hidden"
    >
      {/* Image — aspect-[2/3] portrait, full-bleed */}
      <div className="aspect-[2/3] relative overflow-hidden">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={product.title}
            className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-102"
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

        {/* Sale badge — top right, white pill */}
        {hasDiscount && (
          <span className="absolute top-1 right-1 bg-white text-black text-[6px] tracking-[0.15em] uppercase px-1 py-0.5 font-bold">
            Sale
          </span>
        )}

        {/* Hover overlay — minimal darkening */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-300" />
      </div>

      {/* ── Info overlay — bottom-left, tiny mono ── */}
      <div className="absolute bottom-0 left-0 right-0 p-1.5 bg-black">
        <p className="text-[7px] tracking-[0.1em] uppercase text-white truncate leading-tight">
          {product.title}
        </p>
        <div className="flex items-baseline gap-1 mt-0.5">
          <span className="text-[7px] tracking-[0.05em] text-white/70">
            ${(displayPrice / 100).toFixed(0)}
          </span>
          {hasDiscount && (
            <span className="text-[6px] tracking-[0.05em] text-white/30 line-through">
              ${(product.price_cents / 100).toFixed(0)}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
