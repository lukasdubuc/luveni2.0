import { Link } from "@tanstack/react-router";
import { site } from "@/config/site";

export function Footer({ description }: { description?: string }) {
  return (
    <footer className="border-t border-black/10 bg-white px-6 py-12 text-black">
      <div className="mx-auto flex max-w-7xl flex-col items-center gap-8">
        <div className="flex flex-wrap justify-center gap-x-8 gap-y-4">
          <Link to="/shop" className="text-[10px] tracking-[0.2em] text-black/50 transition-colors hover:text-black">SHOP</Link>
          <Link to="/about" className="text-[10px] tracking-[0.2em] text-black/50 transition-colors hover:text-black">ABOUT</Link>
          <Link to="/contact" className="text-[10px] tracking-[0.2em] text-black/50 transition-colors hover:text-black">CONTACT</Link>
          <Link to="/privacy" className="text-[10px] tracking-[0.2em] text-black/50 transition-colors hover:text-black">PRIVACY</Link>
          <Link to="/terms" className="text-[10px] tracking-[0.2em] text-black/50 transition-colors hover:text-black">TERMS</Link>
        </div>
        
        <div className="flex flex-col items-center gap-2">
          <span className="text-[10px] font-bold tracking-[0.3em] text-black">{site.brand}</span>
          <span className="text-[8px] tracking-[0.2em] text-black/30">©{new Date().getFullYear()}</span>
        </div>
      </div>
    </footer>
  );
}
