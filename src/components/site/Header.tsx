import { Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Menu, X } from "lucide-react";
import { site } from "@/config/site";
import { useCart } from "@/context/CartContext";

const navLinks = [
  { to: "/shop",  label: "SHOP"  },
  { to: "/about", label: "ABOUT" },
] as const;

// ── Yeezy-style minimal shopping bag SVG icon ─────────────────────────────────
function BagIcon({ size = 18 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="4" y="8" width="16" height="13" />
      <path d="M9 8 C9 8 9 4 12 4 C15 4 15 8 15 8" />
    </svg>
  );
}

// theme prop kept for API compatibility but no longer needed — tokens drive color
export function Header({ theme: _theme }: { theme?: "light" | "dark" } = {}) {
  const [open, setOpen] = useState(false);
  const { count } = useCart();

  // Lock body scroll while the mobile menu is open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  return (
    <header className="sticky top-0 z-50 bg-background text-foreground border-b md:border-b-0 border-border">
      <div className="flex h-14 w-full items-center justify-between px-6">

        {/* ── Left: burger (mobile) / brand (desktop) ── */}
        <div className="flex flex-1 items-center">
          <button
            onClick={() => setOpen((v) => !v)}
            aria-label="Toggle navigation"
            className="md:hidden flex items-center text-foreground"
          >
            {open ? <X size={18} /> : <Menu size={18} />}
          </button>

          <Link
            to="/shop"
            className="hidden md:block text-[13px] font-normal tracking-[0em] text-foreground"
            style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif' }}
          >
            {site.brand}
          </Link>
        </div>

        {/* ── Mobile center brand ── */}
        <Link
          to="/shop"
          className="md:hidden absolute left-1/2 -translate-x-1/2 text-[13px] font-normal tracking-[0em] text-foreground"
          style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif' }}
        >
          {site.brand}
        </Link>

        {/* ── Desktop center nav ── */}
        <nav className="hidden md:flex items-center gap-8">
          {navLinks.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className="text-[13px] font-normal tracking-[0em] transition-colors text-foreground/40 hover:text-foreground"
              activeProps={{ className: "text-[13px] font-normal tracking-[0em] text-foreground" }}
              style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif' }}
            >
              {l.label}
            </Link>
          ))}
        </nav>

        {/* ── Right: bag icon ── */}
        <div className="flex flex-1 justify-end">
          <Link
            to="/checkout"
            aria-label={`Cart${count > 0 ? `, ${count} item${count !== 1 ? "s" : ""}` : ""}`}
            className="relative flex items-center transition-opacity hover:opacity-60 text-foreground"
          >
            {count > 0 && (
              <span
                className="mr-1 text-[13px] font-normal leading-none text-foreground"
                style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif' }}
              >
                {count > 9 ? "9+" : count}
              </span>
            )}
            <BagIcon size={20} />
          </Link>
        </div>
      </div>

      {/* ── Mobile fullscreen menu (opaque takeover above the header) ── */}
      {open && (
        <div className="fixed inset-0 z-[60] md:hidden flex flex-col bg-background text-foreground">
          {/* Menu top bar mirrors the header so it reads as one surface */}
          <div className="flex h-14 w-full items-center justify-between px-6">
            <button
              onClick={() => setOpen(false)}
              aria-label="Close navigation"
              className="flex items-center text-foreground"
            >
              <X size={18} />
            </button>
            <Link
              to="/shop"
              onClick={() => setOpen(false)}
              className="absolute left-1/2 -translate-x-1/2 text-[13px] font-normal text-foreground"
              style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif' }}
            >
              {site.brand}
            </Link>
          </div>

          {/* Centered nav links */}
          <nav className="flex flex-1 flex-col items-center justify-center gap-7 overflow-y-auto px-6 py-10">
            {navLinks.map((l) => (
              <Link
                key={l.to}
                to={l.to}
                onClick={() => setOpen(false)}
                className="text-base font-normal uppercase tracking-[0.2em] text-foreground transition-opacity hover:opacity-60"
                style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif' }}
              >
                {l.label}
              </Link>
            ))}
            <Link
              to="/checkout"
              onClick={() => setOpen(false)}
              className="text-base font-normal uppercase tracking-[0.2em] text-foreground transition-opacity hover:opacity-60"
              style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif' }}
            >
              CART{count > 0 ? ` (${count})` : ""}
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}
