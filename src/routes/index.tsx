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
import { SITE_CONFIG_FALLBACK, type SiteConfig } from "@/lib/site-config";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Northwind — get the result you actually want" },
      {
        name: "description",
        content: "A focused, no-fluff package that gets you to the result faster.",
      },
    ],
  }),

  loader: async () => {
    const [productsResult, configResult] = await Promise.allSettled([
      supabase
        .from("products")
        .select("*")
        .eq("is_published", true)
        .order("created_at", { ascending: false }),

      supabase
        .from("site_config")
        .select("*")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    // Products — safe fallback to empty array on any failure
    let products: any[] = [];
    if (productsResult.status === "fulfilled") {
      const { data, error } = productsResult.value;
      if (error) console.warn("[Northwind] products fetch error:", error.message);
      else products = data ?? [];
    } else {
      console.warn("[Northwind] products fetch rejected:", productsResult.reason);
    }

    // Site config — safe fallback to hardcoded defaults on any failure
    let siteConfig: SiteConfig = SITE_CONFIG_FALLBACK;
    if (configResult.status === "fulfilled") {
      const { data, error } = configResult.value;
      if (error) console.warn("[Northwind] site_config fetch error:", error.message);
      else if (data) siteConfig = { ...SITE_CONFIG_FALLBACK, ...data };
    } else {
      console.warn("[Northwind] site_config fetch rejected:", configResult.reason);
    }

    return { products, siteConfig };
  },

  component: Home,
});

function Home() {
  const { products, siteConfig } = Route.useLoaderData();
  const navigate = useNavigate();

  // OAuth redirect intercept ─────────────────────────────────────────────────
  // Lovable's proxy always drops the user on "/" after Google sign-in.
  // The login page plants sessionStorage['active_login_intent'] before
  // triggering the OAuth flow. We read it here and redirect to /admin
  // if the session belongs to the authorised admin email.
  // The flag is deleted immediately so it never fires twice and never
  // affects normal public visitors.
  useEffect(() => {
    const intent = sessionStorage.getItem("active_login_intent");
    if (!intent) return;

    sessionStorage.removeItem("active_login_intent");

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (
        session?.user?.email?.toLowerCase() === "lukasdubuc@gmail.com"
      ) {
        navigate({ to: "/admin", replace: true });
      }
    });
  }, [navigate]);

  return (
    <>
      <Hero siteConfig={siteConfig} />
      <Benefits />
      <OfferSection products={products} siteConfig={siteConfig} />
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
      <CTASection siteConfig={siteConfig} />
    </>
  );
}

export default Home;
