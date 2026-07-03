// ─────────────────────────────────────────────────────────────
//  Luveni GM — fulfill-order (Supabase Edge Function)
//  Submits a PAID order to its supplier(s) in real time. Runs on
//  Supabase so it can read PRINTFUL_API_KEY / Apliiq creds from
//  project secrets.
//
//  Auth: server-to-server only. The caller (Stripe webhook) must
//  present the project's service-role key as a Bearer token.
//
//  Guarantees:
//   • Idempotent — skips if the order was already fulfilled.
//   • Per-item routing — one order can split across Printful + Apliiq.
//   • Never throws on a supplier failure; records the result so the
//     paid order is never lost.
// ─────────────────────────────────────────────────────────────

/* eslint-disable @typescript-eslint/no-explicit-any */

import { apliiqFetch } from "../_shared/apliiq.ts";
import { cjConfigured, getCjToken, cjGet, cjPost, summarizeStock } from "../_shared/cj.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, content-type",
};

const APLIIQ_APP_ID = Deno.env.get("APLIIQ_APP_ID") || "";
const APLIIQ_SHARED_SECRET = Deno.env.get("APLIIQ_SHARED_SECRET") || "";
// Safety switch: only auto-submit Apliiq once creds are verified live.
const APLIIQ_AUTO = (Deno.env.get("APLIIQ_AUTO") || "").toLowerCase() === "true";
const ZENDROP_API_KEY = Deno.env.get("ZENDROP_API_KEY") || "";
const ZENDROP_BASE = Deno.env.get("ZENDROP_API_BASE") || "https://api.zendrop.com";
const ZENDROP_AUTO = (Deno.env.get("ZENDROP_AUTO") || "").toLowerCase() === "true";
// CJ auto-submit is opt-in like the others; the stock precheck always runs.
const CJ_AUTO = (Deno.env.get("CJ_AUTO") || "").toLowerCase() === "true";
const CJ_LOGISTIC = Deno.env.get("CJ_LOGISTIC_NAME") || "CJPacket Ordinary";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const PRINTFUL_API_KEY = Deno.env.get("PRINTFUL_API_KEY") || "";
const PRINTFUL_STORE_ID = Deno.env.get("PRINTFUL_STORE_ID") || "";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

interface Recipient {
  name: string;
  email?: string;
  phone?: string;
  address1: string;
  address2?: string;
  city: string;
  state_code?: string;
  country_code: string;
  zip: string;
}

