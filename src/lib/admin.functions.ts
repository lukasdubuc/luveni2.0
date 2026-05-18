"use server"; // Critical: Tells the bundler this is server-side only

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

export const purgeOrders = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ensureAdmin(context.supabase, context.userId);
    const { error } = await context.supabase
      .from("orders")
      .delete()
      .or('status.ilike.pending,status.ilike.failed');
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