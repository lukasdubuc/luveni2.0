import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { offer } from "@/config/site";

export function CTASection() {
  return (
    <section className="border-t border-border bg-background">
      <div className="mx-auto max-w-6xl px-6 py-24 md:py-32">
        <div
          className="relative overflow-hidden rounded-3xl border border-border p-12 text-center md:p-20"
          style={{ backgroundImage: "var(--gradient-hero)" }}
        >
          <div
            aria-hidden
            className="pointer-events-none absolute -top-24 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full opacity-50 blur-3xl"
            style={{ background: "var(--gradient-accent)" }}
          />
          <div className="relative">
            <h2 className="mx-auto max-w-2xl text-4xl tracking-tight md:text-6xl">
              Ready when <span className="serif-italic text-accent">you</span> are.
            </h2>
            <p className="mx-auto mt-5 max-w-xl text-sm text-muted-foreground md:text-base">
              One small decision today. {offer.guarantee}
            </p>
            <Link
              to="/checkout"
              className="mt-10 inline-flex items-center justify-center gap-2 rounded-md px-8 py-3.5 text-sm font-medium text-accent-foreground transition-transform hover:-translate-y-0.5"
              style={{
                backgroundImage: "var(--gradient-accent)",
                boxShadow: "var(--shadow-glow)",
              }}
            >
              Get instant access — {offer.price}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
