import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Hero } from "@/components/site/Hero";
import { Benefits } from "@/components/site/Benefits";
import { OfferSection } from "@/components/site/OfferSection";
import { Testimonials } from "@/components/site/Testimonials";
import { FAQ } from "@/components/site/FAQ";
import { CTASection } from "@/components/site/CTASection";
import { LeadCaptureForm } from "@/components/site/LeadCaptureForm";
import { mergeSiteConfig, SITE_CONFIG_FALLBACK, type SiteConfig } from "@/lib/site-config";

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

    let products: any[] = [];
    if (productsResult.status === "fulfilled") {
      const { data, error } = productsResult.value;
      if (error) console.warn("[Northwind] products fetch error:", error.message);
      else products = data ?? [];
    } else {
      console.warn("[Northwind] products fetch rejected:", productsResult.reason);
    }

    let siteConfig: SiteConfig = SITE_CONFIG_FALLBACK;
    if (configResult.status === "fulfilled") {
      const { data, error } = configResult.value;
      if (error) console.warn("[Northwind] site_config fetch error:", error.message);
      else if (data) siteConfig = mergeSiteConfig(data);
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
  const router = useRouter();

  useEffect(() => {
    const refresh = () => router.invalidate();
    window.addEventListener("siteConfigUpdated", refresh);
    const handleStorage = (event: StorageEvent) => {
      if (event.key === "siteConfigUpdated") refresh();
    };
    window.addEventListener("storage", handleStorage);
    return () => {
      window.removeEventListener("siteConfigUpdated", refresh);
      window.removeEventListener("storage", handleStorage);
    };
  }, [router]);


  useEffect(() => {
    const intent = sessionStorage.getItem("active_login_intent");
    if (!intent) return;

    sessionStorage.removeItem("active_login_intent");

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user?.email?.toLowerCase() === "lukasdubuc@gmail.com") {
        navigate({ to: "/admin", replace: true });
      }
    });
  }, [navigate]);

  return (
    <>
      <Hero siteConfig={siteConfig} />
      <Benefits benefits={siteConfig.metadata?.features ?? []} />
      <OfferSection products={products} siteConfig={siteConfig} />
      <Testimonials testimonials={siteConfig.metadata?.testimonials ?? []} />

      <section className="border-t border-border bg-background">
        <div className="mx-auto max-w-2xl px-4 py-20 text-center">
          <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">
            {siteConfig.metadata?.newsletter_title ?? "Ready when you are."}
          </h2>
          <p className="mt-3 text-sm text-muted-foreground">
            {siteConfig.metadata?.newsletter_subtitle ?? "One email when there's something genuinely worth your time."}
          </p>
          <div className="mx-auto mt-6 max-w-md">
            <LeadCaptureForm source="home-newsletter" buttonText={siteConfig.metadata?.newsletter_button_text ?? "Notify me"} />
          </div>
        </div>
      </section>

      <FAQ faqs={siteConfig.metadata?.faqs ?? []} />
      <CTASection siteConfig={siteConfig} />
    </>
  );
}

export default Home;
