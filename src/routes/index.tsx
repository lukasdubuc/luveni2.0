import { createFileRoute } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
// ... (your other imports)

export const Route = createFileRoute("/")({
  // This loader fetches your data from Supabase before the page renders
  loader: async () => {
    const { data: products } = await supabase
      .from("products")
      .select("*")
      .order("created_at", { ascending: true });
    return { products: products || [] };
  },
  head: () => ({
    meta: [
      { title: "Northwind — get the result you actually want" },
      // ...
    ],
  }),
  component: Home,
});

function Home() {
  // Access the live products we just fetched
  const { products } = Route.useLoaderData();

  return (
    <>
      <Hero />
      <Benefits />
      {/* Pass the live products into your OfferSection */}
      <OfferSection products={products} />
      <Testimonials />
      {/* ... rest of your code */}
    </>
  );
}
