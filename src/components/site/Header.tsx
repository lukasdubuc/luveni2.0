import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import { site } from "@/config/site";
import { useCart } from "@/context/CartContext";

const navLinks = [
  { to: "/shop",    label: "SHOP"    },
  { to: "/about",   label: "ABOUT"   },
  { to: "/contact", label: "CONTACT" },
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
      {/* rectangular bag body */}
      <rect x="4" y="8" width="16" height="13" />
      {/* left handle */}
      <path d="M9 8 C9 8 9 4 12 4 C15 4 15 8 15 8" />
    </svg>
  );
}

export function Header({ theme = "light" }: { theme?: "light" | "dark" }) {
  const [open, setOpen] = useState(false);
  const { count } = useCart();
  const isDark = theme === "dark";

  const colorCls   = isDark ? "text-white"      : "text-black";
  const mutedCls   = isDark ? "text-white/40"   : "text-black/40";
  const bgCls      = isDark ? "bg-black"        : "bg-white";
  const borderCls  = isDark ? "border-white/10" : "border-black/8";
  const overlayBg  = isDark ? "bg-black"        : "bg-white";

  return (
    <header
      className={`sticky top-0 z-50 transition-colors duration-500 ${bgCls} border-b md:border-b-0 ${borderCls}`}
    >
      <div className="flex h-14 w-full items-center justify-between px-6">

        {/* ── Left: burger (mobile) / brand (desktop) ── */}
        <div className="flex flex-1 items-center">
          {/* Mobile burger — top-left, no label */}
          <button
            onClick={() => setOpen((v) => !v)}
            aria-label="Toggle navigation"
            className={`md:hidden flex items-center ${colorCls}`}
          >
            {open ? <X size={18} /> : <Menu size={18} />}
          </button>

          {/* Desktop brand */}
          <Link
            to="/shop"
            className={`hidden md:block text-[13px] font-normal tracking-[0em] ${colorCls}`}
            style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif' }}
          >
            {site.brand}
          </Link>
        </div>

        {/* ── Mobile center brand ── */}
        <Link
          to="/shop"
          className={`md:hidden absolute left-1/2 -translate-x-1/2 text-[13px] font-normal tracking-[0em] ${colorCls}`}
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
              className={`text-[13px] font-normal tracking-[0em] transition-colors ${mutedCls} hover:${colorCls}`}
              activeProps={{ className: `text-[13px] font-normal tracking-[0em] ${colorCls}` }}
              style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif' }}
            >
              {l.label}
            </Link>
          ))}
        </nav>

        {/* ── Right: bag icon (both breakpoints) ── */}
        <div className="flex flex-1 justify-end">
          <Link
            to="/checkout"
            aria-label={`Cart${count > 0 ? `, ${count} item${count !== 1 ? "s" : ""}` : ""}`}
            className={`relative flex items-center transition-opacity hover:opacity-60 ${colorCls}`}
          >
            {/* Yeezy-style: count number sits inline left of the bag icon */}
            {count > 0 && (
              <span
                className={`mr-1 text-[13px] font-normal leading-none ${colorCls}`}
                style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif' }}
              >
                {count > 9 ? "9+" : count}
              </span>
            )}
            <BagIcon size={20} />
          </Link>
        </div>
      </div>

      {/* ── Mobile fullscreen overlay ── */}
      {open && (
        <div
          className={`fixed inset-0 z-40 md:hidden ${overlayBg} flex flex-col items-center justify-center gap-8`}
        >
          {navLinks.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              onClick={() => setOpen(false)}
              className={`text-[13px] font-normal tracking-[0em] transition-colors ${mutedCls}`}
              activeProps={{ className: `text-[13px] font-normal tracking-[0em] ${colorCls}` }}
              style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif' }}
            >
              {l.label}
            </Link>
          ))}
          <button
            onClick={() => setOpen(false)}
            aria-label="Close navigation"
            className={`absolute right-6 top-4 ${colorCls}`}
          >
            <X size={20} />
          </button>
        </div>
      )}
    </header>
  );
}
