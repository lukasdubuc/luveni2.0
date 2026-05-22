import type { ReactNode } from "react";
import { Header } from "./Header";
import { Footer } from "./Footer";

export function SiteShell({ children, footerDescription }: { children: ReactNode; footerDescription?: string }) {
  return (
    <div className="flex min-h-screen flex-col bg-white text-black">
      <Header />
      <main className="mx-auto w-full max-w-7xl flex-1">{children}</main>
      <Footer description={footerDescription} />
    </div>
  );
}
