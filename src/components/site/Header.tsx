import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import { site } from "@/config/site";

const navLinks = [
  { to: "/shop",   label: "SHOP"    },
  { to: "/about",  label: "ABOUT"   },
  { to: "/contact",label: "CONTACT" },
] as const;

export function Header({ theme = "light" }: { theme?: "light" | "dark" }) {
  const [open, setOpen] = useState(false);
  const isDark = theme === "dark";

  return (
    <header className={`sticky top-0 z-50 border-b md:border-b-0 transition-colors duration-500 ${
      isDark ? "bg-black border-white/10" : "bg-white border-gray-100"
    }`}>
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        <div className="flex items-center gap-2">
          <Link
            to="/shop"
            className={`text-[12px] font-bold tracking-[0.2em] ${isDark ? "text-white" : "text-black"}`}
          >
            {site.brand}
          </Link>
          <span className={`md:hidden text-[10px] font-bold tracking-[0.3em] ${isDark ? "text-white/30" : "text-black/30"}`}>SHOP</span>
        </div>

        <nav className="hidden items-center gap-8 md:flex">
          {navLinks.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className={`text-[10px] tracking-[0.2em] transition-colors ${
                isDark ? "text-white/50 hover:text-white" : "text-black/50 hover:text-black"
              }`}
              activeProps={{ className: isDark ? "!text-white" : "!text-black" }}
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="md:hidden">
          <button
            onClick={() => setOpen((v) => !v)}
            className={isDark ? "text-white" : "text-black"}
            aria-label="Toggle navigation"
          >
            {open ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
        
        <div className="hidden w-[100px] md:block" />
      </div>

      {open && (
        <div className={`fixed inset-0 z-40 border-none md:hidden ${isDark ? "bg-black" : "bg-white"}`}>
          <div className="flex h-full flex-col items-center justify-center gap-8">
            {navLinks.map((l) => (
              <Link
                key={l.to}
                to={l.to}
                onClick={() => setOpen(false)}
                className={`text-[14px] tracking-[0.3em] transition-colors ${
                  isDark ? "text-white/50 hover:text-white" : "text-black/50 hover:text-black"
                }`}
                activeProps={{ className: isDark ? "!text-white" : "!text-black" }}
              >
                {l.label}
              </Link>
            ))}
            <button 
              onClick={() => setOpen(false)}
              className={`absolute right-6 top-6 ${isDark ? "text-white" : "text-black"}`}
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
