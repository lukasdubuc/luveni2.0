import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

export const Route = createFileRoute("/api/shipment-complete")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const SUPABASE_URL = process.env.SUPABASE_URL;
          const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;
          if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
            return new Response(JSON.stringify({ error: "Server misconfigured" }), {
              status: 500,
              headers: { "Content-Type": "application/json" },
            });
          }

          const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
          const body = await request.json();
          console.log("APLIQQ WAREHOUSE SHIPMENT COMPLETE WEBHOOK PAYLOAD:", JSON.stringify(body, null, 2));

          const orderId = String(body.order_id || body.orderId || body.id || body.store_order_id || "");
          
          if (orderId) {
            const { data: matchedOrder } = await supabaseAdmin
              .from("orders")
              .select("*")
              .or(`id.eq.${orderId},provider_ref.eq.${orderId}`)
              .maybeSingle();

            if (matchedOrder) {
              const currentMetadata = matchedOrder.metadata || {};
              const updatedMetadata = {
                ...currentMetadata,
                warehouse_shipment_complete: true,
                warehouse_shipment_completed_at: new Date().toISOString(),
                warehouse_payload: body,
              };

              await supabaseAdmin
                .from("orders")
                .update({
                  status: "fulfilled",
                  metadata: updatedMetadata,
                })
                .eq("id", matchedOrder.id);

              console.log(`Warehouse shipment complete finalized for order: ${matchedOrder.id}`);
            } else {
              console.warn(`No matching order records located for warehouse reference: ${orderId}`);
            }
          }

          return new Response(JSON.stringify({ success: true }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        } catch (err) {
          console.error("APLIQQ SHIPMENT COMPLETE WEBHOOK EXCEPTION:", err);
          return new Response(JSON.stringify({ error: err.message || "Unknown error" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      }
    }
  }
});