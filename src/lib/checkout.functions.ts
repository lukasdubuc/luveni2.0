import { createServerFn } from "@tanstack/react-start";
import { offer } from "@/config/site";
import { z } from "zod";

const Schema = z.object({
  email: z.string().trim().email().max(255),
  name: z.string().trim().min(1).max(120),
  productId: z.string().uuid().optional(),
  variantSku: z.string().optional(),
  paymentMethod: z.enum(["card", "usdc", "yzy"]).default("card"), // Added support for new methods
});

export const createCheckout = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => Schema.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { paymentMethod } = data;

    // 1. Authoritative Pricing Logic (Same as before)
    let amountCents: number;
    let currency: string;
    let productName: string;

    if (data.productId) {
      const { data: product } = await supabaseAdmin
        .from("products")
        .select("id,title,price_cents,currency,is_published,variants")
        .eq("id", data.productId)
        .maybeSingle();

      if (!product || !product.is_published) {
        return { ok: false as const, error: "Product unavailable." };
      }

      let selectedVariant: any | undefined;
      if (data.variantSku && Array.isArray(product.variants)) {
        selectedVariant = product.variants.find((variant: any) => variant.sku === data.variantSku);
      }

      amountCents = selectedVariant?.price_cents ?? product.price_cents;
      currency = product.currency.toLowerCase();
      productName = selectedVariant
        ? `${product.title} (${selectedVariant.sku})`
        : product.title;

      if (selectedVariant?.stock != null && selectedVariant.stock <= 0) {
        return { ok: false as const, error: "Selected variant is sold out." };
      }
    } else {
      amountCents = offer.priceCents;
      currency = offer.currency.toLowerCase();
      productName = offer.name;
    }

    if (!amountCents || amountCents < 50) {
      return { ok: false as const, error: "Invalid amount." };
    }

    // 2. Create the Order
    const { data: order, error: orderErr } = await supabaseAdmin
      .from("orders")
      .insert({
        email: data.email.toLowerCase(),
        name: data.name,
        amount_cents: amountCents,
        currency,
        status: paymentMethod === "card" ? "pending" : "pending_crypto",
        provider: paymentMethod,
        product_id: data.productId ?? null,
        metadata: {
          productName,
          variantSku: data.variantSku ?? null,
        },
      })
      .select("id")
      .single();

    if (orderErr || !order) {
      console.error("order insert error", orderErr);
      return { ok: false as const, error: "Could not create order." };
    }

    // 3. BRANCHING LOGIC: Handle Stripe vs Crypto
    if (paymentMethod === "card") {
      const Stripe = (await import("stripe")).default;
      const stripeKey = process.env.STRIPE_SECRET_KEY;
      
      if (!stripeKey) {
        return { ok: false as const, error: "Payments not configured." };
      }

      const stripe = new Stripe(stripeKey);
      const origin = "https://services2day.lovable.app";

      try {
        const session = await stripe.checkout.sessions.create({
          mode: "payment",
          customer_email: data.email,
          line_items: [{
            quantity: 1,
            price_data: {
              currency,
              unit_amount: amountCents,
              product_data: { name: productName },
            },
          }],
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
        await supabaseAdmin
          .from("orders")
          .update({ status: "failed", metadata: { error: String(e) } })
          .eq("id", order.id);
        return { ok: false as const, error: "Could not start Stripe payment." };
      }
    } else {
      // 4. CRYPTO BRANCH (USDC / YZY)
      // Your custom crypto integration logic goes here.
      // For now, it simply marks the order as created and ready for your crypto processing flow.
      return { 
        ok: true as const, 
        orderId: order.id, 
        // Redirect to a specific "pay-with-crypto" page if needed, or thank-you
        redirectUrl: `/pay-crypto?order=${order.id}&method=${paymentMethod}` 
      };
    }
  });
