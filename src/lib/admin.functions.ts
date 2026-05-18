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

// --- UPDATED PURGE LOGIC ---
export const purgeOrders = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ensureAdmin(context.supabase, context.userId);
    
    // Deletes orders where status is pending or failed (case-insensitive)
    const { error } = await context.supabase
      .from("orders")
      .delete()
      .or('status.ilike.pending,status.ilike.failed');

    if (error) throw new Error(error.message);
    return { ok: true };
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
    const { count: leadCount } = await context.supabase
      .from("leads")
      .select("id", { count: "exact", head: true });
    return {
      totalCents,
      orderCount: all.length,
      paidCount: paid.length,
      leadCount: leadCount ?? 0,
      currency: paid[0]?.currency ?? "usd",
      recent: all.slice(0, 50),
    };
  });