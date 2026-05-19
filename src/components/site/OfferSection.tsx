import { Link } from "@tanstack/react-router";
import { Check, ArrowRight } from "lucide-react";
import { offer } from "@/config/site";

// We now accept 'products' as a prop from the home page
export function OfferSection({ products }: { products: any[] }) {
  // Use the first product from Supabase, or fall back to config if empty
  const liveOffer = products && products.length > 0 ? products[0] : null;
  
  // Format price: Supabase stores cents (e.g. 4900), we want string (e.g. "$49")
  const displayPrice = liveOffer 
    ? `$${Math.floor(liveOffer.price_cents / 100)}` 
    : offer.price;

  return (
    <section id="offer" className="border-t border-border bg-muted/40">
      <div className="mx-auto max-w-6xl px-4 py-20">
        <div className="grid items-center gap-10 md:grid-cols-2">
          <div>
            <p className="text-sm font-medium uppercase tracking-wider text-accent">
              The offer
            </p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight md:text-4xl">
              {liveOffer?.title || offer.name}
            </h2>
            <p className="mt-4 text-muted-foreground">{offer.shortPitch}</p>
            <ul className="mt-6 space-y-3">
              {offer.bullets.map((b) => (
                <li key={b} className="flex items-start gap-3 text-sm">
                  <span className="mt-0.5 grid h-5 w-5 flex-none place-items-center rounded-full bg-success/15 text-success">
                    <Check className="h-3.5 w-3.5" />
                  </span>
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl border border-border bg-card p-8 shadow-elevated">
            <div className="flex items-baseline gap-3">
              <span className="text-5xl font-semibold tracking-tight">{displayPrice}</span>
              <span className="text-base text-muted-foreground line-through">{offer.originalPrice}</span>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">One-time payment. Lifetime access.</p>
            <Link
              to="/checkout"
              // Pass the product ID to the checkout if needed
              search={{ plan: liveOffer?.id }}
              className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-md px-6 py-3 text-base font-medium text-accent-foreground shadow-soft transition-transform hover:-translate-y-0.5"
              style={{ backgroundImage: "var(--gradient-accent)" }}
            >
              Buy now <ArrowRight className="h-4 w-4" />
            </Link>
            <p className="mt-4 text-center text-xs text-muted-foreground">{offer.guarantee}</p>
            <div className="mt-6 grid grid-cols-3 gap-3 text-center text-xs text-muted-foreground">
              <div className="rounded-md border border-border py-2">Secure</div>
              <div className="rounded-md border border-border py-2">Instant</div>
              <div className="rounded-md border border-border py-2">Guaranteed</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
