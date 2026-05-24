import type { ReactNode } from "react";

import { Header } from "./Header";
import { Footer } from "./Footer";

export function SiteShell({
  children,
  footerDescription,
  theme = "light",
  bare = false,
}: {
  children: ReactNode;

  footerDescription?: string;

  theme?: "light" | "dark";

  bare?: boolean;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">

      {!bare && (
        <Header theme={theme} />
      )}

      <main
        className="
          route-container
          w-full
          flex-1
        "
      >
        {children}
      </main>

      {!bare && (
        <Footer
          description={footerDescription}
          theme={theme}
        />
      )}
    </div>
  );
}
