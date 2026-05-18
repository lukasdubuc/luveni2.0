import { createServerFn } from "@tanstack/react-start";
import { offer } from "@/config/site";
import { z } from "zod";

const Schema = z.object({
  email: z.string().trim().email().max(255),
  name: z.string().trim().min(1).max(120),
  productId: z.string().uuid().optional(),
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

    // Always derive price authoritatively server-side — never trust the caller.
    let amountCents: number;
    let currency: string;
    let productName: string;

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
    } else {
      amountCents = offer.priceCents;
      currency = offer.currency.toLowerCase();
      productName = offer.name;
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
    
    // HARD-CODED ORIGIN FIX: Bypassing process.env.SITE_URL for reliability
    const origin = "https://services2day.lovable.app";

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