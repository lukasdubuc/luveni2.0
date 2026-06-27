import { createFileRoute } from "@tanstack/react-router";

const sendDiscordAlert = async (
  orderId: string,
  totalCents: number,
  email: string
) => {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  if (!webhookUrl) return;

  await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      embeds: [{
        title: "💰 New Order",
        color: 0x1a1a1a,
        fields: [
          { name: "Order ID", value: `\`${orderId}\``, inline: true },
          { name: "Total", value: `**$${(totalCents / 100).toFixed(2)}**`, inline: true },
          { name: "Customer", value: email, inline: false },
        ],
        timestamp: new Date().toISOString(),
        footer: { text: "Luveni · New Order" },
      }],
    }),
  });
};

const sendReceiptEmail = async (
  orderId: string,
  email: string,
  totalCents: number
) => {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return;

  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "Luveni Orders <orders@luveni.com>",
      to: process.env.BUSINESS_EMAIL,
      subject: `New Order — $${(totalCents / 100).toFixed(2)}`,
      html: `
        <div style="font-family:monospace;max-width:480px;margin:0 auto;padding:32px;color:#111">
          <h2 style="font-size:14px;letter-spacing:0.1em;text-transform:uppercase;margin-bottom:24px">New Order Received</h2>
          <table style="width:100%;font-size:13px;border-collapse:collapse">
            <tr><td style="padding:8px 0;opacity:0.5;width:40%">ORDER ID</td><td>${orderId}</td></tr>
            <tr><td style="padding:8px 0;opacity:0.5">CUSTOMER</td><td>${email}</td></tr>
            <tr><td style="padding:8px 0;opacity:0.5">TOTAL</td><td style="font-weight:bold">$${(totalCents / 100).toFixed(2)}</td></tr>
            <tr><td style="padding:8px 0;opacity:0.5">TIME</td><td>${new Date().toLocaleString()}</td></tr>
          </table>
          <p style="margin-top:32px;font-size:12px;opacity:0.4">Luveni · Automated Order Notification</p>
        </div>
      `,
    }),
  });
};

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
            // Fetch the order with its stored line-item routing + metadata.
            const { data: order } = await supabaseAdmin
              .from("orders")
              .select("id, status, metadata")
              .eq("id", orderId)
              .single<{ id: string; status: string; metadata: any }>();

            const metadata = order?.metadata ?? {};

            // Idempotency: Stripe retries webhooks. If we've already
            // submitted fulfillment for this order, do nothing further.
            if (metadata.fulfillment) {
              console.log(`Order ${orderId} already fulfilled; skipping.`);
              return new Response(JSON.stringify({ received: true, duplicate: true }), { status: 200 });
            }

            // Mark paid.
            await supabaseAdmin
              .from("orders")
              .update({ status: "paid", provider_ref: session.id })
              .eq("id", orderId);

            // Fire notifications (non-blocking on fulfillment).
            await Promise.all([
              sendDiscordAlert(
                orderId,
                session.amount_total ?? 0,
                session.customer_details?.email ?? "unknown"
              ),
              sendReceiptEmail(
                orderId,
                session.customer_details?.email ?? "unknown",
                session.amount_total ?? 0
              ),
            ]);

            // ── Real-time supplier fulfillment ──────────────────────
            // Never let a supplier failure lose the sale: the order is
            // already paid. We record results + alert on any problem.
            try {
              const { fulfillOrder } = await import("@/lib/fulfillment.server");

              const items = Array.isArray(metadata.items) ? metadata.items : [];
              // Stripe exposes the collected shipping address; fall back to
              // billing details if shipping wasn't returned.
              const ship =
                (session as any).shipping_details ??
                (session as any).collected_information?.shipping_details ??
                null;
              const addr = ship?.address ?? session.customer_details?.address ?? null;
              const recipientName =
                ship?.name ?? session.customer_details?.name ?? "Customer";

              if (items.length > 0 && addr) {
                const recipient = {
                  name: recipientName,
                  email: session.customer_details?.email ?? undefined,
                  phone: session.customer_details?.phone ?? undefined,
                  address1: addr.line1 ?? "",
                  address2: addr.line2 ?? undefined,
                  city: addr.city ?? "",
                  state_code: addr.state ?? undefined,
                  country_code: addr.country ?? "",
                  zip: addr.postal_code ?? "",
                };

                const results = await fulfillOrder(orderId, recipient, items);
                const problems = results.filter((r) => !r.ok);

                await supabaseAdmin
                  .from("orders")
                  .update({
                    metadata: {
                      ...metadata,
                      fulfillment: { submitted_at: new Date().toISOString(), results },
                    },
                  })
                  .eq("id", orderId);

                if (problems.length > 0) {
                  const summary = problems
                    .map((p) => `${p.provider}${p.skipped ? " (manual)" : ""}: ${p.error}`)
                    .join("; ");
                  await sendDiscordAlert(
                    `${orderId} ⚠️ FULFILLMENT NEEDS ATTENTION — ${summary}`,
                    session.amount_total ?? 0,
                    session.customer_details?.email ?? "unknown"
                  );
                }
              } else {
                console.warn(`Order ${orderId}: no items or no shipping address; fulfillment skipped.`);
                await sendDiscordAlert(
                  `${orderId} ⚠️ PAID but missing ${items.length === 0 ? "line items" : "shipping address"} — manual fulfillment needed`,
                  session.amount_total ?? 0,
                  session.customer_details?.email ?? "unknown"
                );
              }
            } catch (fErr) {
              console.error(`Fulfillment error for order ${orderId}`, fErr);
              await sendDiscordAlert(
                `${orderId} ⚠️ FULFILLMENT EXCEPTION — ${(fErr as Error).message}`,
                session.amount_total ?? 0,
                session.customer_details?.email ?? "unknown"
              );
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
