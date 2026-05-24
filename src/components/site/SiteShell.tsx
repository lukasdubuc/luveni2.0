import type { ReactNode } from "react";
import { Header } from "./Header";
import { Footer } from "./Footer";

export function SiteShell({ 
  children, 
  footerDescription, 
  theme = "light" 
}: { 
  children: ReactNode; 
  footerDescription?: string; 
  theme?: "light" | "dark" 
}) {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <Header theme={theme} />
      <main className="w-full flex-1">
        {children}
      </main>
      <Footer description={footerDescription} theme={theme} />
    </div>
  );
}
