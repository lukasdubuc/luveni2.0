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
      { name: "description", content: "Browse published products with clean, modern product cards." },
    ],
  }),
  component: ShopPage,
});

function ShopPage() {
  // Use server-side loader data initially, but prefer the shared hook for
  // client-driven refreshes so both Shop and OfferSection use the same logic.
  const loader = Route.useLoaderData();
  const { products: clientProducts, loading } = useProducts({ onlyPublished: true });
  const products = (clientProducts && clientProducts.length > 0) ? clientProducts : (loader?.products ?? []);

  return (
    <section className="bg-background min-h-screen py-16">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-accent">Shop</p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
              Clean product discovery for every device.
            </h1>
          </div>
          <p className="max-w-sm text-sm text-muted-foreground">
            Browse live products, compare variants, and open any detail page with a single click.
          </p>
        </div>

        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {products.map((product) => {
            const availableVariants = Array.isArray(product.variants)
              ? product.variants.filter((variant: any) => (variant.stock ?? 0) > 0)
              : [];
            const stockLabel = availableVariants.length > 0
              ? `${availableVariants.length} variant${availableVariants.length === 1 ? "" : "s"} in stock`
              : product.variants?.length
                ? "Sold out"
                : "In stock";

            return (
              <article key={product.id} className="overflow-hidden rounded-3xl border border-border bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-md">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">{product.fulfillment_provider || "Fulfillment"}</p>
                    <h2 className="mt-3 text-xl font-semibold tracking-tight text-foreground">{product.title}</h2>
                  </div>
                  <span className="rounded-full border border-black/10 px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                    {product.is_published ? "Live" : "Draft"}
                  </span>
                </div>
                <p className="mt-5 text-3xl font-light tracking-tight text-foreground">${(product.price_cents / 100).toFixed(2)}</p>
                <p className="mt-4 text-sm text-muted-foreground">{stockLabel}</p>
                <div className="mt-6 flex flex-wrap gap-3">
                  <Link
                    to={`/offer/${product.slug}`}
                    className="inline-flex items-center justify-center rounded-full border border-black/10 bg-background px-4 py-2 text-sm font-semibold text-foreground transition hover:border-black hover:bg-black/5"
                  >
                    View Details
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
