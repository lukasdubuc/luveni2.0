import { Link } from "@tanstack/react-router";
import { ArrowRight, Sparkles } from "lucide-react";
import { offer } from "@/config/site";
import { SITE_CONFIG_FALLBACK, type SiteConfig } from "@/lib/site-config";

export function Hero({ siteConfig }: { siteConfig?: SiteConfig }) {
  const cfg = siteConfig ?? SITE_CONFIG_FALLBACK;
  return (
    <section
      className="relative overflow-hidden"
      style={{ backgroundImage: "var(--gradient-hero)" }}
    >
      {/* Ambient orb */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 left-1/2 h-[520px] w-[520px] -translate-x-1/2 rounded-full opacity-60 blur-3xl"
        style={{ background: "var(--gradient-accent)" }}
      />
      {/* Grid texture */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            "linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)",
          backgroundSize: "64px 64px",
          maskImage:
            "radial-gradient(ellipse at center, black 30%, transparent 75%)",
        }}
      />

      <div className="relative mx-auto max-w-6xl px-6 pt-24 pb-28 md:pt-36 md:pb-40">
        <div className="mx-auto max-w-3xl text-center">
          {cfg.launch_pricing_active && (
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur">
              <Sparkles className="h-3.5 w-3.5 text-accent" />
              {offer.badge}
            </div>
          )}
          <h1 className="mt-8 text-5xl tracking-tight md:text-7xl">
            {cfg.hero_headline}
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-base text-muted-foreground md:text-lg">
            {cfg.hero_subheadline}
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              to="/checkout"
              className="group inline-flex w-full items-center justify-center gap-2 rounded-md px-7 py-3.5 text-sm font-medium text-accent-foreground transition-transform hover:-translate-y-0.5 sm:w-auto"
              style={{
                backgroundImage: "var(--gradient-accent)",
                boxShadow: "var(--shadow-glow)",
              }}
            >
              {cfg.hero_cta}
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
            <Link
              to="/offer"
              className="inline-flex w-full items-center justify-center rounded-md border border-border bg-card/40 px-7 py-3.5 text-sm font-medium text-foreground backdrop-blur transition-colors hover:bg-card sm:w-auto"
            >
              See what's included
            </Link>
          </div>
          <p className="mt-5 text-xs text-muted-foreground">
            {cfg.guarantee_days}-day money-back guarantee. No questions asked.
          </p>
        </div>
      </div>
    </section>
  );
}
