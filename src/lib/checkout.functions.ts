import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const Schema = z.object({
  email: z.string().trim().email().max(255),
  name: z.string().trim().min(1).max(120),
  items: z.array(z.object({
    productId: z.string().uuid(),
    variantSku: z.string().optional(),
    quantity: z.number().min(1)
  })),
});

export const createCheckout = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => Schema.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const Stripe = (await import("stripe")).default;
    const stripeKey = process.env.STRIPE_SECRET_KEY;

    if (!stripeKey) return { ok: false as const, error: "Payments not configured." };

    // 1. Calculate totals server-side (Security: Never trust client-side prices)
    const line_items = [];
    let totalCents = 0;

    for (const item of data.items) {
      const { data: product } = await supabaseAdmin
        .from("products")
        .select("id,title,price_cents,variants")
        .eq("id", item.productId)
        .maybeSingle();

      if (!product) continue;

      let variant = null;
      if (item.variantSku) {
        variant = product.variants?.find((v: any) => v.sku === item.variantSku);
      }

      const price = variant?.price_cents ?? product.price_cents;
      totalCents += price * item.quantity;
      
      line_items.push({
        quantity: item.quantity,
        price_data: {
          currency: 'usd', // Assuming USD
          unit_amount: price,
          product_data: { name: variant ? `${product.title} (${variant.sku})` : product.title },
        },
      });
    }

    // 2. Create Order
    const { data: order, error: orderErr } = await supabaseAdmin
      .from("orders")
      .insert({
        email: data.email.toLowerCase(),
        name: data.name,
        amount_cents: totalCents,
        status: "pending",
        provider: "stripe",
      })
      .select("id")
      .single();

    if (orderErr || !order) return { ok: false as const, error: "Could not create order." };

    // 3. Stripe Session
    const stripe = new Stripe(stripeKey);
    const origin = "https://services2day.lovable.app";

    try {
      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        customer_email: data.email,
        line_items,
        success_url: `${origin}/thank-you?order=${order.id}`,
        cancel_url: `${origin}/checkout?canceled=1`,
        metadata: { order_id: order.id },
      });

      return { ok: true as const, orderId: order.id, redirectUrl: session.url };
    } catch (e) {
      return { ok: false as const, error: "Could not start payment." };
    }
  });
