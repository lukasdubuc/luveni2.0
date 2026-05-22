import type { ReactNode } from "react";
import { Header } from "./Header";
import { Footer } from "./Footer";

export function SiteShell({ children, footerDescription }: { children: ReactNode; footerDescription?: string }) {
  return (
    <div className="flex min-h-screen flex-col bg-black text-white">
      <Header />
      <main className="flex-1 pt-16">{children}</main>
      <Footer description={footerDescription} />
    </div>
  );
}
