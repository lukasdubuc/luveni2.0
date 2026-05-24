import { Link } from "@tanstack/react-router";
import { site } from "@/config/site";
import { useEffect, useState } from "react";

export function Footer({ description }: { description?: string }) {
  const [_, forceUpdate] = useState(0);

  useEffect(() => {
    const update = () => forceUpdate((x) => x + 1);

    window.addEventListener("theme-sync", update);
    return () => window.removeEventListener("theme-sync", update);
  }, []);

  const isDark =
    document.documentElement.classList.contains("dark");

  return (
    <footer
      className={`border-t px-6 py-12 transition-colors duration-500 ${
        isDark
          ? "bg-black border-white/10 text-white"
          : "bg-white border-black/10 text-black"
      }`}
    >
      <div className="mx-auto flex max-w-7xl flex-col items-center gap-8">
        <div className="flex flex-wrap justify-center gap-x-8 gap-y-4">
          <Link className={`text-[10px] ${isDark ? "text-white/50" : "text-black/50"}`} to="/shop">
            SHOP
          </Link>
          <Link className={`text-[10px] ${isDark ? "text-white/50" : "text-black/50"}`} to="/about">
            ABOUT
          </Link>
          <Link className={`text-[10px] ${isDark ? "text-white/50" : "text-black/50"}`} to="/contact">
            CONTACT
          </Link>
          <Link className={`text-[10px] ${isDark ? "text-white/50" : "text-black/50"}`} to="/privacy">
            PRIVACY
          </Link>
          <Link className={`text-[10px] ${isDark ? "text-white/50" : "text-black/50"}`} to="/terms">
            TERMS
          </Link>
        </div>

        <div className="flex flex-col items-center gap-2">
          <span className={`text-[10px] ${isDark ? "text-white" : "text-black"}`}>
            {site.brand}
          </span>
          <span className={`text-[8px] ${isDark ? "text-white/30" : "text-black/30"}`}>
            ©{new Date().getFullYear()}
          </span>
        </div>
      </div>
    </footer>
  );
}
