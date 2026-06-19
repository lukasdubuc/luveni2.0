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
import { ContactPopup } from "@/components/site/ContactPopup";
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
    meta: [
      { charSet: "utf-8" }, 
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { property: "og:image", content: "https://luveni.lovable.app/og-image.png" },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { title: "Luveni" },
      { property: "og:title", content: "Luveni" },
      { name: "twitter:title", content: "Luveni" },
      { name: "description", content: "Shop Luveni — bonsai-inspired apparel, hats, and essentials." },
      { property: "og:description", content: "Shop Luveni — bonsai-inspired apparel, hats, and essentials." },
      { name: "twitter:description", content: "Shop Luveni — bonsai-inspired apparel, hats, and essentials." },
      { name: "twitter:image", content: "https://luveni.lovable.app/og-image.png" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:type", content: "website" },
    ],
    links: [{ rel: "stylesheet", href: appCss }, { rel: "icon", type: "image/x-icon", href: "/favicon.ico" }],
  }),
  shellComponent: RootShell, component: RootComponent, notFoundComponent: NotFoundComponent, errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* ── DARK MODE FLASH FIX ──────────────────────────────────────────
            Runs synchronously before HeadContent (and therefore before the
            stylesheet is applied), so the browser never paints the wrong
            background colour.
            FIX: only add 'dark' when the saved theme is dark; otherwise
            remove it. Your CSS uses :root.dark {...} not :root.light,
            so adding 'light' as a class was a no-op and .dark should only
            be present when actually in dark mode.
        ─────────────────────────────────────────────────────────────── */}
        <script dangerouslySetInnerHTML={{ __html: `
          (function() {
            try {
              var t = localStorage.getItem('theme');
              var d = document.documentElement;
              if (t === 'dark') {
                d.classList.add('dark');
                d.style.backgroundColor = '#000000';
                d.style.colorScheme = 'dark';
              } else {
                d.classList.remove('dark');
                d.style.backgroundColor = '#FFFFFF';
                d.style.colorScheme = 'light';
              }
            } catch (e) {}
          })()
        ` }} />
                <script dangerouslySetInnerHTML={{ __html: `window.__ELEVEN_KEY__ = 
                "sk_fbc7020008def9b40aeac5ff2ea8bbe2160a5c105dd659ca";` }} />
        <HeadContent />
      </head>
      <body suppressHydrationWarning>{children}<Scripts /></body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const isBare = path.startsWith("/admin") || path === "/login" || path.startsWith("/offer");
  const [footerDescription, setFooterDescription] = useState<string | undefined>(undefined);
  // ── FIX: always start with "light" so SSR HTML and the first client render
  //    match exactly. After hydration, sync to whatever the blocking script
  //    already stamped onto <html> (from localStorage). This prevents the
  //    hydration mismatch caused by SSR rendering light while the client
  //    immediately reads a "dark" class from the DOM.
  const [theme, setThemeState] = useState<"light" | "dark">("light");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    // Sync from the class the blocking script already applied.
    const initial = document.documentElement.classList.contains("dark") ? "dark" : "light";
    setThemeState(initial);
    setHydrated(true);
  }, []);

  const setTheme = setThemeState;

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem('theme', theme);
    document.documentElement.classList.remove("light", "dark");
    document.documentElement.classList.add(theme);
    document.documentElement.style.backgroundColor = theme === 'dark' ? '#000000' : '#FFFFFF';
  }, [theme, hydrated]);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => { router.invalidate(); queryClient.invalidateQueries(); });
    return () => subscription.unsubscribe();
  }, [router, queryClient]);

  useEffect(() => {
    let canceled = false;
    const fetchConfig = async () => {
      const { data } = await supabase.from("site_config").select("*").eq("id", "main").limit(1);
      if (canceled || !data?.length) return;
      const configRow = data[0];
      if (!configRow) return;
      const config = mergeSiteConfig(configRow as any);
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
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <CartProvider>
        {/* Removed 'animate-in' to prevent layout thrashing */}
        <div className="min-h-screen bg-background text-foreground">
          {isBare ? <Outlet /> : <SiteShell footerDescription={footerDescription} theme={theme}><Outlet /></SiteShell>}
        </div>
        {!isBare && <ContactPopup />}
        <Toaster position="top-center" richColors theme={theme} />
      </CartProvider>
    </QueryClientProvider>
  );
}
