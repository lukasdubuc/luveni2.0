import { createFileRoute, Link } from "@tanstack/react-router";
import { fetchProducts, useProducts } from "@/lib/useProducts";

type Product = {
  id: string;
  title: string;
  slug: string;
  price_cents: number;
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
      { name: "description", content: "Browse published products with clean, modern product cards." },
    ],
  }),
  component: ShopPage,
});

function ShopPage() {
  const loader = Route.useLoaderData();
  const { products: clientProducts, loading } = useProducts({ onlyPublished: true });
  const products: Product[] = (clientProducts && clientProducts.length > 0)
    ? (clientProducts as Product[])
    : ((loader?.products as Product[]) ?? []);

  return (
    <section className="bg-background min-h-screen py-12">
      <div className="mx-auto max-w-7xl px-2 sm:px-4 lg:px-8">
        {/* High-density minimal grid */}
        <div className="grid gap-2 sm:gap-3 grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {products.map((product) => {
            const imageUrl = Array.isArray(product.image_urls) && product.image_urls.length > 0
              ? product.image_urls[0]
              : null;

            return (
              <Link
                key={product.id}
                to={`/offer/${product.slug}`}
                className="group relative overflow-hidden rounded-sm bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-sm aspect-square transition-all duration-300 hover:-translate-y-1 hover:shadow-lg"
              >
                {/* Image background */}
                {imageUrl && (
                  <img
                    src={imageUrl}
                    alt={product.title}
                    className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                )}

                {/* Dark overlay for readability */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />

                {/* Minimal text overlay - bottom */}
                <div className="absolute bottom-0 left-0 right-0 p-2 sm:p-3">
                  <h3 className="text-xs sm:text-sm font-semibold tracking-tight text-white truncate">
                    {product.title}
                  </h3>
                  <p className="text-[10px] sm:text-xs text-white/80 font-light">
                    ${(product.price_cents / 100).toFixed(0)}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
