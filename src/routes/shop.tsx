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
      { name: "description", content: "Browse published products." },
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
    <div className="min-h-screen bg-white font-mono">
      {/* Page header */}
      <div className="border-b border-black px-6 py-5 flex items-center justify-between">
        <span className="text-[11px] tracking-[0.3em] uppercase font-bold">Shop</span>
        <span className="text-[11px] tracking-[0.2em] uppercase text-black/30">
          {products.length}&nbsp;{products.length === 1 ? "Item" : "Items"}
        </span>
      </div>

      {products.length === 0 ? (
        <div className="flex items-center justify-center h-64">
          <span className="text-[11px] tracking-[0.3em] uppercase text-black/25">
            No Products Available
          </span>
        </div>
      ) : (
        /* Edge-to-edge grid — borders act as gutters */
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {products.map((product) => {
            const imageUrl =
              Array.isArray(product.image_urls) && product.image_urls.length > 0
                ? product.image_urls[0]
                : null;
            const price = (product.price_cents / 100).toFixed(0);

            return (
              <Link
                key={product.id}
                to={`/offer/${product.slug}`}
                className="group relative block aspect-[3/4] overflow-hidden border-r border-b border-black/10 bg-[#f2f2f2]"
              >
                {/* Full-bleed image */}
                {imageUrl ? (
                  <img
                    src={imageUrl}
                    alt={product.title}
                    className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-[9px] tracking-[0.3em] uppercase text-black/20">
                      No Image
                    </span>
                  </div>
                )}

                {/* Hover darkening */}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-500" />

                {/* Info bar — frosted strip at bottom */}
                <div className="absolute bottom-0 left-0 right-0 px-3 py-3 backdrop-blur-sm bg-white/85 border-t border-black/10">
                  <p className="text-[11px] tracking-[0.15em] uppercase font-bold truncate leading-tight text-black">
                    {product.title}
                  </p>
                  <p className="text-[11px] tracking-widest text-black/60 mt-0.5">
                    ${price}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
