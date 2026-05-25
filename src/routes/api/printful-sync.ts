import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/printful-sync")({
  server: {
    handlers: {
      POST: async () => {
        // We import the server-side supabase client to handle database writes
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        
        
        if (!apiKey) return new Response("Missing API Key", { status: 500 });
        const apiKey = process.env.Printful_API_Key;
        // 1. Fetch from Printful
        const response = await fetch("https://api.printful.com/sync/products", {
          headers: { "Authorization": `Bearer ${apiKey}` }
        });

        if (!response.ok) return new Response("Printful API Error", { status: 500 });
        const { result } = await response.json();

        // 2. Defensive check
        if (!result || result.length === 0) {
          return new Response(JSON.stringify({ message: "No products found" }), { status: 200 });
        }

        // 3. Sync to Supabase
        for (const p of result) {
          await supabaseAdmin.from("products").upsert({
            title: p.name,
            printful_id: p.id,
            is_archived: false,
          });
        }

        return new Response(JSON.stringify({ synced: result.length }), { status: 200 });
      }
    }
  }
});
