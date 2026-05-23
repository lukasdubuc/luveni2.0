import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { SITE_CONFIG_FALLBACK, type SiteConfig } from "@/config/site";

export function CTASection({ siteConfig }: { siteConfig?: SiteConfig }) {
  const cfg = siteConfig ?? SITE_CONFIG_FALLBACK;
  return (
    <section className="border-t border-black/10 bg-background text-foreground">
      <div className="mx-auto max-w-7xl px-6 py-24 md:py-32">
        <div
          className="relative overflow-hidden border border-black/10 p-12 text-center md:p-20 bg-background/50"
         
        >
          <div className="relative">
            <h2 className="mx-auto max-w-2xl text-4xl tracking-tight md:text-6xl">
              Ready when <span className="serif-italic text-foreground">you</span> are.
            </h2>
            <p className="mx-auto mt-5 max-w-xl text-sm text-muted-foreground md:text-base">
              One small decision today. {cfg.guarantee_days}-day money-back guarantee.
            </p>
            <Link
              to="/checkout"
              className="mt-10 inline-flex items-center justify-center gap-2 rounded-md bg-foreground px-8 py-3.5 text-sm font-medium text-background transition-transform hover:-translate-y-0.5"
            >
              {cfg.hero_cta}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
