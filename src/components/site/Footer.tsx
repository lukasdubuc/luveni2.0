import { Link } from "@tanstack/react-router";
import { site } from "@/config/site";

export function Footer({ description }: { description?: string }) {
  return (
    <footer className="border-t border-white bg-black p-4">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex flex-col gap-1">
          <span className="text-tiny tight-mono text-white font-bold">{site.brand}</span>
          {description && (
            <p className="text-tiny tight-mono text-white/50 max-w-xs uppercase">
              {description}
            </p>
          )}
        </div>
        
        <div className="flex gap-4">
          <Link to="/privacy" className="text-tiny tight-mono text-white/50 hover:text-white">PRIVACY</Link>
          <Link to="/terms" className="text-tiny tight-mono text-white/50 hover:text-white">TERMS</Link>
          <span className="text-tiny tight-mono text-white/30">©{new Date().getFullYear()}</span>
        </div>
      </div>
    </footer>
  );
}
