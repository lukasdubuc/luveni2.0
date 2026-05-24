import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
  Link,
} from "@tanstack/react-router";
import { Toaster } from "sonner";
import { useEffect, useState } from "react";
import { CartProvider } from "@/context/CartContext";
import appCss from "../styles.css?url";
import { SiteShell } from "@/components/site/SiteShell";
import { supabase } from "@/integrations/supabase/client";
import { mergeSiteConfig } from "@/lib/site-config";

/* ---------------- NOT FOUND ---------------- */

function NotFoundComponent() {
  return (
    <SiteShell>
      <div className="mx-auto max-w-md px-4 py-24 text-center">
        <h1 className="text-7xl font-semibold tracking-tight">404</h1>
        <h2 className="mt-4 text-xl font-semibold">Page not found</h2>
        <Link
          to="/"
          className="mt-6 inline-flex items-center justify-center rounded-none bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          Go home
        </Link>
      </div>
    </SiteShell>
  );
}

/* ---------------- ERROR ---------------- */

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();

  return (
    <SiteShell>
      <div className="mx-auto max-w-md px-4 py-24 text-center">
        <h1 className="text-xl font-semibold tracking-tight">
          This page didn't load
        </h1>

        <button
          onClick={() => {
            router.invalidate();
            reset();
          }}
          className="mt-6 rounded-none bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          Try again
        </button>
      </div>
    </SiteShell>
  );
}

/* ---------------- ROUTE ---------------- */

export const Route = createRootRouteWithContext<{
  queryClient: QueryClient;
}>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", type: "image/x-icon", href: "/favicon.ico" },
    ],
  }),

  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

/* ---------------- SHELL ---------------- */

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* SAFE PRE-PAINT THEME */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
(function () {
  try {
    var t = localStorage.getItem('theme') || 'light';
    var d = document.documentElement;

    d.classList.remove("light", "dark");
    d.classList.add(t);

    d.style.backgroundColor = t === 'dark' ? '#000000' : '#FFFFFF';
    d.style.colorScheme = t;
  } catch (e) {}
})();
`,
          }}
        />

        <HeadContent />
      </head>

      <body suppressHydrationWarning>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

/* ---------------- ROOT ---------------- */

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();

  const path = useRouterState({
    select: (s) => s.location.pathname,
  });

  const isBare =
    path.startsWith("/admin") ||
    path === "/login" ||
    path.startsWith("/offer/");

  const [footerDescription, setFooterDescription] = useState<
    string | undefined
  >(undefined);

  // ✅ SINGLE SOURCE OF TRUTH: DOM → React sync
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    if (typeof document === "undefined") return "light";
    return document.documentElement.classList.contains("dark")
      ? "dark"
      : "light";
  });

  useEffect(() => {
    const syncTheme = () => {
      const t = document.documentElement.classList.contains("dark")
        ? "dark"
        : "light";

      setTheme(t);
    };

    syncTheme();

    const observer = new MutationObserver(syncTheme);

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => observer.disconnect();
  }, []);

  /* AUTH */
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      queryClient.invalidateQueries({ queryKey: ["auth"] });
      router.invalidate();
    });

    return () => subscription.unsubscribe();
  }, [router, queryClient]);

  /* SITE CONFIG */
  useEffect(() => {
    let canceled = false;

    const fetchConfig = async () => {
      const { data } = await supabase
        .from("site_config")
        .select("*")
        .eq("id", "main")
        .maybeSingle();

      if (canceled || !data) return;

      const config = mergeSiteConfig(data as any);

      setFooterDescription(config.metadata?.footer_description ?? "");

      const t = config.theme || "light";

      localStorage.setItem("theme", t);

      document.documentElement.classList.remove("light", "dark");
      document.documentElement.classList.add(t);
    };

    fetchConfig();

    const sub = supabase
      .channel("site_config_changes")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "site_config",
          filter: "id=eq.main",
        },
        (p) => {
          const config = mergeSiteConfig(p.new as any);

          setFooterDescription(config.metadata?.footer_description ?? "");

          const t = config.theme || "light";

          localStorage.setItem("theme", t);

          document.documentElement.classList.remove("light", "dark");
          document.documentElement.classList.add(t);
        }
      )
      .subscribe();

    return () => {
      canceled = true;
      sub.unsubscribe();
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <CartProvider>
        <div className="min-h-screen bg-background text-foreground">
          {isBare ? (
            <Outlet />
          ) : (
            <SiteShell footerDescription={footerDescription} theme={theme}>
              <Outlet />
            </SiteShell>
          )}
        </div>

        <Toaster
          position="top-center"
          richColors
          theme={theme}
        />
      </CartProvider>
    </QueryClientProvider>
  );
}
