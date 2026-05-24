import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet, createRootRouteWithContext, useRouter, useRouterState,
  HeadContent, Scripts, Link,
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
        <Link to="/" className="mt-6 inline-flex items-center justify-center rounded-none bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">Go home</Link>
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
        <button onClick={() => { router.invalidate(); reset(); }} className="mt-6 rounded-none bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">Try again</button>
      </div>
    </SiteShell>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [{ charSet: "utf-8" }, { name: "viewport", content: "width=device-width, initial-scale=1" }],
    links: [{ rel: "stylesheet", href: appCss }, { rel: "icon", type: "image/x-icon", href: "/favicon.ico" }],
  }),
  shellComponent: RootShell, component: RootComponent, notFoundComponent: NotFoundComponent, errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
        <script dangerouslySetInnerHTML={{ __html: `
          (function() {
            try {
              var theme = localStorage.getItem('theme') || 'light';
              document.documentElement.classList.add(theme);
              document.documentElement.style.backgroundColor = theme === 'dark' ? '#000000' : '#FFFFFF';
            } catch (e) {}
          })()
        ` }} />
      </head>
      <body>{children}<Scripts /></body>
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
    document.documentElement.style.backgroundColor = theme === 'dark' ? '#000000' : '#FFFFFF';
  }, [theme]);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => { router.invalidate(); queryClient.invalidateQueries(); });
    return () => subscription.unsubscribe();
  }, [router, queryClient]);

  useEffect(() => {
    let canceled = false;
    const fetchConfig = async () => {
      const { data } = await supabase.from("site_config").select("*").eq("id", "main").maybeSingle();
      if (canceled || !data) return;
      const config = mergeSiteConfig(data as any);
      setFooterDescription(config.metadata?.footer_description ?? "");
      setTheme(config.theme || "light");
    };
    fetchConfig();
    const sub = supabase.channel("site_config_changes").on("postgres_changes", { event: "UPDATE", schema: "public", table: "site_config", filter: "id=eq.main" }, (p) => {
      const config = mergeSiteConfig(p.new as any);
      setFooterDescription(config.metadata?.footer_description ?? "");
      setTheme(config.theme || "light");
    }).subscribe();
    return () => { canceled = true; sub.unsubscribe(); };
  }, [isBare]);

  return (
    <QueryClientProvider client={queryClient}>
      <CartProvider>
        {/* Removed 'animate-in' to prevent layout thrashing */}
        <div className="min-h-screen bg-background text-foreground">
          {isBare ? <Outlet /> : <SiteShell footerDescription={footerDescription} theme={theme}><Outlet /></SiteShell>}
        </div>
        <Toaster position="top-center" richColors theme={theme} />
      </CartProvider>
    </QueryClientProvider>
  );
}
