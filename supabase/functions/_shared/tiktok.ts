// ─────────────────────────────────────────────────────────────
//  Luveni GM — shared TikTok (developers.tiktok.com) helpers (Deno)
//
//  Content Posting API auth for the Luveni marketing pipeline. This is the
//  OPEN platform (post videos/photos to a TikTok account) — NOT TikTok
//  Shop (commerce API, blocked until the business has an EIN).
//
//  Tokens: access tokens live 24h, refresh tokens 365d. Both are cached in
//  site_config.metadata.tiktok_auth and refreshed transparently.
//
//  Secrets: TIKTOK_CLIENT_KEY (defaults to the registered Luveni app),
//  TIKTOK_CLIENT_SECRET.
// ─────────────────────────────────────────────────────────────

/* eslint-disable @typescript-eslint/no-explicit-any */

import { SUPABASE_URL, SERVICE_KEY } from "./http.ts";

export const TIKTOK_CLIENT_KEY = Deno.env.get("TIKTOK_CLIENT_KEY") || "awd1x02pwutsrvzz";
export const TIKTOK_CLIENT_SECRET = Deno.env.get("TIKTOK_CLIENT_SECRET") || "";
export const TIKTOK_API = "https://open.tiktokapis.com";
export const TIKTOK_AUTH_URL = "https://www.tiktok.com/v2/auth/authorize/";

// Scopes for the content-posting integration (photo + video + basic info).
export const TIKTOK_SCOPES = "user.info.basic,video.publish,video.upload";

const svc = () => ({ apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` });

export interface TikTokAuth {
  access_token: string;
  expires_at: number;         // epoch ms
  refresh_token: string;
  refresh_expires_at: number; // epoch ms
  open_id: string;
  scope: string;
  connected_at: number;
}

async function readMeta(): Promise<any> {
  const q = await fetch(`${SUPABASE_URL}/rest/v1/site_config?id=eq.main&select=metadata`, { headers: svc() })
    .then((r) => r.json()).catch(() => []);
  return q?.[0]?.metadata ?? {};
}

export async function patchMeta(patch: Record<string, unknown>): Promise<void> {
  const meta = await readMeta();
  await fetch(`${SUPABASE_URL}/rest/v1/site_config?id=eq.main`, {
    method: "PATCH",
    headers: { ...svc(), "Content-Type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify({ metadata: { ...meta, ...patch } }),
  });
}

export async function loadTikTokAuth(): Promise<TikTokAuth | null> {
  const meta = await readMeta();
  return meta?.tiktok_auth ?? null;
}

export async function saveTikTokAuth(auth: TikTokAuth | null): Promise<void> {
  await patchMeta({ tiktok_auth: auth });
}

/** Exchange an auth code or refresh token at /v2/oauth/token/. */
export async function tokenGrant(params: Record<string, string>): Promise<TikTokAuth> {
  const body = new URLSearchParams({
    client_key: TIKTOK_CLIENT_KEY,
    client_secret: TIKTOK_CLIENT_SECRET,
    ...params,
  });
  const res = await fetch(`${TIKTOK_API}/v2/oauth/token/`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const d = await res.json().catch(() => ({}));
  if (!res.ok || d?.error || !d?.access_token) {
    throw new Error(`TikTok token grant failed (${res.status}): ${d?.error_description ?? d?.error ?? "no access_token"}`);
  }
  const now = Date.now();
  return {
    access_token: d.access_token,
    expires_at: now + (Number(d.expires_in ?? 86400) - 300) * 1000,
    refresh_token: d.refresh_token,
    refresh_expires_at: now + (Number(d.refresh_expires_in ?? 31536000) - 3600) * 1000,
    open_id: d.open_id ?? "",
    scope: d.scope ?? "",
    connected_at: now,
  };
}

/** Valid access token, refreshing via the refresh token when expired. */
export async function getTikTokToken(): Promise<TikTokAuth> {
  const auth = await loadTikTokAuth();
  if (!auth?.refresh_token) throw new Error("TikTok not connected — run the OAuth flow from Admin → Settings → Integrations");
  if (Date.now() < auth.expires_at) return auth;
  if (Date.now() >= auth.refresh_expires_at) {
    throw new Error("TikTok refresh token expired — reconnect from Admin → Settings → Integrations");
  }
  const fresh = await tokenGrant({ grant_type: "refresh_token", refresh_token: auth.refresh_token });
  await saveTikTokAuth(fresh);
  return fresh;
}

/** Authenticated JSON call against open.tiktokapis.com. */
export async function tkFetch(path: string, init: { method?: string; body?: unknown } = {}): Promise<any> {
  const auth = await getTikTokToken();
  const res = await fetch(`${TIKTOK_API}${path}`, {
    method: init.method ?? "POST",
    headers: { Authorization: `Bearer ${auth.access_token}`, "Content-Type": "application/json; charset=UTF-8" },
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
  });
  const d = await res.json().catch(() => ({}));
  const code = d?.error?.code;
  if (!res.ok || (code && code !== "ok")) {
    throw new Error(`TikTok ${path} → ${res.status}/${code ?? "?"}: ${d?.error?.message ?? ""}`);
  }
  return d;
}
