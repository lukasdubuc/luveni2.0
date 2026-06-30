// ─────────────────────────────────────────────────────────────
//  Luveni GM — apliiq-proxy (Supabase Edge Function)
//
//  Admin-gated, signed passthrough to the Apliiq API. The design studio
//  and any sitewide Apliiq call go through here so the APPID + shared
//  secret never reach the client and every request is HMAC-SHA256 signed
//  with an NTP-corrected timestamp (fixes the recurring auth / signature
//  / clock-drift rejections).
//
//  Request body:  { path: "/v1/Product", method?: "GET", body?, query? }
//  Only whitelisted path prefixes are allowed so the proxy can't be used
//  as an open relay.
//
//  Secrets (Edge → Secrets): APLIIQ_APP_ID, APLIIQ_SHARED_SECRET
// ─────────────────────────────────────────────────────────────

/* eslint-disable @typescript-eslint/no-explicit-any */

import { corsHeaders, json, requireAdmin } from "../_shared/http.ts";
import { apliiqFetch } from "../_shared/apliiq.ts";

const APP_ID = Deno.env.get("APLIIQ_APP_ID") || "";
const SHARED_SECRET = Deno.env.get("APLIIQ_SHARED_SECRET") || "";

// Only these Apliiq path prefixes may be proxied.
const ALLOWED_PREFIXES = ["/v1/product", "/v1/order", "/v1/blank", "/v1/inventory", "/v1/file"];

function pathAllowed(path: string): boolean {
  const p = ("/" + path.replace(/^\//, "")).toLowerCase();
  return ALLOWED_PREFIXES.some((prefix) => p.startsWith(prefix));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const authErr = await requireAdmin(req);
  if (authErr) return authErr;

  if (!APP_ID || !SHARED_SECRET) {
    return json({ error: "Apliiq credentials not configured (APLIIQ_APP_ID / APLIIQ_SHARED_SECRET)" }, 500);
  }

  const { path, method, body, query } = await req.json().catch(() => ({}));
  if (typeof path !== "string" || !path) return json({ error: "path is required" }, 400);
  if (!pathAllowed(path)) return json({ error: `Path "${path}" is not whitelisted` }, 403);

  const result = await apliiqFetch(APP_ID, SHARED_SECRET, {
    path,
    method: typeof method === "string" ? method : "GET",
    body,
    query: query && typeof query === "object" ? query : undefined,
  });

  // Mirror Apliiq's status so the caller can react, but never echo creds.
  return json({ ok: result.ok, status: result.status, data: result.data }, result.ok ? 200 : 502);
});