async function getOrder(orderId: string): Promise<any | null> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/orders?id=eq.${orderId}&select=id,status,metadata`,
    { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } },
  );
  if (!res.ok) return null;
  const rows = await res.json();
  return Array.isArray(rows) && rows.length ? rows[0] : null;
}

async function patchOrder(orderId: string, patch: any): Promise<void> {
  await fetch(`${SUPABASE_URL}/rest/v1/orders?id=eq.${orderId}`, {
    method: "PATCH",
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify(patch),
  });
}

async function submitPrintful(
  externalId: string,
  recipient: Recipient,
  items: any[],
): Promise<any> {
  if (!PRINTFUL_API_KEY) {
    return { provider: "printful", ok: false, skipped: true, error: "PRINTFUL_API_KEY not set", items: items.length };
  }
  const pfItems = items
    .map((i) => {
      const id = Number(i.external_sku);
      if (!Number.isFinite(id) || id <= 0) return null;
      return { sync_variant_id: id, quantity: i.quantity };
    })
    .filter(Boolean);
  if (pfItems.length === 0) {
    return { provider: "printful", ok: false, error: "No valid sync_variant_id on items", items: items.length };
  }
  const headers: Record<string, string> = {
    Authorization: `Bearer ${PRINTFUL_API_KEY}`,
    "Content-Type": "application/json",
  };
  if (PRINTFUL_STORE_ID) headers["X-PF-Store-Id"] = PRINTFUL_STORE_ID;
  try {
    const res = await fetch("https://api.printful.com/orders?confirm=true", {
      method: "POST",
      headers,
      body: JSON.stringify({
        external_id: externalId,
        recipient: {
          name: recipient.name,
          address1: recipient.address1,
          address2: recipient.address2 || undefined,
          city: recipient.city,
          state_code: recipient.state_code || undefined,
          country_code: recipient.country_code,
          zip: recipient.zip,
          email: recipient.email || undefined,
          phone: recipient.phone || undefined,
        },
        items: pfItems,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { provider: "printful", ok: false, error: `Printful ${res.status}: ${data?.error?.message || data?.result || res.statusText}`, items: items.length };
    }
    return { provider: "printful", ok: true, ref: String(data?.result?.id ?? ""), items: items.length };
  } catch (e: any) {
    return { provider: "printful", ok: false, error: `Printful request failed: ${e.message}`, items: items.length };
  }
}

// Apliiq order submission via the signed (HMAC-SHA256) client. Guarded by
// APLIIQ_AUTO so a real paid order isn't fired blind before creds are
// verified live; until then it records "flagged for manual".
async function submitApliiq(externalId: string, recipient: Recipient, items: any[]): Promise<any> {
  if (!APLIIQ_AUTO || !APLIIQ_APP_ID || !APLIIQ_SHARED_SECRET) {
    return { provider: "apliiq", ok: false, skipped: true, error: "Apliiq auto-fulfillment disabled (set APLIIQ_AUTO=true + creds)", items: items.length };
  }
  const lineItems = items
    .map((i) => {
      const id = String(i.external_sku || "");
      return id ? { variantId: id, quantity: i.quantity } : null;
    })
    .filter(Boolean);
  if (lineItems.length === 0) {
    return { provider: "apliiq", ok: false, error: "No valid Apliiq variantId on items", items: items.length };
  }
  const res = await apliiqFetch(APLIIQ_APP_ID, APLIIQ_SHARED_SECRET, {
    method: "POST",
    path: "/v1/Order",
    body: {
      externalId,
      shippingAddress: {
        name: recipient.name, address1: recipient.address1, address2: recipient.address2 || undefined,
        city: recipient.city, state: recipient.state_code || undefined,
        country: recipient.country_code, zip: recipient.zip,
        email: recipient.email || undefined, phone: recipient.phone || undefined,
      },
      lineItems,
    },
  });
  if (!res.ok) return { provider: "apliiq", ok: false, error: `Apliiq ${res.status}: ${JSON.stringify(res.data).slice(0, 300)}`, items: items.length };
  return { provider: "apliiq", ok: true, ref: String(res.data?.id ?? res.data?.orderId ?? ""), items: items.length };
}

// Zendrop order submission (Bearer auth). Guarded by ZENDROP_AUTO.
async function submitZendrop(externalId: string, recipient: Recipient, items: any[]): Promise<any> {
  if (!ZENDROP_AUTO || !ZENDROP_API_KEY) {
    return { provider: "zendrop", ok: false, skipped: true, error: "Zendrop auto-fulfillment disabled (set ZENDROP_AUTO=true + key)", items: items.length };
  }
  const lineItems = items
    .map((i) => (i.external_sku ? { variant_id: String(i.external_sku), quantity: i.quantity } : null))
    .filter(Boolean);
  if (lineItems.length === 0) {
    return { provider: "zendrop", ok: false, error: "No valid Zendrop variant_id on items", items: items.length };
  }
  try {
    const res = await fetch(`${ZENDROP_BASE}/v1/orders`, {
      method: "POST",
      headers: { Authorization: `Bearer ${ZENDROP_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        external_id: externalId,
        shipping_address: {
          name: recipient.name, address1: recipient.address1, address2: recipient.address2 || undefined,
          city: recipient.city, province: recipient.state_code || undefined,
          country: recipient.country_code, zip: recipient.zip,
          email: recipient.email || undefined, phone: recipient.phone || undefined,
        },
        line_items: lineItems,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { provider: "zendrop", ok: false, error: `Zendrop ${res.status}: ${JSON.stringify(data).slice(0, 300)}`, items: items.length };
    return { provider: "zendrop", ok: true, ref: String(data?.id ?? data?.order_id ?? ""), items: items.length };
  } catch (e: any) {
    return { provider: "zendrop", ok: false, error: `Zendrop request failed: ${e.message}`, items: items.length };
  }
}

// Discord alert so a stuck CJ order never fails silently.
async function alertDiscord(title: string, message: string, level = "error"): Promise<void> {
  await fetch(`${SUPABASE_URL}/functions/v1/discord-notify`, {
    method: "POST",
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ title, message, level, source: "fulfill-order" }),
  }).catch(() => {});
}

