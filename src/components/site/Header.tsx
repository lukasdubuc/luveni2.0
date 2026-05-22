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
    <header className="sticky top-0 z-40 w-full border-b border-white bg-black">
      <div className="flex h-12 items-center justify-between px-4">
        {/* Logo */}
        <Link
          to="/shop"
          className="tight-mono text-[12px] text-white font-bold"
        >
          {site.brand}
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden items-center gap-6 md:flex">
          {navLinks.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className="text-tiny tight-mono text-white/50 hover:text-white transition-colors"
              activeProps={{ className: "text-white border-b border-white" }}
            >
              {l.label}
            </Link>
          ))}
        </nav>

        {/* Mobile Toggle */}
        <button
          onClick={() => setOpen((v) => !v)}
          className="md:hidden text-white"
        >
          {open ? <X size={16} /> : <Menu size={16} />}
        </button>
      </div>

      {/* Mobile Menu */}
      {open && (
        <div className="border-t border-white md:hidden bg-black">
          <div className="flex flex-col p-4 gap-4">
            {navLinks.map((l) => (
              <Link
                key={l.to}
                to={l.to}
                onClick={() => setOpen(false)}
                className="text-tiny tight-mono text-white/50 hover:text-white"
                activeProps={{ className: "text-white" }}
              >
                {l.label}
              </Link>
            ))}
          </div>
        </div>
      )}
    </header>
  );
}
