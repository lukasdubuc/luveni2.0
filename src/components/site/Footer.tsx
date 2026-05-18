import { Link } from "@tanstack/react-router";
import { site } from "@/config/site";

export function Footer() {
  return (
    <footer className="border-t border-border bg-muted/40">
      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-8 px-4 py-12 md:grid-cols-4">
        <div className="col-span-2 md:col-span-2">
          <div className="flex items-center gap-2 font-semibold">
            <span className="grid h-7 w-7 place-items-center rounded-md bg-primary text-primary-foreground text-sm">
              {site.brand[0]}
            </span>
            {site.brand}
          </div>
          <p className="mt-3 max-w-sm text-sm text-muted-foreground">
            {site.tagline}
          </p>
        </div>
        <div>
          <h4 className="text-sm font-semibold">Product</h4>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li><Link to="/offer" className="hover:text-foreground">Offer</Link></li>
            <li><Link to="/checkout" className="hover:text-foreground">Checkout</Link></li>
            <li><Link to="/about" className="hover:text-foreground">About</Link></li>
            <li><Link to="/contact" className="hover:text-foreground">Contact</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="text-sm font-semibold">Legal</h4>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li><Link to="/privacy" className="hover:text-foreground">Privacy Policy</Link></li>
            <li><Link to="/terms" className="hover:text-foreground">Terms of Service</Link></li>
            <li><Link to="/refund" className="hover:text-foreground">Refund Policy</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-2 px-4 py-6 text-xs text-muted-foreground md:flex-row md:items-center">
          <p>© {new Date().getFullYear()} {site.brand}. All rights reserved.</p>
          <p>
            Questions? <a href={`mailto:${site.supportEmail}`} className="underline hover:text-foreground">{site.supportEmail}</a>
          </p>
        </div>
      </div>
    </footer>
  );
}
