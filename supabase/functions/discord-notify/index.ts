// ─────────────────────────────────────────────────────────────
//  Luveni GM — discord-notify (Supabase Edge Function)
//  Single alert channel for the whole system: orders, fulfillment,
//  inventory, and Astra. Posts a themed embed to DISCORD_WEBHOOK_URL.
//
//  Auth: admin user JWT (from the dashboard) OR the service-role key
//  (server-to-server callers like jarvis-brain / fulfill-order).
//
//  Secret required: DISCORD_WEBHOOK_URL (Supabase → Edge Functions → Secrets)
// ─────────────────────────────────────────────────────────────

/* eslint-disable @typescript-eslint/no-explicit-any */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, Authorization",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const DISCORD_WEBHOOK_URL = Deno.env.get("DISCORD_WEBHOOK_URL") || "";

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const LEVEL_COLOR: Record<string, number> = {
  info: 0x5865f2,
  success: 0x2ecc71,
  warning: 0xf1c40f,
  error: 0xe74c3c,
};

async function isAdmin(token: string): Promise<boolean> {
  try {
    const u = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${token}` },
    });
    if (!u.ok) return false;
    const user = await u.json();
    if (!user?.id) return false;
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/has_role`, {
      method: "POST",
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ _user_id: user.id, _role: "admin" }),
    });
    return r.ok && (await r.json()) === true;
  } catch {
    return false;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const auth = req.headers.get("Authorization") || req.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  const authorized = (SERVICE_KEY && token === SERVICE_KEY) || (token && (await isAdmin(token)));
  if (!authorized) return json({ error: "Unauthorized" }, 401);

  if (!DISCORD_WEBHOOK_URL) {
    return json({ error: "DISCORD_WEBHOOK_URL secret is not set" }, 500);
  }

  let body: any = {};
  try { body = await req.json(); } catch { /* allow empty -> test ping */ }

  const title = body?.title || "Luveni Alert";
  const message = body?.message || "Test alert from Astra — Discord is wired up, sir.";
  const level = (body?.level || "info").toLowerCase();
  const source = body?.source || "system";

  const res = await fetch(DISCORD_WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      embeds: [{
        title,
        description: message,
        color: LEVEL_COLOR[level] ?? LEVEL_COLOR.info,
        footer: { text: `Luveni · ${source}` },
        timestamp: new Date().toISOString(),
      }],
    }),
  });

  if (!res.ok) {
    return json({ error: `Discord ${res.status}: ${await res.text().catch(() => "")}` }, 502);
  }
  return json({ ok: true });
});
