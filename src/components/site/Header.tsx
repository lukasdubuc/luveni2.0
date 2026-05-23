import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import { site } from "@/config/site";

const navLinks = [
  { to: "/shop",    label: "SHOP"    },
  { to: "/about",   label: "ABOUT"   },
  { to: "/contact", label: "CONTACT" },
] as const;

const cartStyle: React.CSSProperties = {
  fontSize: "9px",
  fontFamily: "sans-serif",
  fontWeight: 700,
  letterSpacing: "0.28em",
  textTransform: "uppercase",
  background: "none",
  border: "none",
  cursor: "pointer",
  padding: 0,
  color: "inherit",
};

export function Header({ theme = "light" }: { theme?: "light" | "dark" }) {
  const [open, setOpen] = useState(false);
  const isDark = theme === "dark";
  const colorClass = isDark ? "text-white" : "text-black";
  const mutedClass = isDark ? "text-white/50" : "text-black/50";

  return (
    <header
      className={`sticky top-0 z-50 transition-colors duration-500 ${
        isDark
          ? "bg-black border-b border-white/10 md:border-0"
          : "bg-white border-b border-gray-100 md:border-0"
      }`}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">

        {/* ── Mobile: burger top-left ── */}
        <div className="md:hidden flex items-center">
          <button
            onClick={() => setOpen((v) => !v)}
            className={colorClass}
            aria-label="Toggle navigation"
          >
            {open ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>

        {/* ── Brand (center on mobile, left on desktop) ── */}
        <div className="flex flex-1 items-center justify-center md:justify-start">
          <Link
            to="/shop"
            className={`text-[12px] font-bold tracking-[0.2em] ${colorClass}`}
          >
            {site.brand}
          </Link>
        </div>

        {/* ── Desktop nav ── */}
        <nav className="hidden md:flex flex-none items-center gap-8">
          {navLinks.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className={`text-[10px] tracking-[0.2em] transition-colors ${mutedClass} hover:${colorClass}`}
              activeProps={{ className: isDark ? "!text-white" : "!text-black" }}
            >
              {l.label}
            </Link>
          ))}
        </nav>

        {/* ── Right slot: CART (both) ── */}
        <div className="flex flex-1 justify-end">
          <Link to="/checkout">
            <button
              style={{
                ...cartStyle,
                color: isDark ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.5)",
              }}
              onMouseEnter={(e) =>
                ((e.currentTarget as HTMLButtonElement).style.color = isDark ? "#fff" : "#000")
              }
              onMouseLeave={(e) =>
                ((e.currentTarget as HTMLButtonElement).style.color = isDark
                  ? "rgba(255,255,255,0.5)"
                  : "rgba(0,0,0,0.5)")
              }
            >
              CART
            </button>
          </Link>
        </div>
      </div>

      {/* ── Mobile overlay menu ── */}
      {open && (
        <div
          className={`fixed inset-0 z-40 md:hidden ${isDark ? "bg-black" : "bg-white"}`}
        >
          <div className="flex h-full flex-col items-center justify-center gap-8">
            {navLinks.map((l) => (
              <Link
                key={l.to}
                to={l.to}
                onClick={() => setOpen(false)}
                className={`text-[14px] tracking-[0.3em] transition-colors ${mutedClass}`}
                activeProps={{ className: isDark ? "!text-white" : "!text-black" }}
              >
                {l.label}
              </Link>
            ))}
          </div>
          <button
            onClick={() => setOpen(false)}
            className={`absolute right-6 top-6 ${colorClass}`}
            aria-label="Close navigation"
          >
            <X size={24} />
          </button>
        </div>
      )}
    </header>
  );
}
