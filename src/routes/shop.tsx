import { createFileRoute, Link } from "@tanstack/react-router";
import { fetchProducts, useProducts } from "@/lib/useProducts";
import { useMemo, memo } from "react";
import { useCart } from "@/context/CartContext"; // Added import

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

const ProductCell = memo(({ product }: { product: Product }) => {
  const { addItem } = useCart(); // Hook access

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

  // New function to stop navigation and add to cart
  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    addItem({
      productId: product.id,
      title: product.title,
      price_cents: product.price_cents,
      quantity: 1
    });
  };

  return (
    <Link
      to={`/offer/${product.slug}`}
      preload="intent"
      viewTransition
      className="group relative z-0 block border-none bg-transparent outline-none transition-transform duration-300 ease-in-out hover:z-10 hover:scale-105 hover:border-transparent focus:outline-none focus-visible:outline-none"
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
        <p className="mb-1 text-[9px] uppercase leading-tight tracking-[0.1em] text-current opacity-90">
          {product.title}
        </p>
        <div className="flex items-center justify-center gap-2">
          <span className="text-[9px] tracking-[0.05em] text-current font-bold">
            ${(displayPrice / 100).toFixed(0)}
          </span>
          {hasDiscount && (
            <span className="text-[8px] tracking-[0.05em] opacity-45 line-through">
              ${(product.price_cents / 100).toFixed(0)}
            </span>
          )}
        </div>
        
        {/* ADD TO CART BUTTON */}
        <button 
          onClick={handleAddToCart}
          className="mt-2 text-[8px] uppercase tracking-[0.1em] border border-current px-2 py-1 hover:bg-current hover:text-white transition-colors"
        >
          Add to Cart
        </button>
      </div>
    </Link>
  );
});

ProductCell.displayName = "ProductCell";
