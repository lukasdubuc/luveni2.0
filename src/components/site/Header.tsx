import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import { site } from "@/config/site";

const navLinks = [
  { to: "/",       label: "Home"    },
  { to: "/shop",   label: "Shop"    },
  { to: "/offer",  label: "Offer"   },
  { to: "/about",  label: "About"   },
  { to: "/contact",label: "Contact" },
] as const;

export function Header() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 w-full border-b border-white/10 bg-black">
      {/* ── Desktop bar ── */}
      <div className="mx-auto flex h-14 max-w-none items-center justify-between px-6">

        {/* Logo */}
        <Link
          to="/"
          className="flex items-center gap-2 font-mono text-[11px] tracking-[0.3em] uppercase text-white font-bold"
        >
          {site.brand}
        </Link>

        {/* Centre nav — desktop */}
        <nav className="hidden items-center gap-8 md:flex">
          {navLinks.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className="font-mono text-[10px] tracking-[0.22em] uppercase text-white/40 transition-colors hover:text-white"
              activeProps={{ className: "font-mono text-[10px] tracking-[0.22em] uppercase text-white border-b border-white pb-px" }}
            >
              {l.label}
            </Link>
          ))}
        </nav>

        {/* Right side — desktop */}
        <div className="hidden md:flex items-center gap-6">
          <Link
            to="/checkout"
            className="font-mono text-[10px] tracking-[0.22em] uppercase border border-white text-white px-4 py-2 hover:bg-white hover:text-black transition-colors"
          >
            Get started
          </Link>
        </div>

        {/* Hamburger — mobile */}
        <button
          onClick={() => setOpen((v) => !v)}
          aria-label="Toggle menu"
          className="md:hidden text-white p-1"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* ── Mobile drawer ── */}
      {open && (
        <div className="border-t border-white/10 md:hidden bg-black">
          <div className="flex flex-col px-6 py-5 gap-1">
            {navLinks.map((l) => (
              <Link
                key={l.to}
                to={l.to}
                onClick={() => setOpen(false)}
                className="font-mono text-[11px] tracking-[0.22em] uppercase text-white/40 py-3 border-b border-white/5 hover:text-white transition-colors"
                activeProps={{ className: "font-mono text-[11px] tracking-[0.22em] uppercase text-white py-3 border-b border-white/5" }}
              >
                {l.label}
              </Link>
            ))}
            <Link
              to="/checkout"
              onClick={() => setOpen(false)}
              className="mt-4 font-mono text-[11px] tracking-[0.22em] uppercase border border-white text-white px-4 py-3 text-center hover:bg-white hover:text-black transition-colors"
            >
              Get started
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
