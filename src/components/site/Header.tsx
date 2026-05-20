import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import { site } from "@/config/site";

const navLinks = [
  { to: "/", label: "Home" },
  { to: "/shop", label: "Shop" },
  { to: "/offer", label: "Offer" },
  { to: "/about", label: "About" },
  { to: "/contact", label: "Contact" },
] as const;

export function Header() {
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-background/70 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Link to="/" className="flex items-center gap-2.5 font-medium tracking-tight">
          <span
            className="grid h-7 w-7 place-items-center rounded-md text-xs font-semibold text-accent-foreground"
            style={{ backgroundImage: "var(--gradient-accent)" }}
          >
            {site.brand[0]}
          </span>
          <span className="font-display text-lg">{site.brand}</span>
        </Link>
        <nav className="hidden items-center gap-8 md:flex">
          {navLinks.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
              activeProps={{ className: "text-foreground" }}
            >
              {l.label}
            </Link>
          ))}
          <Link
            to="/checkout"
            className="inline-flex items-center rounded-md px-4 py-2 text-sm font-medium text-accent-foreground transition-transform hover:-translate-y-0.5"
            style={{ backgroundImage: "var(--gradient-accent)" }}
          >
            Get started
          </Link>
        </nav>
        <button
          onClick={() => setOpen((v) => !v)}
          aria-label="Toggle menu"
          className="md:hidden inline-flex items-center justify-center rounded-md p-2 text-foreground"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>
      {open && (
        <div className="border-t border-border md:hidden">
          <div className="mx-auto flex max-w-6xl flex-col gap-1 px-6 py-4">
            {navLinks.map((l) => (
              <Link
                key={l.to}
                to={l.to}
                onClick={() => setOpen(false)}
                className="rounded-md px-3 py-2.5 text-sm text-foreground hover:bg-muted"
              >
                {l.label}
              </Link>
            ))}
            <Link
              to="/checkout"
              onClick={() => setOpen(false)}
              className="mt-2 inline-flex items-center justify-center rounded-md px-4 py-2.5 text-sm font-medium text-accent-foreground"
              style={{ backgroundImage: "var(--gradient-accent)" }}
            >
              Get started
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
