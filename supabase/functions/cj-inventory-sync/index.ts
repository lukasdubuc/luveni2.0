// ─────────────────────────────────────────────────────────────
//  Luveni GM — cj-inventory-sync (Supabase Edge Function)
//
//  Oversell protection. Reads live stock from CJ Dropshipping for every
//  product sourced from CJ, writes it onto products.variants[].stock, and
//  fires a single Discord alert when a product's *buffered* stock drops to
//  or below its low_stock_threshold — so you can pause it on TikTok before
//  selling something you can't ship.
//
//  Runs either from the admin "Sync stock" button (admin JWT) or from the
//  scheduled cron (service-role bearer). No auto-publish, no destructive ops.
//
//  Secrets:
//    CJ_EMAIL     — CJ account email
//    CJ_API_KEY   — CJ API key (used as the auth "password")
//    CJ_API_BASE  — optional override (default CJ API v2)
//
//  NOTE: CJ field names for the stock query vary by endpoint/version; the
//  extraction below tries the known variants and is the one spot to confirm
//  against a live response.
// ─────────────────────────────────────────────────────────────

/* eslint-disable @typescript-eslint/no-explicit-any */

import { corsHeaders, json, requireAdmin, SUPABASE_URL, SERVICE_KEY } from "../_shared/http.ts";

const CJ_BASE = Deno.env.get("CJ_API_BASE") || "https://developers.cjdropshipping.com/api2.0/v1";
const CJ_EMAIL = Deno.env.get("CJ_EMAIL") || "";
const CJ_API_KEY = Deno.env.get("CJ_API_KEY") || "";

const svc = () => ({ apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` });

/** getAccessToken is heavily rate-limited (~1 / 300s); the cron interval is
 *  well above that, so we simply auth per run. */
async function cjAuth(): Promise<string> {
  const res = await fetch(`${CJ_BASE}/authentication/getAccessToken`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: CJ_EMAIL, password: CJ_API_KEY }),
  });
  const body = await res.json().catch(() => ({}));
  const token = body?.data?.accessToken;
  if (!token) throw new Error(`CJ auth failed (${res.status}): ${JSON.stringify(body).slice(0, 300)}`);
  return token;
}

/** Live stock for one CJ variant id (vid), summed across warehouses. */
async function cjStockByVid(token: string, vid: string): Promise<number | null> {
  const res = await fetch(`${CJ_BASE}/product/stock/queryByVid?vid=${encodeURIComponent(vid)}`, {
    headers: { "CJ-Access-Token": token },
  });
  if (!res.ok) return null;
  const body = await res.json().catch(() => ({}));
  const rows = body?.data;
  if (!Array.isArray(rows)) {
    // Some responses return a single object with a total field.
    const n = Number(rows?.cjInventory ?? rows?.storageNum ?? rows?.totalInventory ?? rows?.quantity ?? NaN);
    return Number.isFinite(n) ? n : null;
  }
  let total = 0; let found = false;
  for (const r of rows) {
    const n = Number(r?.cjInventory ?? r?.storageNum ?? r?.totalInventory ?? r?.quantity ?? NaN);
    if (Number.isFinite(n)) { total += n; found = true; }
  }
  return found ? total : null;
}

async function sendDiscord(title: string, message: string, level: string) {
  await fetch(`${SUPABASE_URL}/functions/v1/discord-notify`, {
    method: "POST",
    headers: { ...svc(), "Content-Type": "application/json" },
    body: JSON.stringify({ title, message, level, source: "cj-inventory-sync" }),
  }).catch(() => {});
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // Allow the scheduled cron (service-role bearer) or an admin user.
  const auth = req.headers.get("Authorization") || req.headers.get("authorization") || "";
  const isService = auth === `Bearer ${SERVICE_KEY}` && SERVICE_KEY !== "";
  if (!isService) {
    const authErr = await requireAdmin(req);
    if (authErr) return authErr;
  }

  if (!CJ_EMAIL || !CJ_API_KEY) {
    return json({ error: "CJ_EMAIL and CJ_API_KEY secrets not set" }, 500);
  }

  let token: string;
  try {
    token = await cjAuth();
  } catch (e: any) {
    return json({ error: e.message }, 502);
  }

  // Pull CJ-sourced products with variants + alert bookkeeping.
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/products?source=eq.cj&is_archived=eq.false&select=id,title,variants,buffer_qty,low_stock_threshold,last_low_stock_alert_at`,
    { headers: svc() },
  );
  const products: any[] = res.ok ? await res.json().catch(() => []) : [];

  let checked = 0;
  let updated = 0;
  const alerts: string[] = [];
  const errors: string[] = [];
  const ALERT_COOLDOWN_MS = 6 * 60 * 60 * 1000; // one alert per product per 6h

  for (const p of products) {
    const variants: any[] = Array.isArray(p.variants) ? p.variants : [];
    if (!variants.length) continue;

    let changed = false;
    let minBuffered = Infinity;
    for (const v of variants) {
      const vid = v?.external_sku || v?.vid || v?.cj_vid;
      if (!vid) continue;
      checked++;
      try {
        const stock = await cjStockByVid(token, String(vid));
        if (stock == null) continue;
        if (v.stock !== stock) { v.stock = stock; changed = true; }
        const buffered = Math.max(0, stock - Math.max(0, Number(p.buffer_qty) || 0));
        if (buffered < minBuffered) minBuffered = buffered;
      } catch (e: any) {
        errors.push(`${p.title} / ${vid}: ${e.message}`);
      }
    }

    if (changed) {
      const ok = await fetch(`${SUPABASE_URL}/rest/v1/products?id=eq.${p.id}`, {
        method: "PATCH",
        headers: { ...svc(), "Content-Type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify({ variants, updated_at: new Date().toISOString() }),
      }).then((r) => r.ok).catch(() => false);
      if (ok) updated++;
    }

    // Low-stock alert (deduped by cooldown).
    const threshold = Number(p.low_stock_threshold ?? 3);
    if (minBuffered !== Infinity && minBuffered <= threshold) {
      const last = p.last_low_stock_alert_at ? new Date(p.last_low_stock_alert_at).getTime() : 0;
      if (Date.now() - last > ALERT_COOLDOWN_MS) {
        alerts.push(p.title);
        await sendDiscord(
          minBuffered <= 0 ? "⚠️ Out of stock" : "🔻 Low stock",
          `${p.title} — buffered stock is ${minBuffered}. Consider pausing it on TikTok Shop.`,
          minBuffered <= 0 ? "error" : "warn",
        );
        await fetch(`${SUPABASE_URL}/rest/v1/products?id=eq.${p.id}`, {
          method: "PATCH",
          headers: { ...svc(), "Content-Type": "application/json", Prefer: "return=minimal" },
          body: JSON.stringify({ last_low_stock_alert_at: new Date().toISOString() }),
        }).catch(() => {});
      }
    }
  }

  return json({
    ok: true,
    products: products.length,
    variants_checked: checked,
    products_updated: updated,
    low_stock_alerts: alerts,
    errors,
  });
});
