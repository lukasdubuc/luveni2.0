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

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, content-type",
};

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

// Apliiq order submission uses HMAC signing. Until creds + scheme are
// verified live, flag for manual fulfillment rather than fire blind on a
// real paid order. Enable by setting APLIIQ_AUTO=true once implemented.
function submitApliiq(items: any[]): any {
  return {
    provider: "apliq",
    ok: false,
    skipped: true,
    error: "Apliiq auto-fulfillment not yet enabled — flagged for manual",
    items: items.length,
  };
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
      else if (provider === "apliq" || provider === "apliiq") results.push(submitApliiq(groupItems));
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
