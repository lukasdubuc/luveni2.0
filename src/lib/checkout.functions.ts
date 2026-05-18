import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const Schema = z.object({
  email: z.string().trim().email().max(255),
  name: z.string().trim().min(1).max(120),
  amountCents: z.number().int().positive().max(10_000_000),
  currency: z.string().trim().length(3),
  metadata: z.record(z.string().max(64), z.any()).optional(),
});

/**
 * Creates a pending order. Today this just records the intent so the
 * Thank You page can confirm something happened and you have a record.
 *
 * When you turn on Stripe or Paddle, this is the function that creates
 * the checkout session and returns the redirect URL.
 */
export const createCheckout = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => Schema.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: order, error } = await supabaseAdmin
      .from("orders")
      .insert({
        email: data.email.toLowerCase(),
        name: data.name,
        amount_cents: data.amountCents,
        currency: data.currency.toLowerCase(),
        status: "pending",
        provider: "manual",
        metadata: data.metadata ?? {},
      })
      .select("id")
      .single();

    if (error || !order) {
      console.error("createCheckout error", error);
      return { ok: false as const, error: "Could not create order." };
    }

    // TODO (when payments are enabled):
    //   const session = await stripe.checkout.sessions.create({ ... });
    //   await supabaseAdmin.from("orders").update({ provider_ref: session.id, provider: "stripe" }).eq("id", order.id);
    //   return { ok: true, redirectUrl: session.url, orderId: order.id };

    return { ok: true as const, orderId: order.id, redirectUrl: null as string | null };
  });
