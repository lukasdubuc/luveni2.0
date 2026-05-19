import { createFileRoute } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Hero } from "@/components/site/Hero";
import { Benefits } from "@/components/site/Benefits";
import { OfferSection } from "@/components/site/OfferSection";
import { Testimonials } from "@/components/site/Testimonials";
import { FAQ } from "@/components/site/FAQ";
import { CTASection } from "@/components/site/CTASection";
import { LeadCaptureForm } from "@/components/site/LeadCaptureForm";

export const Route = createFileRoute("/")({
  // STEP 1: Fetch live data from your "products" table
  loader: async () => {
    const { data: products, error } = await supabase
      .from("products")
      .select("*")
      // We use descending to make sure your newest product is the one seen
      .order("created_at", { ascending: false });
    
    if (error) console.error("Sync Error:", error);
    return { products: products || [] };
  },
  head: () => ({
    meta: [
      { title: "Northwind — get the result you actually want" },
      { name: "description", content: "A focused, no-fluff package that gets you to the result faster." },
    ],
  }),
  component: Home,
});

function Home() {
  // STEP 2: Use the live data in your component
  const { products } = Route.useLoaderData();

  return (
    <>
      <Hero />
      <Benefits />
      {/* STEP 3: Pass the database products into your offer section */}
      <OfferSection products={products} />
      <Testimonials />
      <section className="border-t border-border bg-background">
        <div className="mx-auto max-w-2xl px-4 py-20 text-center">
          <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">
            Not ready to buy? Get updates.
          </h2>
          <p className="mt-3 text-sm text-muted-foreground">
            One email when there's something genuinely worth your time.
          </p>
          <div className="mx-auto mt-6 max-w-md">
            <LeadCaptureForm source="home-newsletter" />
          </div>
        </div>
      </section>
      <FAQ />
      <CTASection />
    </>
  );
}
