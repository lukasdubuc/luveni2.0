import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/stripe-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const Stripe = (await import("stripe")).default;

        const stripeKey = process.env.STRIPE_SECRET_KEY;
        const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

        // 1. Initial Configuration Check
        if (!stripeKey || !webhookSecret) {
          console.error("Webhook configuration missing");
          return new Response("Webhook not configured", { status: 500 });
        }

        // 2. Validate Signature
        const sig = request.headers.get("stripe-signature");
        if (!sig) return new Response("Missing signature", { status: 400 });

        const body = await request.text();
        const stripe = new Stripe(stripeKey);

        let event: import("stripe").Stripe.Event;
        try {
          event = await stripe.webhooks.constructEventAsync(body, sig, webhookSecret);
        } catch (e) {
          console.error("Webhook signature verification failed", e);
          return new Response("Invalid signature", { status: 400 });
        }

        // 3. Process Event with Defensive Checks
        try {
          const session = event.data.object as import("stripe").Stripe.Checkout.Session;
          const orderId = session.metadata?.order_id;
          
          if (!orderId) {
            console.log(`Skipping event ${event.type}: No order_id found in metadata.`);
            return new Response(JSON.stringify({ received: true, ignored: true }), { status: 200 });
          }

          if (event.type === "checkout.session.completed") {
            // Fetch order to see if it requires Printful fulfillment
            const { data: order } = await supabaseAdmin
              .from("orders")
              .select("printful_id")
              .eq("id", orderId)
              .single();

            // Update internal status
            await supabaseAdmin
              .from("orders")
              .update({ status: "paid", provider_ref: session.id })
              .eq("id", orderId);

            // Conditional Printful Trigger
            if (order?.printful_id) {
              console.log(`Triggering Printful fulfillment for order ${orderId}`);
              // API call logic would go here
            }
              
          } else if (
            event.type === "checkout.session.expired" ||
            event.type === "checkout.session.async_payment_failed"
          ) {
            await supabaseAdmin
              .from("orders")
              .update({ status: "failed" })
              .eq("id", orderId);
          }
        } catch (e) {
          console.error("Webhook handler error", e);
          return new Response("Handler error", { status: 500 });
        }

        return new Response(JSON.stringify({ received: true }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      },
    },
  },
});
