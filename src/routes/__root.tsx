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

import { useEffect, useState, memo } from "react";

import { CartProvider } from "@/context/CartContext";

import appCss from "../styles.css?url";

import { SiteShell } from "@/components/site/SiteShell";

import { supabase } from "@/integrations/supabase/client";

import { mergeSiteConfig } from "@/lib/site-config";

function NotFoundComponent() {
  return (
    <SiteShell bare={false}>
      <div className="mx-auto max-w-md px-4 py-24 text-center">
        <h1 className="text-7xl font-semibold tracking-tight">404</h1>

        <h2 className="mt-4 text-xl font-semibold">
          Page not found
        </h2>

        <Link
          to="/"
          className="mt-6 inline-flex items-center justify-center bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          Go home
        </Link>
      </div>
    </SiteShell>
  );
}

function ErrorComponent({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  console.error(error);

  const router = useRouter();

  return (
    <SiteShell bare={false}>
      <div className="mx-auto max-w-md px-4 py-24 text-center">
        <h1 className="text-xl font-semibold tracking-tight">
          This page didn't load
        </h1>

        <button
          onClick={() => {
            router.invalidate({ sync: false });
            reset();
          }}
          className="mt-6 bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          Try again
        </button>
      </div>
    </SiteShell>
  );
}

export const Route =
  createRootRouteWithContext<{
    queryClient: QueryClient;
  }>()({
    head: () => ({
      meta: [
        {
          charSet: "utf-8",
        },
        {
          name: "viewport",
          content: "width=device-width, initial-scale=1",
        },
      ],

      links: [
        {
          rel: "preconnect",
          href: "https://fonts.googleapis.com",
        },

        {
          rel: "preconnect",
          href: "https://fonts.gstatic.com",
          crossOrigin: "anonymous",
        },

        {
          rel: "stylesheet",
          href:
            "https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&display=swap",
        },

        {
          rel: "stylesheet",
          href: appCss,
        },

        {
          rel: "icon",
          type: "image/x-icon",
          href: "/favicon.ico",
        },
      ],
    }),

    shellComponent: RootShell,

    component: RootComponent,

    notFoundComponent: NotFoundComponent,

    errorComponent: ErrorComponent,
  });

function RootShell({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>

        {/* PRE-PAINT THEME LOCK */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
(function () {
  try {
    var theme = localStorage.getItem("theme") || "light";

    var d = document.documentElement;

    if (theme === "dark") {
      d.classList.add("dark");
      d.style.backgroundColor = "#000000";
      d.style.colorScheme = "dark";
    } else {
      d.classList.remove("dark");
      d.style.backgroundColor = "#FFFFFF";
      d.style.colorScheme = "light";
    }
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

const PersistentOutlet = memo(function PersistentOutlet() {
  return (
    <div className="route-container">
      <Outlet />
    </div>
  );
});

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

  const [footerDescription, setFooterDescription] =
    useState<string>();

  /*
    THEME IS DOM-DRIVEN NOW
    NO ROOT RE-RENDERING
  */

  useEffect(() => {
    const storedTheme =
      localStorage.getItem("theme") || "light";

    const d = document.documentElement;

    if (storedTheme === "dark") {
      d.classList.add("dark");
    } else {
      d.classList.remove("dark");
    }
  }, []);

  /*
    AUTH INVALIDATION
    TARGETED ONLY
  */

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      queryClient.invalidateQueries({
        queryKey: ["auth"],
      });

      router.invalidate({
        sync: false,
      });
    });

    return () => subscription.unsubscribe();
  }, [router, queryClient]);

  /*
    SITE CONFIG
  */

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

      setFooterDescription(
        config.metadata?.footer_description ?? ""
      );

      const theme = config.theme || "light";

      localStorage.setItem("theme", theme);

      const d = document.documentElement;

      if (theme === "dark") {
        d.classList.add("dark");
        d.style.backgroundColor = "#000000";
        d.style.colorScheme = "dark";
      } else {
        d.classList.remove("dark");
        d.style.backgroundColor = "#FFFFFF";
        d.style.colorScheme = "light";
      }
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
        (payload) => {
          const config = mergeSiteConfig(payload.new as any);

          setFooterDescription(
            config.metadata?.footer_description ?? ""
          );

          const theme = config.theme || "light";

          localStorage.setItem("theme", theme);

          const d = document.documentElement;

          if (theme === "dark") {
            d.classList.add("dark");
            d.style.backgroundColor = "#000000";
            d.style.colorScheme = "dark";
          } else {
            d.classList.remove("dark");
            d.style.backgroundColor = "#FFFFFF";
            d.style.colorScheme = "light";
          }
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

        <SiteShell
          bare={isBare}
          footerDescription={footerDescription}
        >
          <div className="shell-root">
            <PersistentOutlet />
          </div>
        </SiteShell>

        <Toaster
          position="top-center"
          richColors
          theme={
            document.documentElement.classList.contains("dark")
              ? "dark"
              : "light"
          }
        />
      </CartProvider>
    </QueryClientProvider>
  );
}
