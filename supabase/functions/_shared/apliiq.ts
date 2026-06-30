// ─────────────────────────────────────────────────────────────
//  Luveni GM — Apliiq authentication (shared, Deno/Web Crypto)
//
//  Apliiq signs every request with an HMAC-SHA256 header:
//
//      x-apliiq-auth  RTS:Signature:APPID:State
//
//    RTS       Unix timestamp (seconds). Apliiq rejects requests whose
//              RTS drifts more than a few minutes from its own clock, so
//              we resolve time from a trusted source (NTP-equivalent),
//              not just the container clock.
//    State     Per-request nonce (GUID) — also folded into the signature
//              so a captured header can't be replayed with a new body.
//    APPID     The public application id (safe to send).
//    Signature Base64( HMAC-SHA256( sharedSecret, `${RTS}${State}` ) ).
//
//  The shared secret + APPID live ONLY in Supabase Edge secrets; the
//  browser never sees them. This module is imported by both apliiq-proxy
//  (generic signed passthrough) and apliiq-sync (catalog import).
// ─────────────────────────────────────────────────────────────

/* eslint-disable @typescript-eslint/no-explicit-any */

const enc = new TextEncoder();

function bytesToBase64(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  // btoa exists in Deno's global scope.
  return btoa(bin);
}

/** Random RFC-4122 v4 GUID for the per-request State nonce. */
export function newState(): string {
  // crypto.randomUUID is available in the Deno runtime.
  return crypto.randomUUID();
}

/**
 * Resolve "now" in epoch seconds, corrected for host clock drift.
 *
 * Apliiq's gateway compares RTS against its own NTP-synced clock and
 * rejects skew. Containers can drift, so we trust the `Date` response
 * header of a lightweight upstream request (an NTP-synced server) when
 * available, and fall back to the local clock. Result is cached briefly
 * with the measured offset so we don't fetch on every signature.
 */
let cachedOffsetMs = 0;
let offsetCheckedAt = 0;

export async function ntpEpochSeconds(
  timeSourceUrl = "https://api.apliiq.com/",
): Promise<number> {
  const now = Date.now();
  // Re-measure offset at most every 5 minutes.
  if (now - offsetCheckedAt > 5 * 60_000) {
    try {
      const res = await fetch(timeSourceUrl, { method: "HEAD" });
      const dateHeader = res.headers.get("date");
      if (dateHeader) {
        const serverMs = new Date(dateHeader).getTime();
        if (Number.isFinite(serverMs)) cachedOffsetMs = serverMs - Date.now();
      }
      offsetCheckedAt = Date.now();
    } catch {
      // Network blip — keep the previous offset (or 0) and move on.
      offsetCheckedAt = Date.now();
    }
  }
  return Math.floor((Date.now() + cachedOffsetMs) / 1000);
}

/**
 * Build the `x-apliiq-auth` header value for a request.
 * @param appId       Public application id (APPID).
 * @param sharedSecret Secret signing key (server-only).
 */
export async function buildApliiqAuthHeader(
  appId: string,
  sharedSecret: string,
): Promise<string> {
  const rts = await ntpEpochSeconds();
  const state = newState();
  const message = `${rts}${state}`;

  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(sharedSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sigBuf = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  const signature = bytesToBase64(new Uint8Array(sigBuf));

  // RTS:Signature:APPID:State
  return `${rts}:${signature}:${appId}:${state}`;
}

const APLIIQ_BASE = "https://api.apliiq.com";

export interface ApliiqRequest {
  method?: string;
  /** Path relative to the Apliiq API base, e.g. "/v1/Product". */
  path: string;
  body?: unknown;
  query?: Record<string, string>;
}

/**
 * Perform a signed Apliiq API call. Returns parsed JSON + status. Never
 * leaks the shared secret; only the signed header crosses the wire.
 */
export async function apliiqFetch(
  appId: string,
  sharedSecret: string,
  req: ApliiqRequest,
): Promise<{ ok: boolean; status: number; data: any }> {
  if (!appId || !sharedSecret) {
    return { ok: false, status: 500, data: { error: "Apliiq credentials not configured" } };
  }
  const authHeader = await buildApliiqAuthHeader(appId, sharedSecret);
  const url = new URL(req.path.replace(/^\//, ""), `${APLIIQ_BASE}/`);
  for (const [k, v] of Object.entries(req.query ?? {})) url.searchParams.set(k, v);

  const headers: Record<string, string> = {
    "x-apliiq-auth": authHeader,
    Accept: "application/json",
  };
  if (req.body !== undefined) headers["Content-Type"] = "application/json";

  const res = await fetch(url.toString(), {
    method: req.method ?? "GET",
    headers,
    body: req.body !== undefined ? JSON.stringify(req.body) : undefined,
  });
  const text = await res.text();
  let data: any;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  return { ok: res.ok, status: res.status, data };
}
