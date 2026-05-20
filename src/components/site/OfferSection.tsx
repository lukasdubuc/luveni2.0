import { Link } from "@tanstack/react-router";
import { Check, ArrowRight } from "lucide-react";
import { offer, SITE_CONFIG_FALLBACK, type SiteConfig } from "@/config/site";

export function OfferSection({ products, siteConfig }: { products?: any[]; siteConfig?: SiteConfig }) {
  const cfg = siteConfig ?? SITE_CONFIG_FALLBACK;
  const activeOffer = products && products.length > 0 ? products[0] : null;
  const description = activeOffer?.description ?? offer.shortPitch;
  const bullets = activeOffer?.description
    ? activeOffer.description.split('\n').map((line: string) => line.trim()).filter(Boolean)
    : offer.bullets;

  return (
    <section
      id="offer"
      className="relative border-t border-border bg-background"
    >
      <div className="mx-auto max-w-6xl px-6 py-24 md:py-32">
        <div className="grid items-center gap-12 md:grid-cols-2">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-accent">
              The offer
            </p>
            <h2 className="mt-4 text-4xl tracking-tight md:text-5xl">
              {activeOffer?.title || offer.name}
            </h2>
            <p className="mt-5 max-w-md text-muted-foreground">{description}</p>
            <ul className="mt-8 space-y-4">
              {bullets.map((b: string) => (
                <li key={b} className="flex items-start gap-3 text-sm">
                  <span className="mt-0.5 grid h-5 w-5 flex-none place-items-center rounded-full bg-accent/15 text-accent">
                    <Check className="h-3 w-3" />
                  </span>
                  <span className="text-foreground/90">{b}</span>
                </li>
              ))}
            </ul>
          </div>

          <div
            className="relative overflow-hidden rounded-3xl border border-border p-10"
            style={{ backgroundImage: "var(--gradient-surface)" }}
          >
            <div
              aria-hidden
              className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full opacity-30 blur-3xl"
              style={{ background: "var(--gradient-accent)" }}
            />
            <div className="relative">
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
                {offer.badge}
              </p>
              <div className="mt-6 flex items-baseline gap-3">
                <span className="font-display text-7xl tracking-tight">
                  {activeOffer ? `$${(activeOffer.price_cents / 100).toFixed(0)}` : cfg.price_display}
                </span>
                {cfg.launch_pricing_active && cfg.price_original && (
                  <span className="text-sm text-muted-foreground line-through">
                    {cfg.price_original}
                  </span>
                )}
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                One-time. Lifetime updates included.
              </p>

              <Link
                to="/checkout"
                className="group mt-8 inline-flex w-full items-center justify-center gap-2 rounded-md px-6 py-3.5 text-sm font-medium text-accent-foreground transition-transform hover:-translate-y-0.5"
                style={{
                  backgroundImage: "var(--gradient-accent)",
                  boxShadow: "var(--shadow-glow)",
                }}
              >
                Get started now
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
              <p className="mt-5 text-center text-xs text-muted-foreground">
                {offer.guarantee}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
