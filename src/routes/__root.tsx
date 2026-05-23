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

import appCss from "../styles.css?url";
import { SiteShell } from "@/components/site/SiteShell";
import { supabase } from "@/integrations/supabase/client";
import { mergeSiteConfig, type SiteConfig } from "@/lib/site-config";

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
      { name: "author", content: "" },
      { property: "og:title", content: "A simple, modern way to get the result you want" },
      { property: "og:description", content: "A focused, no-fluff package that gets you to the result faster. 30-day money-back guarantee." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "A simple, modern way to get the result you want" },
      { name: "twitter:description", content: "A focused, no-fluff package that gets you to the result faster. 30-day money-back guarantee." },
      { property: "og:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/attachments/og-images/6f3e525f-a7aa-493b-a378-6c699f7e5e57" },
      { name: "twitter:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/attachments/og-images/6f3e525f-a7aa-493b-a378-6c699f7e5e57" },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
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
    // Apply theme class to document root for CSS variables
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
    if (isBare) return;

    let canceled = false;
    
    // Initial fetch
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
    
    // Subscribe to real-time changes
    const subscription = supabase
      .channel("site_config_changes")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "site_config", filter: "id=eq.main" },
        (payload) => {
          if (canceled) return;
          const config = mergeSiteConfig(payload.new as any);
          setFooterDescription(config.metadata?.footer_description ?? "");
          setTheme(config.theme || "light");
        }
      )
      .subscribe();

    return () => {
      canceled = true;
      subscription.unsubscribe();
    };
  }, [isBare]);

  return (
    <QueryClientProvider client={queryClient}>
      {isBare ? <Outlet /> : <SiteShell footerDescription={footerDescription} theme={theme}><Outlet /></SiteShell>}
      <Toaster position="top-center" richColors theme={theme} />
    </QueryClientProvider>
  );
}
