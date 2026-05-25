import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/printful-sync")({
  server: {
    handlers: {
      POST: async () => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // Fetch from Printful
        const response = await fetch("https://api.printful.com/sync/products", {
          headers: { "Authorization": `Bearer ${process.env.PRINTFUL_API_KEY}` }
        });

        if (!response.ok) return new Response("Printful API Error", { status: 500 });
        const { result } = await response.json();

        if (!result || result.length === 0) {
          return new Response(JSON.stringify({ message: "No products found" }), { status: 200 });
        }

        // Upsert logic
        for (const p of result) {
          await supabaseAdmin.from("products").upsert({
            name: p.name,
            printful_id: p.id,
            is_archived: false,
          });
        }

        return new Response(JSON.stringify({ synced: result.length }), { status: 200 });
      }
    }
  }
});
