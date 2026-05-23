import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import { site } from "@/config/site";

const navLinks = [
  { to: "/shop",   label: "SHOP"    },
  { to: "/about",  label: "ABOUT"   },
  { to: "/contact",label: "CONTACT" },
] as const;

export function Header() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-none bg-white md:border-none border-b border-black md:border-b-0">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        <div>
          <Link
            to="/shop"
            className="text-[12px] font-bold tracking-[0.2em] text-black"
          >
            {site.brand}
          </Link>
          <span className="md:hidden text-[10px] font-bold tracking-[0.3em] text-black/30">SHOP</span>
        </div>

        <nav className="hidden items-center gap-8 md:flex">
          {navLinks.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className="text-[10px] tracking-[0.2em] text-black/50 transition-colors hover:text-black"
              activeProps={{ className: "text-black" }}
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="md:hidden">
          <button
            onClick={() => setOpen((v) => !v)}
            className="text-black"
            aria-label="Toggle navigation"
          >
            {open ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
        
        <div className="hidden w-[100px] md:block" />
      </div>

      {open && (
        <div className="fixed inset-0 z-40 border-none bg-white md:hidden">
          <div className="flex h-full flex-col items-center justify-center gap-8">
            {navLinks.map((l) => (
              <Link
                key={l.to}
                to={l.to}
                onClick={() => setOpen(false)}
                className="text-[14px] tracking-[0.3em] text-black/50 hover:text-black"
                activeProps={{ className: "text-black" }}
              >
                {l.label}
              </Link>
            ))}
            <button 
              onClick={() => setOpen(false)}
              className="absolute right-6 top-6 text-black"
              aria-label="Close navigation"
            >
              <X size={24} />
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
