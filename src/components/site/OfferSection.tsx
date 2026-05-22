import { Link } from "@tanstack/react-router";
import { Check, ArrowRight } from "lucide-react";
import { offer, SITE_CONFIG_FALLBACK, type SiteConfig } from "@/config/site";
import { useProducts } from "@/lib/useProducts";

export function OfferSection({ products, siteConfig, checkoutHref, checkoutDisabled }: { products?: any[]; siteConfig?: SiteConfig; checkoutHref?: string; checkoutDisabled?: boolean }) {
  const cfg = siteConfig ?? SITE_CONFIG_FALLBACK;
  // Prefer passed-in products (from Home loader). If not provided, use shared hook so
  // OfferSection and Shop share the same product-fetching logic.
  const { products: clientProducts } = useProducts({ onlyPublished: true });
  const activeOffer = (products && products.length > 0) ? products[0] : (clientProducts && clientProducts.length > 0 ? clientProducts[0] : null);
  const description = activeOffer?.description ?? offer.shortPitch;
  const bullets = activeOffer?.bullet_points?.length
    ? activeOffer.bullet_points
    : activeOffer?.description
    ? activeOffer.description.split('\n').map((line: string) => line.trim()).filter(Boolean)
    : offer.bullets;
  const checkoutPath = checkoutHref ?? (activeOffer ? `/checkout?productId=${encodeURIComponent(activeOffer.id)}` : "/checkout");

  return (
    <section
      id="offer"
      className="relative border-t border-black/10 bg-white"
    >
      <div className="mx-auto max-w-7xl px-6 py-24 md:py-32">
        <div className="grid items-center gap-12 md:grid-cols-2">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-black">
              The offer
            </p>
            <h2 className="mt-4 text-4xl tracking-tight md:text-5xl">
              {activeOffer?.title || offer.name}
            </h2>
            <p className="mt-5 max-w-md text-black/55">{description}</p>
            <ul className="mt-8 space-y-4">
              {bullets.map((b: string) => (
                <li key={b} className="flex items-start gap-3 text-sm">
                  <span className="mt-0.5 grid h-5 w-5 flex-none place-items-center rounded-full bg-accent/15 text-black">
                    <Check className="h-3 w-3" />
                  </span>
                  <span className="text-black/90">{b}</span>
                </li>
              ))}
            </ul>
          </div>

          <div
            className="relative overflow-hidden border border-black/10 p-10"
           
          >
            <div className="relative">
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-black/55">
                {offer.badge}
              </p>
              <div className="mt-6 flex items-baseline gap-3">
                <span className="font-display text-7xl tracking-tight">
                  {activeOffer ? `$${(activeOffer.price_cents / 100).toFixed(0)}` : cfg.price_display}
                </span>
                {cfg.launch_pricing_active && cfg.price_original && (
                  <span className="text-sm text-black/55 line-through">
                    {cfg.price_original}
                  </span>
                )}
              </div>
              <p className="mt-2 text-sm text-black/55">
                One-time. Lifetime updates included.
              </p>

              <Link
                to={checkoutPath}
                className={`group mt-8 inline-flex w-full items-center justify-center gap-2 rounded-md px-6 py-3.5 text-sm font-medium text-black-foreground transition-transform hover:-translate-y-0.5 ${checkoutDisabled ? "pointer-events-none opacity-60" : ""}`}
                aria-disabled={checkoutDisabled}
              >
                Get started now
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
              <p className="mt-5 text-center text-xs text-black/55">
                {offer.guarantee}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
