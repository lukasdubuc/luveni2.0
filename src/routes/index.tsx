import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
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
  const navigate = useNavigate();
  // STEP 2: Use the live data in your component
  const { products } = Route.useLoaderData();

  // SMART INTERCEPTOR HOOK: Only redirect to /admin if we are actively processing a fresh login event
  useEffect(() => {
    const handleAuthRedirect = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      // Check if the URL contains auth parameters (only present immediately after clicking Google Sign-In)
      const hasAuthParams = window.location.hash.includes("access_token") || window.location.search.includes("code");
      
      if (session?.user?.email?.toLowerCase() === "lukasdubuc@gmail.com" && hasAuthParams) {
        navigate({ to: "/admin" });
      }
    };
    
    handleAuthRedirect();
    
    // Catch the active event handshake when Lovable's proxy drops the session tokens back into the app
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user?.email?.toLowerCase() === "lukasdubuc@gmail.com" && event === "SIGNED_IN") {
        navigate({ to: "/admin" });
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [navigate]);

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

export default Home;
