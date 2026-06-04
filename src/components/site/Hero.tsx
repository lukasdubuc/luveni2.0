import { Link } from "@tanstack/react-router";
import { ArrowRight, Sparkles } from "lucide-react";
import DOMPurify from "isomorphic-dompurify";
import { offer } from "@/config/site";
import { SITE_CONFIG_FALLBACK, type SiteConfig } from "@/lib/site-config";

const SANITIZE_OPTS = {
  ALLOWED_TAGS: ["span", "strong", "em", "br", "b", "i", "u"],
  ALLOWED_ATTR: ["class"],
};

export function Hero({ siteConfig }: { siteConfig?: SiteConfig }) {
  const cfg = siteConfig ?? SITE_CONFIG_FALLBACK;
  return (
    <section
      className="relative overflow-hidden border-b border-black/10 bg-white"
    >
      <div className="relative mx-auto max-w-7xl px-6 pt-24 pb-28 md:pt-36 md:pb-40">
        <div className="mx-auto max-w-3xl text-center">
          {cfg.launch_pricing_active && (
            <div className="inline-flex items-center gap-2 border border-black/10 bg-white px-3 py-1 text-xs font-medium text-black/55">
              <Sparkles className="h-3.5 w-3.5 text-black" />
              {offer.badge}
            </div>
          )}
          <h1 
            className="mt-8 text-5xl tracking-tight md:text-7xl"
            dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(cfg.hero_headline, SANITIZE_OPTS) }}
          />
          <p 
            className="mx-auto mt-6 max-w-xl text-base text-black/55 md:text-lg"
            dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(cfg.hero_subheadline, SANITIZE_OPTS) }}
          />
         <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              to="/shop" // Changed from /offer
              className="group inline-flex w-full items-center justify-center gap-2 rounded-md px-7 py-3.5 text-sm font-medium text-black-foreground transition-transform hover:-translate-y-0.5 sm:w-auto"
            >
              {cfg.hero_cta}
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
            <Link
              to="/shop" // Changed from /offer
              className="inline-flex w-full items-center justify-center border border-black/10 bg-white px-7 py-3.5 text-sm font-medium text-black transition-colors hover:border-black sm:w-auto"
            >
              See what's included
            </Link>
          </div>
          <p className="mt-5 text-xs text-black/55">
            {cfg.guarantee_days}-day money-back guarantee. No questions asked.
          </p>
        </div>
      </div>
    </section>
  );
}
