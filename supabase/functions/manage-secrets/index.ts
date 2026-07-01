// ─────────────────────────────────────────────────────────────
//  Luveni GM — manage-secrets (Supabase Edge Function)
//
//  Self-service secret writer for the Admin → Settings → Connection
//  Secrets panel. Lets an admin set the vendor-integration Edge secrets
//  (Zendrop, TikTok Shop, Apliiq, Printful, Etsy, fulfillment flags)
//  from the app instead of the Supabase dashboard.
//
//  SECURITY MODEL
//  - Admin-gated (requireAdmin) on every request.
//  - Writes go through the Supabase Management API, authenticated with a
//    management token that lives ONLY in Edge config, never the browser.
//  - A strict ALLOWLIST bounds which names can be read/written. The web
//    UI can never touch SUPABASE_SERVICE_ROLE_KEY, the management token
//    itself, or any other non-allowlisted secret — so a compromised admin
//    session still can't escalate to project-wide secret control.
//  - "list" returns only whether each allowlisted secret is SET, never a
//    value (the Management API returns a hash, which we also never expose).
//
//  BOOTSTRAP (set once in the Supabase dashboard → Edge Functions → Secrets):
//    SUPABASE_MANAGEMENT_TOKEN  — a Supabase personal access token
//                                 (https://supabase.com/dashboard/account/tokens)
//    SUPABASE_PROJECT_REF       — this project's ref (e.g. unitqfuetxedmmrvlocu)
//
//  Body:
//    { action: "list" }
//    { action: "set", secrets: { ZENDROP_API_KEY: "…", … } }
//    { action: "delete", names: ["ZENDROP_API_KEY", …] }
// ─────────────────────────────────────────────────────────────

/* eslint-disable @typescript-eslint/no-explicit-any */

import { corsHeaders, json, requireAdmin } from "../_shared/http.ts";

const MGMT_TOKEN = Deno.env.get("SUPABASE_MANAGEMENT_TOKEN") || "";
const PROJECT_REF = Deno.env.get("SUPABASE_PROJECT_REF") || "";
const MGMT_BASE = "https://api.supabase.com/v1";

// The ONLY secret names this endpoint may read or write. Anything not in
// this list is rejected — the web UI is deliberately powerless over the
// service key, the management token, and anything else sensitive.
const ALLOWED_SECRETS = new Set<string>([
  // Zendrop (dropship)
  "ZENDROP_API_KEY",
  "ZENDROP_API_BASE",
  // TikTok Shop (publish channel)
  "TIKTOK_SHOP_TOKEN",
  "TIKTOK_SHOP_ID",
  // Etsy (publish channel)
  "ETSY_TOKEN",
  "ETSY_SHOP_ID",
  // Apliiq (print-on-demand)
  "APLIIQ_APP_ID",
  "APLIIQ_SHARED_SECRET",
  // Printful (print-on-demand)
  "PRINTFUL_API_KEY",
  "PRINTFUL_STORE_ID",
  // Fulfillment auto-submit flags (leave off until tested)
  "APLIIQ_AUTO",
  "ZENDROP_AUTO",
]);

function mgmtHeaders() {
  return {
    Authorization: `Bearer ${MGMT_TOKEN}`,
    "Content-Type": "application/json",
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const authErr = await requireAdmin(req);
  if (authErr) return authErr;

  if (!MGMT_TOKEN || !PROJECT_REF) {
    return json({
      error:
        "Secret management not configured. Set SUPABASE_MANAGEMENT_TOKEN and " +
        "SUPABASE_PROJECT_REF in Supabase → Edge Functions → Secrets first.",
      needsBootstrap: true,
    }, 503);
  }

  const body = await req.json().catch(() => ({}));
  const action = body?.action;
  const secretsUrl = `${MGMT_BASE}/projects/${PROJECT_REF}/secrets`;

  try {
    // ── LIST: which allowlisted secrets are currently set ────────────────
    if (action === "list") {
      const res = await fetch(secretsUrl, { headers: mgmtHeaders() });
      if (!res.ok) {
        return json({ error: `Management API ${res.status}: ${await res.text().catch(() => "")}` }, 502);
      }
      const all = await res.json().catch(() => []) as Array<{ name: string }>;
      const setNames = new Set(all.map((s) => s.name));
      const status: Record<string, boolean> = {};
      for (const name of ALLOWED_SECRETS) status[name] = setNames.has(name);
      return json({ secrets: status });
    }

    // ── SET: create/update one or more allowlisted secrets ───────────────
    if (action === "set") {
      const incoming = body?.secrets;
      if (!incoming || typeof incoming !== "object") {
        return json({ error: "secrets object required" }, 400);
      }
      const entries = Object.entries(incoming) as [string, unknown][];
      const rejected = entries.filter(([name]) => !ALLOWED_SECRETS.has(name)).map(([n]) => n);
      if (rejected.length) {
        return json({ error: `Not allowed to set: ${rejected.join(", ")}` }, 403);
      }
      // Drop blanks so we don't overwrite a set secret with "".
      const payload = entries
        .filter(([, value]) => typeof value === "string" && value.trim() !== "")
        .map(([name, value]) => ({ name, value: String(value) }));
      if (!payload.length) return json({ error: "No non-empty values to set" }, 400);

      const res = await fetch(secretsUrl, {
        method: "POST",
        headers: mgmtHeaders(),
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        return json({ error: `Management API ${res.status}: ${await res.text().catch(() => "")}` }, 502);
      }
      return json({ ok: true, updated: payload.map((p) => p.name) });
    }

    // ── DELETE: remove allowlisted secrets ───────────────────────────────
    if (action === "delete") {
      const names: string[] = Array.isArray(body?.names) ? body.names : [];
      const rejected = names.filter((n) => !ALLOWED_SECRETS.has(n));
      if (rejected.length) {
        return json({ error: `Not allowed to delete: ${rejected.join(", ")}` }, 403);
      }
      if (!names.length) return json({ error: "names array required" }, 400);
      const res = await fetch(secretsUrl, {
        method: "DELETE",
        headers: mgmtHeaders(),
        body: JSON.stringify(names),
      });
      if (!res.ok) {
        return json({ error: `Management API ${res.status}: ${await res.text().catch(() => "")}` }, 502);
      }
      return json({ ok: true, deleted: names });
    }

    return json({ error: "Unknown action. Use 'list', 'set', or 'delete'." }, 400);
  } catch (e: any) {
    return json({ error: `Secret operation failed: ${e?.message || "unknown"}` }, 500);
  }
});