// CJ Dropshipping: LIVE stock check first (order-time oversell gate), then
// createOrderV2 when CJ_AUTO=true. A failed check stops the CJ sub-order and
// pings Discord; the paid order is preserved in metadata for manual handling.
async function submitCJ(externalId: string, recipient: Recipient, items: any[]): Promise<any> {
  if (!cjConfigured()) {
    return { provider: "cj", ok: false, skipped: true, error: "CJ_EMAIL / CJ_API_KEY not set", items: items.length };
  }
  const lines = items
    .map((i) => ({ vid: String(i.external_sku || ""), quantity: Math.max(1, Number(i.quantity) || 1) }))
    .filter((l) => l.vid);
  if (lines.length === 0) {
    return { provider: "cj", ok: false, error: "No valid CJ vid on items", items: items.length };
  }

  let token: string;
  try { token = await getCjToken(); } catch (e: any) {
    return { provider: "cj", ok: false, error: `CJ auth failed: ${e.message}`, items: items.length };
  }

  // Order-time stock gate: every line must have live sellable stock ≥ qty.
  const shortages: string[] = [];
  const stockByVid: Record<string, number> = {};
  for (const l of lines) {
    try {
      const rows = await cjGet(token, `product/stock/queryByVid?vid=${encodeURIComponent(l.vid)}`);
      const s = summarizeStock(Array.isArray(rows) ? rows : []);
      stockByVid[l.vid] = s.total;
      if (s.total < l.quantity) shortages.push(`${l.vid}: need ${l.quantity}, CJ has ${s.total}`);
      await new Promise((r) => setTimeout(r, 1100)); // stock endpoint QPS is 1/s
    } catch (e: any) {
      shortages.push(`${l.vid}: stock check failed (${e.message})`);
    }
  }
  if (shortages.length) {
    await alertDiscord(
      "🛑 CJ order blocked — stock",
      `Order ${externalId}: ${shortages.join("; ")}. Held for manual handling.`,
    );
    return { provider: "cj", ok: false, error: `Insufficient CJ stock: ${shortages.join("; ")}`, stock: stockByVid, items: items.length };
  }

  if (!CJ_AUTO) {
    return { provider: "cj", ok: false, skipped: true, stock: stockByVid, error: "CJ auto-fulfillment disabled (set CJ_AUTO=true); stock verified", items: items.length };
  }

  try {
    const data = await cjPost(token, "shopping/order/createOrderV2", {
      orderNumber: externalId,
      shippingCountryCode: recipient.country_code,
      shippingProvince: recipient.state_code || "",
      shippingCity: recipient.city,
      shippingAddress: [recipient.address1, recipient.address2].filter(Boolean).join(", "),
      shippingCustomerName: recipient.name,
      shippingZip: recipient.zip,
      shippingPhone: recipient.phone || "",
      email: recipient.email || undefined,
      remark: "Luveni storefront order",
      logisticName: CJ_LOGISTIC,
      fromCountryCode: "CN",
      products: lines,
    });
    const ref = String(data?.orderId ?? data ?? "");
    return { provider: "cj", ok: true, ref, stock: stockByVid, items: items.length };
  } catch (e: any) {
    await alertDiscord("🛑 CJ order submission failed", `Order ${externalId}: ${e.message}`);
    return { provider: "cj", ok: false, error: e.message, stock: stockByVid, items: items.length };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // Server-to-server auth: require the service-role key.
  const auth = req.headers.get("Authorization") || req.headers.get("authorization") || "";
  if (auth !== `Bearer ${SERVICE_KEY}` || !SERVICE_KEY) {
    return json({ error: "Unauthorized" }, 401);
  }

  try {
    const { orderId, recipient } = await req.json();
    if (!orderId || !recipient) return json({ error: "orderId and recipient are required" }, 400);

    const order = await getOrder(orderId);
    if (!order) return json({ error: "Order not found" }, 404);

    const metadata = order.metadata ?? {};
    if (metadata.fulfillment) {
      return json({ ok: true, duplicate: true, message: "Already fulfilled" });
    }

    const items: any[] = Array.isArray(metadata.items) ? metadata.items : [];
    if (items.length === 0) return json({ error: "Order has no line items to fulfill" }, 400);

    // Group by provider.
    const groups: Record<string, any[]> = {};
    for (const it of items) {
      const provider = (it.fulfillment_provider || "").toLowerCase();
      if (!provider) continue;
      (groups[provider] ||= []).push(it);
    }

    const results: any[] = [];
    for (const [provider, groupItems] of Object.entries(groups)) {
      if (provider === "printful") results.push(await submitPrintful(orderId, recipient, groupItems));
      else if (provider === "apliq" || provider === "apliiq") results.push(await submitApliiq(orderId, recipient, groupItems));
      else if (provider === "zendrop") results.push(await submitZendrop(orderId, recipient, groupItems));
      else if (provider === "cj") results.push(await submitCJ(orderId, recipient, groupItems));
      else results.push({ provider, ok: false, skipped: true, error: `Unknown provider "${provider}"`, items: groupItems.length });
    }

    await patchOrder(orderId, {
      metadata: { ...metadata, fulfillment: { submitted_at: new Date().toISOString(), results } },
    });

    const problems = results.filter((r) => !r.ok);
    return json({ ok: problems.length === 0, results });
  } catch (e: any) {
    return json({ error: `Fulfillment exception: ${e.message}` }, 500);
  }
});
