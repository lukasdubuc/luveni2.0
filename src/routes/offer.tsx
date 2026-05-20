import { createFileRoute } from "@tanstack/react-router";
import { OfferSection } from "@/components/site/OfferSection";
import { Testimonials } from "@/components/site/Testimonials";
import { FAQ } from "@/components/site/FAQ";
import { CTASection } from "@/components/site/CTASection";
import { supabase } from "@/integrations/supabase/client";
import { offer } from "@/config/site";

export const Route = createFileRoute("/offer")({
  loader: async ({ params: { slug } }) => {
    if (slug) {
      const { data: product } = await supabase
        .from("products")
        .select("*")
        .eq("slug", slug)
        .eq("is_published", true)
        .maybeSingle();
      return { product: product ?? null };
    }

    const { data: products } = await supabase
      .from("products")
      .select("*")
      .eq("is_published", true)
      .order("created_at", { ascending: false })
      .limit(1);

    return { product: products?.[0] ?? null };
  },
  head: ({ loaderData }) => {
    const product = loaderData.product;
    const title = product?.title ?? offer.name;
    const description = product?.description ?? offer.shortPitch;

    return {
      meta: [
        { title: `${title} — Northwind` },
        { name: "description", content: description },
        { property: "og:title", content: `${title} — Northwind` },
        { property: "og:description", content: description },
      ],
    };
  },
  component: OfferPage,
});

function OfferPage() {
  const { product } = Route.useLoaderData();
  const products = product ? [product] : [];

  return (
    <>
      <section className="border-b border-border" style={{ backgroundImage: "var(--gradient-hero)" }}>
        <div className="mx-auto max-w-3xl px-4 py-20 text-center">
          <p className="text-sm font-medium uppercase tracking-wider text-accent">The offer</p>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight md:text-5xl">
            {product?.title || offer.name}
          </h1>
          <p className="mt-4 text-lg text-muted-foreground">
            {product?.description || offer.shortPitch}
          </p>
        </div>
      </section>
      <OfferSection products={products} />
      <Testimonials />
      <FAQ />
      <CTASection />
    </>
  );
}
