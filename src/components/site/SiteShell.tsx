import type { ReactNode } from "react";
import { Header } from "./Header";
import { Footer } from "./Footer";

export function SiteShell({ children, footerDescription, theme = "light" }: { children: ReactNode; footerDescription?: string; theme?: "light" | "dark" }) {
  const isDark = theme === "dark";
  
  return (
    <div className={`flex min-h-screen flex-col transition-colors duration-500 ${isDark ? "bg-black text-white" : "bg-white text-black"}`}>
      <Header theme={theme} />
      <main className="mx-auto w-full max-w-7xl flex-1">{children}</main>
      <Footer description={footerDescription} theme={theme} />
    </div>
  );
}
