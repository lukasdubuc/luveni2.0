// ─────────────────────────────────────────────────────────────
//  Luveni GM — cj-inventory-sync (Supabase Edge Function)
//
//  Oversell protection. Reads live per-warehouse stock from CJ for every
//  CJ-sourced product, writes totals onto products.variants[].stock (with
//  per-warehouse detail in variants[].cj_stock), and fires one Discord
//  alert per drop when a product's *buffered* stock reaches its
//  low_stock_threshold — so it can be paused on TikTok before overselling.
//
//  Callable by: admin JWT (Sync button), service-role bearer, or the
//  scheduled cron via the x-cron-key header (CRON_KEY secret).
//
//  Secrets: CJ_EMAIL, CJ_API_KEY (+ optional CJ_API_BASE), CRON_KEY.
// ─────────────────────────────────────────────────────────────

/* eslint-disable @typescript-eslint/no-explicit-any */

import { corsHeaders, json, requireAdmin, SUPABASE_URL, SERVICE_KEY } from "../_shared/http.ts";
import { cjConfigured, getCjToken, cjGet, summarizeStock, isCronOrService } from "../_shared/cj.ts";

const svc = () => ({ apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function sendDiscord(title: string, message: string, level: string) {
  await fetch(`${SUPABASE_URL}/functions/v1/discord-notify`, {
    method: "POST",
    headers: { ...svc(), "Content-Type": "application/json" },
    body: JSON.stringify({ title, message, level, source: "cj-inventory-sync" }),
  }).catch(() => {});
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (!(await isCronOrService(req))) {
    const authErr = await requireAdmin(req);
    if (authErr) return authErr;
  }
  if (!cjConfigured()) return json({ error: "CJ_EMAIL / CJ_API_KEY secrets not set" }, 500);

  let token: string;
  try { token = await getCjToken(); } catch (e: any) { return json({ error: e.message }, 502); }

  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/products?source=eq.cj&is_archived=eq.false&select=id,title,variants,buffer_qty,low_stock_threshold,last_low_stock_alert_at`,
    { headers: svc() },
  );
  const products: any[] = res.ok ? await res.json().catch(() => []) : [];

  let checked = 0;
  let updated = 0;
  const alerts: string[] = [];
  const errors: string[] = [];
  const ALERT_COOLDOWN_MS = 6 * 60 * 60 * 1000;

  for (const p of products) {
    const variants: any[] = Array.isArray(p.variants) ? p.variants : [];
    if (!variants.length) continue;

    let changed = false;
    let minBuffered = Infinity;
    for (const v of variants) {
      const vid = v?.external_sku || v?.vid;
      if (!vid) continue;
      checked++;
      try {
        const rows = await cjGet(token, `product/stock/queryByVid?vid=${encodeURIComponent(String(vid))}`);
        const s = summarizeStock(Array.isArray(rows) ? rows : []);
        if (v.stock !== s.total) { v.stock = s.total; changed = true; }
        if (JSON.stringify(v.cj_stock) !== JSON.stringify(s.warehouses)) {
          v.cj_stock = s.warehouses;
          v.cj_held = s.cjHeld;
          changed = true;
        }
        const buffered = Math.max(0, s.total - Math.max(0, Number(p.buffer_qty) || 0));
        if (buffered < minBuffered) minBuffered = buffered;
        await sleep(1100); // stock endpoint QPS is 1/s (confirmed live: 429 code 1600200)
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
