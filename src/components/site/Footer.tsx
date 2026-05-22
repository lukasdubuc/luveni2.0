import { Link } from "@tanstack/react-router";
import { site } from "@/config/site";

export function Footer({ description }: { description?: string }) {
  return (
    <footer className="bg-black px-6 py-12">
      <div className="flex flex-col items-center gap-8">
        <div className="flex flex-wrap justify-center gap-x-8 gap-y-4">
          <Link to="/shop" className="text-[10px] tracking-[0.2em] text-white/40 hover:text-white transition-colors">SHOP</Link>
          <Link to="/about" className="text-[10px] tracking-[0.2em] text-white/40 hover:text-white transition-colors">ABOUT</Link>
          <Link to="/contact" className="text-[10px] tracking-[0.2em] text-white/40 hover:text-white transition-colors">CONTACT</Link>
          <Link to="/privacy" className="text-[10px] tracking-[0.2em] text-white/40 hover:text-white transition-colors">PRIVACY</Link>
          <Link to="/terms" className="text-[10px] tracking-[0.2em] text-white/40 hover:text-white transition-colors">TERMS</Link>
        </div>
        
        <div className="flex flex-col items-center gap-2">
          <span className="text-[10px] tracking-[0.3em] text-white font-bold">{site.brand}</span>
          <span className="text-[8px] tracking-[0.2em] text-white/20">©{new Date().getFullYear()}</span>
        </div>
      </div>
    </footer>
  );
}
