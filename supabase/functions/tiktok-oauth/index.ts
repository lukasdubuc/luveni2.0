// ─────────────────────────────────────────────────────────────
//  Luveni GM — tiktok-oauth (Supabase Edge Function)
//
//  OAuth for the TikTok content-posting integration (developers.tiktok.com,
//  Login Kit + Content Posting API). NOT TikTok Shop.
//
//  Flow:
//    POST { action: "start" }      (admin) → { url } to redirect the owner to
//    GET  ?code=...&state=...      (TikTok callback) → exchanges the code,
//                                   stores tokens, shows a "connected" page
//    POST { action: "status" }     (admin) → connection state (no secrets)
//    POST { action: "disconnect" } (admin) → forget tokens
//
//  Register this function's URL as the app's Redirect URI:
//    https://<project>.supabase.co/functions/v1/tiktok-oauth
//  Deploy with verify_jwt=false (the TikTok callback carries no JWT);
//  every POST action is admin-gated internally.
// ─────────────────────────────────────────────────────────────

/* eslint-disable @typescript-eslint/no-explicit-any */

import { corsHeaders, json, requireAdmin, SUPABASE_URL } from "../_shared/http.ts";
import {
  TIKTOK_CLIENT_KEY, TIKTOK_CLIENT_SECRET, TIKTOK_AUTH_URL, TIKTOK_SCOPES,
  loadTikTokAuth, saveTikTokAuth, tokenGrant, patchMeta,
} from "../_shared/tiktok.ts";

const REDIRECT_URI = `${SUPABASE_URL}/functions/v1/tiktok-oauth`;

const page = (title: string, body: string, ok = true) =>
  new Response(
    `<!doctype html><meta charset="utf-8"><title>${title}</title>
     <body style="font-family:ui-monospace,monospace;background:#0a0a0a;color:#fafafa;display:grid;place-items:center;min-height:100vh;margin:0">
     <div style="text-align:center;max-width:28rem;padding:2rem">
       <div style="font-size:2rem">${ok ? "✅" : "⚠️"}</div>
       <h1 style="font-size:1rem;text-transform:uppercase;letter-spacing:.1em">${title}</h1>
       <p style="font-size:.8rem;color:#a3a3a3">${body}</p>
     </div></body>`,
    { status: ok ? 200 : 400, headers: { "Content-Type": "text/html; charset=utf-8" } },
  );

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // ── GET: the TikTok redirect callback ──────────────────────
  if (req.method === "GET") {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const err = url.searchParams.get("error");
    if (err) return page("TikTok authorization failed", `${err}: ${url.searchParams.get("error_description") ?? ""}`, false);
    if (!code) return page("Missing code", "TikTok did not return an authorization code.", false);

    // CSRF: state must match the value minted by action:"start".
    const meta = await fetch(`${SUPABASE_URL}/rest/v1/site_config?id=eq.main&select=metadata`, {
      headers: {
        apikey: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "",
        Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""}`,
      },
    }).then((r) => r.json()).then((r) => r?.[0]?.metadata ?? {}).catch(() => ({}));
    const expected = meta?.tiktok_oauth_state;
    if (!expected || state !== expected.value || Date.now() - (expected.at ?? 0) > 15 * 60 * 1000) {
      return page("State mismatch", "Restart the connection from Admin → Settings → Integrations.", false);
    }

    try {
      const auth = await tokenGrant({ grant_type: "authorization_code", code, redirect_uri: REDIRECT_URI });
      await saveTikTokAuth(auth);
      await patchMeta({ tiktok_oauth_state: null });
      return page("TikTok connected", `Account ${auth.open_id.slice(0, 10)}… authorized for: ${auth.scope}. You can close this tab.`);
    } catch (e: any) {
      return page("Token exchange failed", e.message, false);
    }
  }

  // ── POST: admin actions ─────────────────────────────────────
  const authErr = await requireAdmin(req);
  if (authErr) return authErr;

  const body = await req.json().catch(() => ({}));
  const action = body.action ?? "status";

  if (action === "start") {
    if (!TIKTOK_CLIENT_SECRET) return json({ error: "TIKTOK_CLIENT_SECRET secret not set" }, 500);
    const state = crypto.randomUUID().replace(/-/g, "");
    await patchMeta({ tiktok_oauth_state: { value: state, at: Date.now() } });
    const url = `${TIKTOK_AUTH_URL}?${new URLSearchParams({
      client_key: TIKTOK_CLIENT_KEY,
      scope: TIKTOK_SCOPES,
      response_type: "code",
      redirect_uri: REDIRECT_URI,
      state,
    })}`;
    return json({ ok: true, url, redirect_uri: REDIRECT_URI });
  }

  if (action === "status") {
    const auth = await loadTikTokAuth();
    return json({
      ok: true,
      connected: !!auth?.refresh_token,
      open_id: auth?.open_id ?? null,
      scope: auth?.scope ?? null,
      access_valid_until: auth ? new Date(auth.expires_at).toISOString() : null,
      refresh_valid_until: auth ? new Date(auth.refresh_expires_at).toISOString() : null,
      client_key: TIKTOK_CLIENT_KEY,
      secret_set: !!TIKTOK_CLIENT_SECRET,
      redirect_uri: REDIRECT_URI,
    });
  }

  if (action === "disconnect") {
    await saveTikTokAuth(null);
    return json({ ok: true, connected: false });
  }

  return json({ error: `Unknown action "${action}"` }, 400);
});
