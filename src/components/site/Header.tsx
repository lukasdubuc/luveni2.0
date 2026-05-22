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
    <header className="fixed top-0 left-0 right-0 z-50 bg-transparent pointer-events-none">
      <div className="flex h-16 items-center justify-between px-6">
        {/* Logo - Left */}
        <div className="pointer-events-auto">
          <Link
            to="/shop"
            className="text-[12px] tracking-[0.2em] text-white font-bold"
          >
            {site.brand}
          </Link>
        </div>

        {/* Desktop Nav - Center */}
        <nav className="hidden items-center gap-8 md:flex pointer-events-auto">
          {navLinks.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className="text-[10px] tracking-[0.2em] text-white/40 hover:text-white transition-colors"
              activeProps={{ className: "text-white" }}
            >
              {l.label}
            </Link>
          ))}
        </nav>

        {/* Mobile Toggle - Right */}
        <div className="md:hidden pointer-events-auto">
          <button
            onClick={() => setOpen((v) => !v)}
            className="text-white"
          >
            {open ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
        
        {/* Placeholder for balance on desktop */}
        <div className="hidden md:block w-[100px]"></div>
      </div>

      {/* Mobile Menu */}
      {open && (
        <div className="fixed inset-0 bg-black z-40 pointer-events-auto md:hidden">
          <div className="flex flex-col items-center justify-center h-full gap-8">
            {navLinks.map((l) => (
              <Link
                key={l.to}
                to={l.to}
                onClick={() => setOpen(false)}
                className="text-[14px] tracking-[0.3em] text-white/50 hover:text-white"
                activeProps={{ className: "text-white" }}
              >
                {l.label}
              </Link>
            ))}
            <button 
              onClick={() => setOpen(false)}
              className="absolute top-6 right-6 text-white"
            >
              <X size={24} />
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
