import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";

const Schema = z.object({
  email: z.string().trim().email().max(255),
  name: z.string().trim().min(1).max(120),
  productId: z.string().uuid().optional(),
  // Fallback when no productId is provided (uses site config offer).
  amountCents: z.number().int().positive().max(10_000_000).optional(),
  currency: z.string().trim().length(3).optional(),
  productName: z.string().trim().min(1).max(200).optional(),
});

export const createCheckout = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => Schema.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const Stripe = (await import("stripe")).default;

    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeKey) {
      return { ok: false as const, error: "Payments not configured (missing Stripe key)." };
    }

    let amountCents = data.amountCents ?? 0;
    let currency = (data.currency ?? "usd").toLowerCase();
    let productName = data.productName ?? "Order";

    if (data.productId) {
      const { data: product } = await supabaseAdmin
        .from("products")
        .select("id,title,price_cents,currency,is_published")
        .eq("id", data.productId)
        .maybeSingle();
      if (!product || !product.is_published) {
        return { ok: false as const, error: "Product unavailable." };
      }
      amountCents = product.price_cents;
      currency = product.currency.toLowerCase();
      productName = product.title;
    }

    if (!amountCents || amountCents < 50) {
      return { ok: false as const, error: "Invalid amount." };
    }

    // Create pending order
    const { data: order, error: orderErr } = await supabaseAdmin
      .from("orders")
      .insert({
        email: data.email.toLowerCase(),
        name: data.name,
        amount_cents: amountCents,
        currency,
        status: "pending",
        provider: "stripe",
        product_id: data.productId ?? null,
        metadata: { productName },
      })
      .select("id")
      .single();

    if (orderErr || !order) {
      console.error("order insert error", orderErr);
      return { ok: false as const, error: "Could not create order." };
    }

    const stripe = new Stripe(stripeKey);
    try {
      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        customer_email: data.email,
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency,
              unit_amount: amountCents,
              product_data: { name: productName },
            },
          },
        ],
        success_url: `${origin}/thank-you?order=${order.id}`,
        cancel_url: `${origin}/checkout?canceled=1`,
        metadata: { order_id: order.id },
      });

      await supabaseAdmin
        .from("orders")
        .update({ provider_ref: session.id })
        .eq("id", order.id);

      return { ok: true as const, orderId: order.id, redirectUrl: session.url };
    } catch (e) {
      console.error("stripe session error", e);
      await supabaseAdmin
        .from("orders")
        .update({ status: "failed", metadata: { error: String(e) } })
        .eq("id", order.id);
      return { ok: false as const, error: "Could not start payment." };
    }
  });
