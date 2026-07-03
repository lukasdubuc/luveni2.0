// ─────────────────────────────────────────────────────────────
//  Luveni GM — cj-webhook (Supabase Edge Function)
//
//  Near-real-time inventory: receives CJ Dropshipping webhook pushes
//  (stock / product changes) so the site doesn't wait for the 30-minute
//  cj-inventory-sync sweep. The payload is treated as a TRIGGER, not as
//  truth — for every variant id (vid) mentioned we re-query CJ's stock
//  API and write the authoritative number, reusing the same summarize +
//  low-stock alert logic as the sweep.
//
//  Auth: CJ can't send custom headers, so the shared secret rides in the
//  URL:  https://<project>.supabase.co/functions/v1/cj-webhook?key=<CRON_KEY>
//  Deploy with verify_jwt=false. Every event is recorded in
//  cj_webhook_events for Dexter's health checks.
//
//  Configure at CJ (developers.cjdropshipping.com → webhook settings, or
//  the webhook/product/subscribe API) with the URL above.
// ─────────────────────────────────────────────────────────────

/* eslint-disable @typescript-eslint/no-explicit-any */

import { corsHeaders, json, SUPABASE_URL, SERVICE_KEY } from "../_shared/http.ts";
import { cjConfigured, getCjToken, cjGet, summarizeStock } from "../_shared/cj.ts";

const svc = () => ({ apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const ALERT_COOLDOWN_MS = 6 * 60 * 60 * 1000;

async function keyValid(given: string): Promise<boolean> {
  if (!given) return false;
  const envKey = Deno.env.get("CRON_KEY") || "";
  if (envKey && given === envKey) return true;
  const q = await fetch(`${SUPABASE_URL}/rest/v1/site_config?id=eq.main&select=metadata`, { headers: svc() })
    .then((r) => r.json()).catch(() => []);
  const dbKey = q?.[0]?.metadata?.cron_key || "";
  return !!dbKey && given === dbKey;
}

async function recordEvent(type: string, payload: unknown, notes: string): Promise<void> {
  await fetch(`${SUPABASE_URL}/rest/v1/cj_webhook_events`, {
    method: "POST",
    headers: { ...svc(), "Content-Type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify({ type, payload, notes }),
  }).catch(() => {});
}

async function sendDiscord(title: string, message: string, level: string) {
  await fetch(`${SUPABASE_URL}/functions/v1/discord-notify`, {
    method: "POST",
    headers: { ...svc(), "Content-Type": "application/json" },
    body: JSON.stringify({ title, message, level, source: "cj-webhook" }),
  }).catch(() => {});
}

/** Pull every vid/pid mentioned anywhere in the (loosely-specified) payload. */
function extractIds(payload: any): { vids: Set<string>; pids: Set<string> } {
  const vids = new Set<string>();
  const pids = new Set<string>();
  const walk = (node: any, depth: number) => {
    if (!node || depth > 6) return;
    if (Array.isArray(node)) { for (const n of node) walk(n, depth + 1); return; }
    if (typeof node !== "object") return;
    for (const [k, v] of Object.entries(node)) {
      const key = k.toLowerCase();
      if ((key === "vid" || key === "variantid") && v) vids.add(String(v));
      else if ((key === "pid" || key === "productid") && v) pids.add(String(v));
      else walk(v, depth + 1);
    }
  };
  walk(payload, 0);
  return { vids, pids };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const url = new URL(req.url);
  const key = url.searchParams.get("key") || req.headers.get("x-cron-key") || "";
  if (!(await keyValid(key))) return json({ error: "Unauthorized" }, 401);

  const payload = await req.json().catch(() => ({}));
  const type = String(payload?.type ?? payload?.messageType ?? "unknown");

  if (!cjConfigured()) {
    await recordEvent(type, payload, "skipped: CJ secrets not set");
    return json({ ok: true, processed: 0, note: "CJ secrets not set" });
  }

  const { vids, pids } = extractIds(payload);

  // Resolve pids → vids via our own catalog (no CJ round-trip needed).
  const filters: string[] = [];
  if (pids.size) filters.push(`external_product_id.in.(${[...pids].join(",")})`);
  const products: any[] = await fetch(
    `${SUPABASE_URL}/rest/v1/products?source=eq.cj&is_archived=eq.false&select=id,title,variants,buffer_qty,low_stock_threshold,last_low_stock_alert_at,external_product_id${
      filters.length ? `&or=(${filters.join(",")})` : ""
    }`,
    { headers: svc() },
  ).then((r) => (r.ok ? r.json() : [])).catch(() => []);

  // Products owning any mentioned vid, plus all products for mentioned pids.
  const touched = products.filter((p: any) =>
    pids.has(String(p.external_product_id)) ||
    (Array.isArray(p.variants) && p.variants.some((v: any) => vids.has(String(v?.external_sku ?? v?.vid ?? "")))),
  );

  if (!touched.length) {
    await recordEvent(type, payload, `no matching products (vids: ${vids.size}, pids: ${pids.size})`);
    return json({ ok: true, processed: 0 });
  }

  let token: string;
  try { token = await getCjToken(); } catch (e: any) {
    await recordEvent(type, payload, `CJ auth failed: ${e.message}`);
    return json({ ok: true, processed: 0, error: e.message });
  }

  let updated = 0;
  const errors: string[] = [];

  for (const p of touched) {
    const variants: any[] = Array.isArray(p.variants) ? p.variants : [];
    let changed = false;
    let minBuffered = Infinity;

    for (const v of variants) {
      const vid = String(v?.external_sku ?? v?.vid ?? "");
      if (!vid) continue;
      // Re-check every variant of a pid-level event; only mentioned vids otherwise.
      if (!pids.has(String(p.external_product_id)) && !vids.has(vid)) continue;
      try {
        const rows = await cjGet(token, `product/stock/queryByVid?vid=${encodeURIComponent(vid)}`);
        const s = summarizeStock(Array.isArray(rows) ? rows : []);
        if (v.stock !== s.total) { v.stock = s.total; changed = true; }
        if (JSON.stringify(v.cj_stock) !== JSON.stringify(s.warehouses)) {
          v.cj_stock = s.warehouses;
          v.cj_held = s.cjHeld;
          changed = true;
        }
        const buffered = Math.max(0, s.total - Math.max(0, Number(p.buffer_qty) || 0));
        if (buffered < minBuffered) minBuffered = buffered;
        await sleep(1100); // stock endpoint QPS is 1/s
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
        await sendDiscord(
          minBuffered <= 0 ? "⚠️ Out of stock (webhook)" : "🔻 Low stock (webhook)",
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

  await recordEvent(type, payload, `updated ${updated}/${touched.length} product(s)${errors.length ? `; errors: ${errors.join("; ").slice(0, 400)}` : ""}`);
  return json({ ok: true, processed: touched.length, updated, errors });
});
