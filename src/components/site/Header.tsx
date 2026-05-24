import { Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Menu, X } from "lucide-react";
import { site } from "@/config/site";
import { useCart } from "@/context/CartContext";

const navLinks = [
  { to: "/shop", label: "SHOP" },
  { to: "/about", label: "ABOUT" },
  { to: "/contact", label: "CONTACT" },
] as const;

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

export function Header() {
  const [open, setOpen] = useState(false);
  const { count } = useCart();

  // 🔥 FORCE REACTIVE THEME (fixes sticky header issue)
  const [_, forceUpdate] = useState(0);

  useEffect(() => {
    const update = () => forceUpdate((x) => x + 1);

    window.addEventListener("theme-sync", update);
    return () => window.removeEventListener("theme-sync", update);
  }, []);

  const isDark =
    document.documentElement.classList.contains("dark");

  const colorCls = isDark ? "text-white" : "text-black";
  const mutedCls = isDark ? "text-white/40" : "text-black/40";
  const bgCls = isDark ? "bg-black" : "bg-white";
  const borderCls = isDark ? "border-white/10" : "border-black/8";
  const overlayBg = isDark ? "bg-black" : "bg-white";

  return (
    <header
      className={`sticky top-0 z-50 transition-colors duration-500 ${bgCls} border-b md:border-b-0 ${borderCls}`}
    >
      <div className="flex h-14 w-full items-center justify-between px-6">
        <div className="flex flex-1 items-center">
          <button
            onClick={() => setOpen((v) => !v)}
            className={`md:hidden flex items-center ${colorCls}`}
          >
            {open ? <X size={18} /> : <Menu size={18} />}
          </button>

          <Link
            to="/shop"
            className={`hidden md:block text-[13px] ${colorCls}`}
            style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif' }}
          >
            {site.brand}
          </Link>
        </div>

        <Link
          to="/shop"
          className={`md:hidden absolute left-1/2 -translate-x-1/2 text-[13px] ${colorCls}`}
        >
          {site.brand}
        </Link>

        <nav className="hidden md:flex items-center gap-8">
          {navLinks.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className={`text-[13px] transition-colors ${mutedCls}`}
              activeProps={{
                className: `text-[13px] ${colorCls}`,
              }}
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="flex flex-1 justify-end">
          <Link to="/checkout" className={`flex items-center ${colorCls}`}>
            {count > 0 && (
              <span className={`mr-1 text-[13px] ${colorCls}`}>
                {count > 9 ? "9+" : count}
              </span>
            )}
            <BagIcon size={20} />
          </Link>
        </div>
      </div>

      {open && (
        <div className={`fixed inset-0 z-40 md:hidden ${overlayBg} flex flex-col items-center justify-center gap-8`}>
          {navLinks.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              onClick={() => setOpen(false)}
              className={`text-[13px] ${mutedCls}`}
            >
              {l.label}
            </Link>
          ))}

          <button
            onClick={() => setOpen(false)}
            className={`absolute right-6 top-4 ${colorCls}`}
          >
            <X size={20} />
          </button>
        </div>
      )}
    </header>
  );
}
