import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

export const Route = createFileRoute("/api/productSearch-webhook-url")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const url = new URL(request.url);
          const search = url.searchParams.get("search") || "";

          const SUPABASE_URL = process.env.SUPABASE_URL;
          const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;
          if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
            return new Response(JSON.stringify({ error: "Server misconfigured" }), {
              status: 500,
              headers: { "Content-Type": "application/json" },
            });
          }

          const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

          // Search inside your products database by title similarity or exact matching apliq ID
          const { data, error } = await supabaseAdmin
            .from("products")
            .select("*")
            .or(`title.ilike.%${search}%,apliq_id.eq.${search}`);

          if (error) {
            console.error("APLIQ DATABASE SEARCH ERROR:", error);
            return new Response(JSON.stringify({ error: error.message }), {
              status: 500,
              headers: { "Content-Type": "application/json" },
            });
          }

          // Return database products formatted into the specific JSON format Apliq's platform queries
          const formatted = (data || []).map(p => ({
            id: p.apliq_id || p.id,
            title: p.title,
            name: p.title,
            price: p.price_cents / 100,
            sku: p.variants?.[0]?.sku || "",
            image_url: p.image_urls?.[0] || "",
            variants: (p.variants || []).map((v: any) => ({
              id: v.external_sku || v.sku,
              sku: v.sku,
              price: v.price_cents / 100,
              title: Object.values(v.attributes || {}).join(" / "),
            }))
          }));

          return new Response(JSON.stringify(formatted), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        } catch (err: any) {
          console.error("APLIQ SEARCH PROCESS EXCEPTION:", err);
          return new Response(JSON.stringify({ error: err.message || "Unknown error" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      }
    }
  }
});
