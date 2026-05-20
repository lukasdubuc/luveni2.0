import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
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
  const [range, setRange] = useState<"year" | "month" | "week" | "day">("year");

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

  const rangeCounts = useMemo(() => {
    const days = { year: 365, month: 30, week: 7, day: 1 };
    const cutoff = new Date(Date.now() - days[range] * 24 * 60 * 60 * 1000);
    const recentProducts = products.filter((product: any) => {
      if (!product?.created_at) return false;
      const created = new Date(product.created_at);
      return created >= cutoff;
    });
    return {
      recentProducts: recentProducts.length,
      totalPublished: products.filter((product: any) => product?.is_published).length,
      latestProduct: products[0]?.title || "No products yet",
    };
  }, [products, range]);

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
      <section className="border-t border-border bg-background">
        <div className="mx-auto max-w-6xl px-6 py-14">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-accent">
                Activity filters
              </p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight">
                Review the homepage view by time range.
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Switch between Past Year, Month, Week, and Day to preview how recent activity is reflected.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {[
                { key: "year", label: "Past Year" },
                { key: "month", label: "Past Month" },
                { key: "week", label: "Past Week" },
                { key: "day", label: "Past Day" },
              ].map(option => (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => setRange(option.key as any)}
                  className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${range === option.key ? "bg-violet-500 text-white" : "bg-white/5 text-slate-300 hover:bg-white/10"}`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            <div className="rounded-3xl border border-border bg-card p-6">
              <p className="text-xs uppercase tracking-[0.2em] text-accent">Recent products</p>
              <p className="mt-4 text-4xl font-semibold text-white">{rangeCounts.recentProducts}</p>
              <p className="mt-2 text-sm text-muted-foreground">Created in the selected range</p>
            </div>
            <div className="rounded-3xl border border-border bg-card p-6">
              <p className="text-xs uppercase tracking-[0.2em] text-accent">Live products</p>
              <p className="mt-4 text-4xl font-semibold text-white">{rangeCounts.totalPublished}</p>
              <p className="mt-2 text-sm text-muted-foreground">Published on the site</p>
            </div>
            <div className="rounded-3xl border border-border bg-card p-6">
              <p className="text-xs uppercase tracking-[0.2em] text-accent">Latest launch</p>
              <p className="mt-4 text-4xl font-semibold text-white">{rangeCounts.latestProduct}</p>
              <p className="mt-2 text-sm text-muted-foreground">Most recent offer title</p>
            </div>
          </div>
        </div>
      </section>
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
