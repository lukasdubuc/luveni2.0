import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const Schema = z.object({
  email: z.string().trim().email().max(255),
  source: z.string().trim().max(64).optional(),
  metadata: z.record(z.any()).optional(),
});

export const captureLead = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => Schema.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("leads").insert({
      email: data.email.toLowerCase(),
      source: data.source ?? null,
      metadata: data.metadata ?? {},
    });
    if (error) {
      console.error("captureLead error", error);
      return { ok: false as const, error: "Could not save email." };
    }
    // Future: forward to webhook (Zapier/Make/email tool) here.
    return { ok: true as const };
  });
