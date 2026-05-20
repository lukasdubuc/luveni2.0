import { Link } from "@tanstack/react-router";
import { site } from "@/config/site";

export function Footer({ description }: { description?: string }) {
  return (
    <footer className="border-t border-border bg-background">
      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-10 px-6 py-16 md:grid-cols-4">
        <div className="col-span-2">
          <div className="flex items-center gap-2.5 font-medium">
            <span
              className="grid h-7 w-7 place-items-center rounded-md text-xs font-semibold text-accent-foreground"
              style={{ backgroundImage: "var(--gradient-accent)" }}
            >
              {site.brand[0]}
            </span>
            <span className="font-display text-lg">{site.brand}</span>
          </div>
          <p className="mt-4 max-w-sm font-display text-xl leading-snug tracking-tight text-muted-foreground">
            {description ?? site.tagline}
          </p>
        </div>
        <div>
          <h4 className="text-xs font-medium uppercase tracking-[0.2em] text-accent">Product</h4>
          <ul className="mt-4 space-y-2.5 text-sm text-muted-foreground">
            <li><Link to="/offer" className="hover:text-foreground">Offer</Link></li>
            <li><Link to="/checkout" className="hover:text-foreground">Checkout</Link></li>
            <li><Link to="/about" className="hover:text-foreground">About</Link></li>
            <li><Link to="/contact" className="hover:text-foreground">Contact</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="text-xs font-medium uppercase tracking-[0.2em] text-accent">Legal</h4>
          <ul className="mt-4 space-y-2.5 text-sm text-muted-foreground">
            <li><Link to="/privacy" className="hover:text-foreground">Privacy</Link></li>
            <li><Link to="/terms" className="hover:text-foreground">Terms</Link></li>
            <li><Link to="/refund" className="hover:text-foreground">Refund</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-2 px-6 py-6 text-xs text-muted-foreground md:flex-row md:items-center">
          <p>© {new Date().getFullYear()} {site.brand}. All rights reserved.</p>
          <p>
            Questions? <a href={`mailto:${site.supportEmail}`} className="underline-offset-4 hover:text-foreground hover:underline">{site.supportEmail}</a>
          </p>
        </div>
      </div>
    </footer>
  );
}
