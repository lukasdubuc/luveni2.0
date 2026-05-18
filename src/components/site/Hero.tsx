import { Link } from "@tanstack/react-router";
import { ArrowRight, Sparkles } from "lucide-react";
import { offer, site } from "@/config/site";

export function Hero() {
  return (
    <section
      className="relative overflow-hidden"
      style={{ backgroundImage: "var(--gradient-hero)" }}
    >
      <div className="mx-auto max-w-6xl px-4 pt-20 pb-24 md:pt-28 md:pb-32">
        <div className="mx-auto max-w-3xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground shadow-soft">
            <Sparkles className="h-3.5 w-3.5 text-accent" />
            {offer.badge}
          </div>
          <h1 className="mt-6 text-4xl font-semibold tracking-tight md:text-6xl">
            {site.tagline}
          </h1>
          <p className="mt-5 text-lg text-muted-foreground md:text-xl">
            {offer.shortPitch}
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              to="/checkout"
              className="group inline-flex w-full items-center justify-center gap-2 rounded-md px-6 py-3 text-base font-medium text-accent-foreground shadow-elevated transition-transform hover:-translate-y-0.5 sm:w-auto"
              style={{ backgroundImage: "var(--gradient-accent)" }}
            >
              Get instant access — {offer.price}
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
            <Link
              to="/offer"
              className="inline-flex w-full items-center justify-center rounded-md border border-border bg-card px-6 py-3 text-base font-medium text-foreground transition-colors hover:bg-muted sm:w-auto"
            >
              See what's included
            </Link>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            {offer.guarantee}
          </p>
        </div>
      </div>
    </section>
  );
}
