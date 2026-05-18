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
import { useEffect } from "react";

import appCss from "../styles.css?url";
import { SiteShell } from "@/components/site/SiteShell";
import { supabase } from "@/integrations/supabase/client";

function NotFoundComponent() {
  return (
    <SiteShell>
      <div className="mx-auto max-w-md px-4 py-24 text-center">
        <h1 className="text-7xl font-semibold tracking-tight">404</h1>
        <h2 className="mt-4 text-xl font-semibold">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <Link
          to="/"
          className="mt-6 inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
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
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. Try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => { router.invalidate(); reset(); }}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            Try again
          </button>
          <a href="/" className="rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent">
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
      { title: "Northwind — a simple, modern way to get the result you want" },
      { name: "description", content: "Northwind is a focused, no-fluff package that gets you to the result faster. 30-day money-back guarantee." },
      { name: "author", content: "Northwind" },
      { property: "og:title", content: "Northwind — a simple, modern way to get the result you want" },
      { property: "og:description", content: "Northwind is a focused, no-fluff package that gets you to the result faster. 30-day money-back guarantee." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Northwind — a simple, modern way to get the result you want" },
      { name: "twitter:description", content: "Northwind is a focused, no-fluff package that gets you to the result faster. 30-day money-back guarantee." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/7632c254-0b6b-48b5-90c8-e3980ffbe411/id-preview-b72e0dd5--4a024234-3250-4065-952b-d4f55051792b.lovable.app-1779106719939.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/7632c254-0b6b-48b5-90c8-e3980ffbe411/id-preview-b72e0dd5--4a024234-3250-4065-952b-d4f55051792b.lovable.app-1779106719939.png" },
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
  const isBare = path.startsWith("/admin") || path === "/login";

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      router.invalidate();
      queryClient.invalidateQueries();
    });
    return () => subscription.unsubscribe();
  }, [router, queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      {isBare ? <Outlet /> : <SiteShell><Outlet /></SiteShell>}
      <Toaster position="top-center" richColors />
    </QueryClientProvider>
  );
}
