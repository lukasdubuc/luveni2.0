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
    <div
      className="
        shell-root
        flex
        min-h-screen
        flex-col
        bg-background
        text-foreground
      "
    >

      {/* PERSISTENT HEADER SLOT */}
      {!bare && (
        <Header theme={theme} />
      )}

      {/* PERSISTENT ROUTE CONTAINER */}
      <main
        className="
          route-container
          w-full
          flex-1
        "
      >
        {children}
      </main>

      {/* PERSISTENT FOOTER SLOT */}
      {!bare && (
        <Footer
          description={footerDescription}
          theme={theme}
        />
      )}
    </div>
  );
}
