import type { ReactNode } from "react";
import { Header } from "./Header";
import { Footer } from "./Footer";

export function SiteShell({ children, footerDescription }: { children: ReactNode; footerDescription?: string }) {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <Header />
      <main className="flex-1">{children}</main>
      <Footer description={footerDescription} />
    </div>
  );
}
