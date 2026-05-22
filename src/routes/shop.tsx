import { createFileRoute, Link } from "@tanstack/react-router";
import { fetchProducts, useProducts } from "@/lib/useProducts";

export const Route = createFileRoute("/shop")({
  loader: async () => {
    const products = await fetchProducts({ onlyPublished: true });
    return { products: products ?? [] };
  },
  head: () => ({
    meta: [
      { title: "Shop — Northwind" },
      { name: "description", content: "Browse all published products in our clean, modern shop." },
      { property: "og:title", content: "Shop — Northwind" },
      { property: "og:description", content: "Browse all published products in our clean, modern shop." },
    ],
  }),
  component: ShopPage,
});

type Product = {
  id: string;
  title: string;
  slug: string;
  description?: string | null;
  price_cents: number;
  currency?: string;
  image_urls?: string[] | null;
  fulfillment_provider?: string | null;
  is_published?: boolean;
  variants?: any[] | null;
};

function ShopPage() {
  const loader = Route.useLoaderData();
  const { products: clientProducts, loading } = useProducts({ onlyPublished: true });
  const products: Product[] = (clientProducts && clientProducts.length > 0)
    ? (clientProducts as Product[])
    : ((loader?.products as Product[]) ?? []);

  return (
    <section className="min-h-screen bg-background py-16 sm:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <header className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-medium uppercase tracking-[0.3em] text-muted-foreground">Shop</p>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
            Curated products, ready to ship.
          </h1>
          <p className="mt-4 text-base text-muted-foreground">
            Browse our complete collection. Every product is in stock and ready for fulfillment.
          </p>
        </header>

        {/* Grid */}
        {loading && products.length === 0 ? (
          <div className="mt-16 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="overflow-hidden rounded-2xl border border-border bg-white">
                <div className="aspect-square animate-pulse bg-muted" />
                <div className="space-y-3 p-5">
                  <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
                  <div className="h-4 w-1/3 animate-pulse rounded bg-muted" />
                </div>
              </div>
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="mx-auto mt-20 max-w-md rounded-2xl border border-dashed border-border bg-white p-12 text-center">
            <p className="text-sm text-muted-foreground">No products published yet.</p>
          </div>
        ) : (
          <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {products.map((product) => {
              const image = Array.isArray(product.image_urls) && product.image_urls.length > 0
                ? product.image_urls[0]
                : null;
              const variantCount = Array.isArray(product.variants) ? product.variants.length : 0;
              const inStock = Array.isArray(product.variants)
                ? product.variants.some((v: any) => (v?.stock ?? 0) > 0)
                : true;

              return (
                <Link
                  key={product.id}
                  to={`/offer/${product.slug}`}
                  className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-foreground/30 hover:shadow-lg"
                >
                  {/* Image */}
                  <div className="relative aspect-square overflow-hidden bg-muted">
                    {image ? (
                      <img
                        src={image}
                        alt={product.title}
                        loading="lazy"
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-xs uppercase tracking-[0.3em] text-muted-foreground">
                        No image
                      </div>
                    )}
                    {!inStock && (
                      <span className="absolute left-3 top-3 rounded-full bg-black/80 px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider text-white">
                        Sold out
                      </span>
                    )}
                  </div>

                  {/* Body */}
                  <div className="flex flex-1 flex-col p-5">
                    {product.fulfillment_provider && (
                      <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
                        {product.fulfillment_provider}
                      </p>
                    )}
                    <h2 className="mt-1.5 text-base font-semibold tracking-tight text-foreground line-clamp-2">
                      {product.title}
                    </h2>
                    <div className="mt-auto flex items-end justify-between pt-4">
                      <p className="text-lg font-semibold tracking-tight text-foreground">
                        ${(product.price_cents / 100).toFixed(2)}
                      </p>
                      {variantCount > 0 && (
                        <p className="text-xs text-muted-foreground">
                          {variantCount} variant{variantCount === 1 ? "" : "s"}
                        </p>
                      )}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
