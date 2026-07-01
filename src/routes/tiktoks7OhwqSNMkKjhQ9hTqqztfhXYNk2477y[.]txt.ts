import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";

// TikTok Shop URL-prefix ownership verification. Served as a real server
// route (not a static file) so the SSR layer can't hand TikTok's crawler
// the HTML app shell or the wrong content-type — it always gets the exact
// signature as text/plain.
const TIKTOK_VERIFICATION = "tiktok-developers-site-verification=s7OhwqSNMkKjhQ9hTqqztfhXYNk2477y";

export const Route = createFileRoute("/tiktoks7OhwqSNMkKjhQ9hTqqztfhXYNk2477y.txt")({
  server: {
    handlers: {
      GET: async () =>
        new Response(TIKTOK_VERIFICATION, {
          headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
        }),
    },
  },
});
