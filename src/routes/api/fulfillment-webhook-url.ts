import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

export const Route = createFileRoute("/api/fulfillment-webhook-url")({
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
          console.log("APLIQQ FULFILLMENT WEBHOOK PAYLOAD:", JSON.stringify(body, null, 2));

          const fulfillment = body?.fulfillment || {};
          const apliiqOrderId = String(fulfillment.order_id || "");
          const trackingCompany = String(fulfillment.tracking_company || "");
          const trackingNumbers = Array.isArray(fulfillment.tracking_numbers) ? fulfillment.tracking_numbers : [];
          const trackingNumber = trackingNumbers[0] || "";

          if (!apliiqOrderId) {
            return new Response(JSON.stringify({ error: "Missing order_id" }), {
              status: 400,
              headers: { "Content-Type": "application/json" },
            });
          }

          const { data: matchedOrder, error: searchError } = await supabaseAdmin
            .from("orders")
            .select("*")
            .or(`id.eq.${apliiqOrderId},provider_ref.eq.${apliiqOrderId}`)
            .maybeSingle();

          if (searchError) {
            console.error("Order search query error:", searchError);
          }

          if (matchedOrder) {
            const currentMetadata = matchedOrder.metadata || {};
            const updatedMetadata = {
              ...currentMetadata,
              tracking_company: trackingCompany,
              tracking_number: trackingNumber,
              tracking_numbers: trackingNumbers,
              apliiq_fulfillment_status: fulfillment.status || "success",
              fulfilled_at: new Date().toISOString(),
            };

            const { error: updateError } = await supabaseAdmin
              .from("orders")
              .update({
                status: "shipped",
                metadata: updatedMetadata,
              })
              .eq("id", matchedOrder.id);

            if (updateError) {
              console.error("Failed to update order with tracking info:", updateError);
              return new Response(JSON.stringify({ error: updateError.message }), {
                status: 500,
                headers: { "Content-Type": "application/json" },
              });
            }

            console.log(`Updated order ${matchedOrder.id} status to shipped with tracking number: ${trackingNumber}`);
          } else {
            console.warn(`No matching transaction records located for order reference: ${apliiqOrderId}`);
          }

          return new Response(JSON.stringify({ success: true, processed_order_id: apliiqOrderId }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        } catch (err) {
          console.error("APLIQQ FULFILLMENT WEBHOOK EXCEPTION:", err);
          return new Response(JSON.stringify({ error: err.message || "Unknown error" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      }
    }
  }
});