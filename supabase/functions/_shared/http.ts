// ─────────────────────────────────────────────────────────────
//  Luveni GM — shared edge-function HTTP helpers (Deno)
//  CORS, JSON responses, fail-closed admin gate, and thin Supabase
//  REST helpers used by the multi-vendor import/publish functions.
// ─────────────────────────────────────────────────────────────

/* eslint-disable @typescript-eslint/no-explicit-any */

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, Authorization",
};

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
export const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const svc = () => ({ apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` });

/** Fail-CLOSED admin gate: any failure denies access. */
export async function requireAdmin(req: Request): Promise<Response | null> {
  const auth = req.headers.get("Authorization") || req.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
  const token = auth.slice(7);
  try {
    const u = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${token}` },
    });
    if (!u.ok) return json({ error: "Unauthorized" }, 401);
    const user = await u.json();
    if (!user?.id) return json({ error: "Unauthorized" }, 401);
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/has_role`, {
      method: "POST",
      headers: { ...svc(), "Content-Type": "application/json" },
      body: JSON.stringify({ _user_id: user.id, _role: "admin" }),
    });
    if (!r.ok || (await r.json()) !== true) return json({ error: "Forbidden" }, 403);
    return null;
  } catch (e: any) {
    return json({ error: `Auth error: ${e.message}` }, 401);
  }
}

/** POST rows to a table with upsert-on-conflict semantics. */
export async function dbUpsert(
  table: string,
  rows: unknown,
  onConflict: string,
  returning: "minimal" | "representation" = "minimal",
): Promise<{ ok: boolean; status: number; data: any }> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/${table}?on_conflict=${encodeURIComponent(onConflict)}`,
    {
      method: "POST",
      headers: {
        ...svc(),
        "Content-Type": "application/json",
        Prefer: `resolution=merge-duplicates,return=${returning}`,
      },
      body: JSON.stringify(rows),
    },
  );
  const text = await res.text();
  let data: any; try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  return { ok: res.ok, status: res.status, data };
}

export async function dbSelect(query: string): Promise<any[]> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${query}`, { headers: svc() });
  if (!res.ok) return [];
  return (await res.json().catch(() => [])) as any[];
}

export async function dbPatch(query: string, patch: unknown): Promise<boolean> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${query}`, {
    method: "PATCH",
    headers: { ...svc(), "Content-Type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify(patch),
  });
  return res.ok;
}
