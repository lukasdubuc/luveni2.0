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

function NotFoundComponent() {
  return (
    <SiteShell>
      <div className="mx-auto max-w-md px-4 py-24 text-center">
        <h1 className="text-7xl font-semibold tracking-tight">404</h1>
        <h2 className="mt-4 text-xl font-semibold">Page not found</h2>
        <p className="mt-2 text-sm text-black/55">
          The page you're looking for doesn't exist or has been moved.
        </p>
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

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  return (
    <SiteShell>
      <div className="mx-auto max-w-md px-4 py-24 text-center">
        <h1 className="text-xl font-semibold tracking-tight">This page didn't load</h1>
        <p className="mt-2 text-sm text-black/55">
          Something went wrong on our end. Try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => { router.invalidate(); reset(); }}
            className="rounded-none bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            Try again
          </button>
          <a href="/" className="rounded-none border border-black/10 bg-background px-4 py-2 text-sm font-medium hover:bg-accent">
            Go home
          </a>
        </div>
      </div>
    </SiteShell>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "A simple, modern way to get the result you want" },
      { name: "description", content: "A focused, no-fluff package that gets you to the result faster. 30-day money-back guarantee." },
      { property: "og:title", content: "A simple, modern way to get the result you want" },
      { property: "og:type", content: "website" },
      { property: "og:image", content: "https://services2day.lovable.app/og-image.png" },
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

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
        <script dangerouslySetInnerHTML={{
          __html: `
            (function() {
              try {
                var theme = localStorage.getItem('theme') || 'light';
                document.documentElement.classList.add(theme);
              } catch (e) {}
            })()
          `
        }} />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const isBare = path.startsWith("/admin") || path === "/login" || path.startsWith("/offer/");
  const [footerDescription, setFooterDescription] = useState<string | undefined>(undefined);
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    localStorage.setItem('theme', theme);
    document.documentElement.classList.remove("light", "dark");
    document.documentElement.classList.add(theme);
  }, [theme]);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      router.invalidate();
      queryClient.invalidateQueries();
    });
    return () => subscription.unsubscribe();
  }, [router, queryClient]);

  useEffect(() => {
    let canceled = false;
    const fetchConfig = async () => {
      const { data, error } = await supabase
        .from("site_config")
        .select("*")
        .eq("id", "main")
        .maybeSingle();

      if (canceled) return;
      if (!error && data) {
        const config = mergeSiteConfig(data as any);
        setFooterDescription(config.metadata?.footer_description ?? "");
        setTheme(config.theme || "light");
      }
    };
    fetchConfig();
    const subscription = supabase
      .channel("site_config_changes")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "site_config", filter: "id=eq.main" }, (payload) => {
        if (canceled) return;
        const config = mergeSiteConfig(payload.new as any);
        setFooterDescription(config.metadata?.footer_description ?? "");
        setTheme(config.theme || "light");
      })
      .subscribe();
    return () => {
      canceled = true;
      subscription.unsubscribe();
    };
  }, [isBare]);

  return (
    <QueryClientProvider client={queryClient}>
      <CartProvider>
        <div className="animate-in fade-in duration-300">
          {isBare ? (
            <Outlet />
          ) : (
            <SiteShell footerDescription={footerDescription} theme={theme}>
              <Outlet />
            </SiteShell>
          )}
        </div>
        <Toaster position="top-center" richColors theme={theme} />
      </CartProvider>
    </QueryClientProvider>
  );
}
