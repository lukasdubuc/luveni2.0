import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/stripe-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const Stripe = (await import("stripe")).default;

        const stripeKey = process.env.STRIPE_SECRET_KEY;
        const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
        if (!stripeKey || !webhookSecret) {
          return new Response("Webhook not configured", { status: 500 });
        }

        const sig = request.headers.get("stripe-signature");
        if (!sig) return new Response("Missing signature", { status: 400 });

        const body = await request.text();
        const stripe = new Stripe(stripeKey);

        let event: import("stripe").Stripe.Event;
        try {
          event = await stripe.webhooks.constructEventAsync(body, sig, webhookSecret);
        } catch (e) {
          console.error("webhook signature failed", e);
          return new Response("Invalid signature", { status: 400 });
        }

        try {
          if (event.type === "checkout.session.completed") {
            const session = event.data.object as import("stripe").Stripe.Checkout.Session;
            const orderId = session.metadata?.order_id;
            if (orderId) {
              await supabaseAdmin
                .from("orders")
                .update({ status: "paid", provider_ref: session.id })
                .eq("id", orderId);
            }
          } else if (
            event.type === "checkout.session.expired" ||
            event.type === "checkout.session.async_payment_failed"
          ) {
            const session = event.data.object as import("stripe").Stripe.Checkout.Session;
            const orderId = session.metadata?.order_id;
            if (orderId) {
              await supabaseAdmin
                .from("orders")
                .update({ status: "failed" })
                .eq("id", orderId);
            }
          }
        } catch (e) {
          console.error("webhook handler error", e);
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
