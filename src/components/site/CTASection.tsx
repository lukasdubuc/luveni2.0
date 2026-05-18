import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { offer } from "@/config/site";

export function CTASection() {
  return (
    <section className="border-t border-border bg-background">
      <div className="mx-auto max-w-4xl px-4 py-20 text-center">
        <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">
          Ready when you are.
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
          One small decision today. {offer.guarantee}
        </p>
        <Link
          to="/checkout"
          className="mt-8 inline-flex items-center justify-center gap-2 rounded-md px-7 py-3 text-base font-medium text-accent-foreground shadow-elevated transition-transform hover:-translate-y-0.5"
          style={{ backgroundImage: "var(--gradient-accent)" }}
        >
          Get instant access — {offer.price}
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </section>
  );
}
