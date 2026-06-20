import { Link } from "@tanstack/react-router";
import { site } from "@/config/site";

// theme prop kept for API compatibility but no longer needed — tokens drive color
export function Footer({ description: _description, theme: _theme }: { description?: string; theme?: "light" | "dark" } = {}) {
  return (
    <footer className="border-t border-border bg-background text-foreground px-6 py-12">
      <div className="mx-auto flex max-w-7xl flex-col items-center gap-8">
        <div className="flex flex-wrap justify-center gap-x-8 gap-y-4">
          <Link to="/shop" className="text-[10px] tracking-[0.2em] transition-colors text-foreground/50 hover:text-foreground">SHOP</Link>
          <Link to="/about" className="text-[10px] tracking-[0.2em] transition-colors text-foreground/50 hover:text-foreground">ABOUT</Link>
          <Link to="/contact" className="text-[10px] tracking-[0.2em] transition-colors text-foreground/50 hover:text-foreground">CONTACT</Link>
          <Link to="/shipping" className="text-[10px] tracking-[0.2em] transition-colors text-foreground/50 hover:text-foreground">SHIPPING</Link>
          <Link to="/refund" className="text-[10px] tracking-[0.2em] transition-colors text-foreground/50 hover:text-foreground">REFUND</Link>
          <Link to="/privacy" className="text-[10px] tracking-[0.2em] transition-colors text-foreground/50 hover:text-foreground">PRIVACY</Link>
          <Link to="/terms" className="text-[10px] tracking-[0.2em] transition-colors text-foreground/50 hover:text-foreground">TERMS</Link>
        </div>

        <div className="flex flex-col items-center gap-2">
          <span className="text-[10px] font-bold tracking-[0.3em] text-foreground">{site.brand}</span>
          <span className="text-[8px] tracking-[0.2em] text-foreground/30">©{new Date().getFullYear()}</span>
        </div>
      </div>
    </footer>
  );
}
