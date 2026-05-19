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

// ─── Fallback site config ────────────────────────────────────────────────────
// Used when the site_config table is empty, missing, or returns an error.
// Once you wire the admin "Website Editor" save button to Supabase, these
// values will be overridden by live DB data automatically.
export const SITE_CONFIG_FALLBACK = {
  hero_headline:         "A simple, modern way to actually get the result you want.",
  hero_subheadline:      "Everything you need to get started in one focused, no-fluff package.",
  hero_cta:              "Get instant access — $49",
  price_display:         "$49",
  price_original:        "$129",
  launch_pricing_active: true,
  guarantee_days:        "30",
};

export type SiteConfig = typeof SITE_CONFIG_FALLBACK;

// ─── Route definition ────────────────────────────────────────────────────────
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

  // Loader runs server-side (SSR) or on navigation. Both fetches are
  // independent — a failure in one never blocks the other.
  loader: async () => {
    // Run both fetches concurrently; never throw — always return safe shapes.
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

    // ── Products ──────────────────────────────────────────────────────────
    let products: any[] = [];
    if (productsResult.status === "fulfilled") {
      const { data, error } = productsResult.value;
      if (error) {
        console.warn("[Northwind] products fetch error:", error.message);
      } else {
        products = data ?? [];
      }
    } else {
      console.warn("[Northwind] products fetch rejected:", productsResult.reason);
    }

    // ── Site config ───────────────────────────────────────────────────────
    let siteConfig: SiteConfig = SITE_CONFIG_FALLBACK;
    if (configResult.status === "fulfilled") {
      const { data, error } = configResult.value;
      if (error) {
        console.warn("[Northwind] site_config fetch error:", error.message);
      } else if (data) {
        // Merge DB values over fallback so partial rows still work safely
        siteConfig = { ...SITE_CONFIG_FALLBACK, ...data };
      }
    } else {
      console.warn("[Northwind] site_config fetch rejected:", configResult.reason);
    }

    return { products, siteConfig };
  },

  component: Home,
});

// ─── Home component ──────────────────────────────────────────────────────────
function Home() {
  const { products, siteConfig } = Route.useLoaderData();
  const navigate = useNavigate();

  // ── OAuth redirect intercept ─────────────────────────────────────────────
  // Lovable's OAuth proxy always lands the user on "/" after Google sign-in.
  // The login page sets sessionStorage['active_login_intent'] = '1' before
  // triggering the OAuth flow. We detect that flag here and redirect to /admin
  // if the authenticated user is the authorised admin email.
  //
  // We do this in a useEffect (client-only) so:
  //   1. The loader's HTML never flashes the homepage visually for the admin.
  //   2. We avoid any SSR / hydration mismatch.
  //   3. We don't create an infinite loop (flag is removed immediately).
  useEffect(() => {
    const intent = sessionStorage.getItem("active_login_intent");
    if (!intent) return; // Normal public visitor — do nothing.

    // Remove the flag immediately so this block never fires twice.
    sessionStorage.removeItem("active_login_intent");

    const AUTHORIZED_EMAIL = "lukasdubuc@gmail.com";

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user?.email?.toLowerCase() === AUTHORIZED_EMAIL.toLowerCase()) {
        // Hard replace so the homepage never sits in browser history
        // between the OAuth callback and the admin dashboard.
        navigate({ to: "/admin", replace: true });
      }
      // If somehow a non-admin completed OAuth, do nothing — they stay on
      // the public storefront, which is the correct behaviour.
    });
  }, [navigate]);

  return (
    <>
      {/* Pass live config so every copy block can be driven from the DB */}
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
