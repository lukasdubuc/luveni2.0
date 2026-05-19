import { Link } from "@tanstack/react-router";
import { Check, ArrowRight } from "lucide-react";
import { offer } from "@/config/site";

export function OfferSection({ products }: { products: any[] }) {
  // We grab the most recent product you deployed in the Admin
  const activeOffer = products && products.length > 0 ? products[0] : null;
  
  const handlePurchase = () => {
    // If you have a Stripe ID, we redirect to a checkout session
    if (activeOffer?.stripe_price_id) {
      window.location.href = `https://buy.stripe.com/${activeOffer.stripe_price_id}`;
    } else {
      // Fallback to a default or contact page if no Stripe ID set
      window.location.href = "/checkout";
    }
  };

  return (
    <section id="offer" className="border-t border-border bg-muted/40">
      <div className="mx-auto max-w-6xl px-4 py-20">
        <div className="grid items-center gap-10 md:grid-cols-2">
          <div>
            <p className="text-sm font-medium uppercase tracking-wider text-accent">Current Offer</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight md:text-4xl">
              {activeOffer?.title || offer.name}
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
              <span className="text-5xl font-semibold tracking-tight">
                ${activeOffer ? (activeOffer.price_cents / 100).toFixed(0) : offer.price}
              </span>
              <span className="text-base text-muted-foreground line-through">{offer.originalPrice}</span>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">Secure your spot today.</p>
            
            <button
              onClick={handlePurchase}
              className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-md px-6 py-3 text-base font-medium text-accent-foreground shadow-soft transition-transform hover:-translate-y-0.5"
              style={{ backgroundImage: "var(--gradient-accent)" }}
            >
              Get Started Now <ArrowRight className="h-4 w-4" />
            </button>
            <p className="mt-4 text-center text-xs text-muted-foreground">{offer.guarantee}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
