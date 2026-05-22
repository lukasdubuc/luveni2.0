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
        { title: "SHOP — VOID" },
        { name: "description", content: "WALL OF PRODUCTS" },
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
      <div className="min-h-screen bg-black">
        {/* ── Wall of Products ── */}
        {products.length === 0 ? (
          <div className="flex items-center justify-center h-screen border-l border-t border-white">
            <span className="text-tiny tight-mono text-white">
              NO PRODUCTS AVAILABLE
            </span>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 border-l border-t border-white">
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
  
    const displayPrice = product.discounted_price_cents != null && product.discounted_price_cents < product.price_cents
      ? product.discounted_price_cents
      : product.price_cents;
  
    return (
      <Link
        to={`/offer/${product.slug}`}
        className="group relative block border-r border-b border-white bg-black overflow-hidden"
      >
        {/* Image — aspect-[3/4] full-bleed */}
        <div className="aspect-[3/4] relative overflow-hidden">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={product.title}
              className="absolute inset-0 w-full h-full object-cover grayscale hover:grayscale-0 transition-all duration-500"
              loading="lazy"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-black">
              <span className="text-tiny tight-mono text-white/20">
                MISSING_IMAGE
              </span>
            </div>
          )}
  
          {/* Info Overlay — bottom-left, tiny mono */}
          <div className="absolute bottom-0 left-0 p-2 bg-black/50 backdrop-blur-sm group-hover:bg-black transition-colors">
            <div className="flex flex-col gap-0.5">
              <span className="text-tiny tight-mono text-white leading-none">
                {product.title}
              </span>
              <span className="text-tiny tight-mono text-white/70 leading-none">
                ${(displayPrice / 100).toFixed(2)}
              </span>
            </div>
          </div>
        </div>
      </Link>
    );
  }
  
