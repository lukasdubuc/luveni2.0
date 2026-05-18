import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function ensureAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error || !data) throw new Error("Forbidden: admin only");
}

export const checkIsAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();
    return { isAdmin: !!data, userId };
  });

export const listOrders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ensureAdmin(context.supabase, context.userId);
    const { data, error } = await context.supabase
      .from("orders")
      .select("id,email,name,amount_cents,currency,status,provider,provider_ref,metadata,product_id,created_at")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const updateOrderStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      id: z.string().uuid(),
      status: z.enum(["pending", "paid", "failed", "refunded", "fulfilled"]),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.supabase, context.userId);
    const { error } = await context.supabase
      .from("orders")
      .update({ status: data.status })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listLeads = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ensureAdmin(context.supabase, context.userId);
    const { data, error } = await context.supabase
      .from("leads")
      .select("id,email,source,metadata,created_at")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const listProducts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ensureAdmin(context.supabase, context.userId);
    const { data, error } = await context.supabase
      .from("products")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

const ProductInput = z.object({
  id: z.string().uuid().optional(),
  slug: z.string().trim().min(1).max(120).regex(/^[a-z0-9-]+$/, "lowercase letters, numbers, dashes only"),
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(5000).optional().nullable(),
  price_cents: z.number().int().min(0).max(10_000_000),
  currency: z.string().trim().length(3),
  image_urls: z.array(z.string().url().max(500)).max(10),
  source_url: z.string().url().max(500).optional().nullable(),
  fulfillment_notes: z.string().trim().max(2000).optional().nullable(),
  is_published: z.boolean(),
});

export const upsertProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => ProductInput.parse(i))
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.supabase, context.userId);
    const payload = { ...data, currency: data.currency.toLowerCase() };
    if (data.id) {
      const { error } = await context.supabase
        .from("products")
        .update(payload)
        .eq("id", data.id);
      if (error) throw new Error(error.message);
      return { ok: true, id: data.id };
    }
    const { data: row, error } = await context.supabase
      .from("products")
      .insert(payload)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { ok: true, id: row.id };
  });

export const deleteProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.supabase, context.userId);
    const { error } = await context.supabase.from("products").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const togglePublish = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ id: z.string().uuid(), is_published: z.boolean() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.supabase, context.userId);
    const { error } = await context.supabase
      .from("products")
      .update({ is_published: data.is_published })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getRevenueStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ensureAdmin(context.supabase, context.userId);
    const { data: orders } = await context.supabase
      .from("orders")
      .select("amount_cents,currency,status,created_at,email")
      .order("created_at", { ascending: false });
    const all = orders ?? [];
    const paid = all.filter((o) => o.status === "paid" || o.status === "fulfilled");
    const totalCents = paid.reduce((s, o) => s + (o.amount_cents ?? 0), 0);
    const last7 = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const recentCents = paid
      .filter((o) => new Date(o.created_at).getTime() > last7)
      .reduce((s, o) => s + (o.amount_cents ?? 0), 0);
    const { count: leadCount } = await context.supabase
      .from("leads")
      .select("id", { count: "exact", head: true });
    return {
      totalCents,
      recentCents,
      orderCount: all.length,
      paidCount: paid.length,
      leadCount: leadCount ?? 0,
      currency: paid[0]?.currency ?? "usd",
      recent: all.slice(0, 5),
    };
  });

export const importProductFromUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ url: z.string().url().max(500) }).parse(i))
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.supabase, context.userId);
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) {
      return { ok: false as const, error: "AI not configured." };
    }
    let html = "";
    try {
      const res = await fetch(data.url, {
        headers: { "user-agent": "Mozilla/5.0 LovableBot" },
      });
      html = await res.text();
    } catch {
      return { ok: false as const, error: "Could not fetch the URL." };
    }
    // Strip scripts/styles, collapse whitespace, truncate
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .slice(0, 12000);
    // Extract og:image as a hint
    const ogImage = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)?.[1];

    try {
      const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            {
              role: "system",
              content:
                "Extract product details from web page text. Respond ONLY with strict JSON: {\"title\":string,\"description\":string,\"price_cents\":number,\"currency\":string}. price_cents is integer cents. currency is 3-letter ISO code lowercase. If price is unclear, return 0.",
            },
            { role: "user", content: text },
          ],
        }),
      });
      const json = await aiRes.json();
      let content: string = json?.choices?.[0]?.message?.content ?? "";
      content = content.replace(/^```json\s*|\s*```$/g, "").trim();
      const parsed = JSON.parse(content);
      return {
        ok: true as const,
        prefill: {
          title: String(parsed.title ?? "").slice(0, 200),
          description: String(parsed.description ?? "").slice(0, 5000),
          price_cents: Math.max(0, Math.floor(Number(parsed.price_cents) || 0)),
          currency: String(parsed.currency ?? "usd").toLowerCase().slice(0, 3),
          image_urls: ogImage ? [ogImage] : [],
          source_url: data.url,
        },
      };
    } catch (e) {
      console.error("AI parse failed", e);
      return {
        ok: true as const,
        prefill: {
          title: "",
          description: "",
          price_cents: 0,
          currency: "usd",
          image_urls: ogImage ? [ogImage] : [],
          source_url: data.url,
        },
      };
    }
  });
