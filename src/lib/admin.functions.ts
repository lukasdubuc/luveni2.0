"use server";

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

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
    return { isAdmin: !!data };
  });

export const updateOrderStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: { id: string; status: string }) => d)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("orders")
      .update({ status: data.status })
      .eq("id", data.id);
    
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const purgeOrders = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
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
    const { data: orders } = await context.supabase
      .from("orders")
      .select("id,amount_cents,currency,status,created_at,email")
      .order("created_at", { ascending: false });

    const all = orders ?? [];
    const paid = all.filter((o: any) => o.status === "paid" || o.status === "fulfilled");
    const totalCents = paid.reduce((s: number, o: any) => s + (o.amount_cents ?? 0), 0);
    
    const { count: leadCount } = await context.supabase
      .from("leads")
      .select("id", { count: "exact", head: true });

    return {
      totalCents,
      paidCount: paid.length,
      leadCount: leadCount ?? 0,
      recent: all.slice(0, 50),
      currency: all[0]?.currency || "usd"
    };
  });
