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
      { title: "Shop" },
      { name: "description", content: "Browse all products." },
    ],
  }),
  component: ShopPage,
});

function ShopPage() {
  const loader = Route.useLoaderData();
  const { products: clientProducts } = useProducts({ onlyPublished: true });
  // Note: Theme is handled by SiteShell wrapper which provides the context class

  const products: Product[] =
    clientProducts && clientProducts.length > 0
      ? (clientProducts as Product[])
      : ((loader?.products as Product[]) ?? []);

  return (
    <div className="min-h-screen overflow-x-hidden bg-inherit font-mono selection:bg-current selection:text-current">
      {products.length === 0 ? (
        <div className="flex h-screen items-center justify-center">
          <span className="text-[10px] uppercase tracking-[0.3em] opacity-30">
            No Products Available
          </span>
        </div>
      ) : (
        <div className="grid grid-cols-2 overflow-visible bg-inherit sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8">
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
      className="group relative z-0 block border-none bg-transparent outline-none transition-all duration-300 ease-in-out hover:z-10 hover:scale-105 hover:border-transparent focus:outline-none focus-visible:outline-none"
    >
      <div className="relative flex aspect-[2/3] items-center justify-center overflow-hidden bg-transparent p-3 sm:p-4">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={product.title}
            className="max-h-full max-w-full object-contain"
            loading="lazy"
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

      <div className="px-2 pb-6 text-center">
        <p className="mb-1 text-[9px] uppercase leading-tight tracking-[0.1em] text-current">
          {product.title}
        </p>
        <div className="flex items-center justify-center gap-2">
          <span className="text-[9px] tracking-[0.05em] text-current">
            ${(displayPrice / 100).toFixed(0)}
          </span>
          {hasDiscount && (
            <span className="text-[8px] tracking-[0.05em] opacity-35 line-through">
              ${(product.price_cents / 100).toFixed(0)}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
