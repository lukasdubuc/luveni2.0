// ─────────────────────────────────────────────────────────────
//  Luveni GM — Supplier fulfillment (server-only)
//  Submits paid orders to the right print-on-demand supplier in
//  real time. Each line item carries its own `fulfillment_provider`
//  (set when products are synced), so a single order can be split
//  across Printful and Apliiq automatically.
//
//  Design rules:
//   • Idempotent — never submit the same order twice.
//   • Non-fatal — a supplier failure must never lose the sale. We
//     record the error on the order and alert, but the payment
//     still finalizes.
// ─────────────────────────────────────────────────────────────

export interface FulfillmentRecipient {
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

export interface FulfillmentItem {
  product_id?: string;
  title?: string;
  variant_sku?: string;
  // Supplier-side variant id (Printful sync_variant_id / Apliiq variant id).
  external_sku?: string;
  fulfillment_provider?: string; // "printful" | "apliq" | undefined
  quantity: number;
  price_cents?: number;
}

export interface SupplierResult {
  provider: string;
  ok: boolean;
  ref?: string; // supplier order id
  error?: string;
  skipped?: boolean; // true when provider not configured (needs manual action)
  items: number;
}

function mapRecipientForPrintful(r: FulfillmentRecipient) {
  return {
    name: r.name,
    address1: r.address1,
    address2: r.address2 || undefined,
    city: r.city,
    state_code: r.state_code || undefined,
    country_code: r.country_code,
    zip: r.zip,
    email: r.email || undefined,
    phone: r.phone || undefined,
  };
}

// ── Printful ──────────────────────────────────────────────────
// POST https://api.printful.com/orders
// items use sync_variant_id (the supplier id we store as external_sku
// during product sync). `confirm: true` submits straight to production.
async function submitPrintfulOrder(
  externalId: string,
  recipient: FulfillmentRecipient,
  items: FulfillmentItem[],
): Promise<SupplierResult> {
  const result: SupplierResult = { provider: "printful", ok: false, items: items.length };

  const apiKey = process.env.PRINTFUL_API_KEY;
  if (!apiKey) {
    result.skipped = true;
    result.error = "PRINTFUL_API_KEY not set";
    return result;
  }

  const printfulItems = items
    .map((i) => {
      const id = Number(i.external_sku);
      if (!Number.isFinite(id) || id <= 0) return null;
      return { sync_variant_id: id, quantity: i.quantity };
    })
    .filter(Boolean);

  if (printfulItems.length === 0) {
    result.error = "No valid Printful sync_variant_id on items";
    return result;
  }

  const storeId = process.env.PRINTFUL_STORE_ID;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };
  if (storeId) headers["X-PF-Store-Id"] = storeId;

  try {
    const res = await fetch("https://api.printful.com/orders?confirm=true", {
      method: "POST",
      headers,
      body: JSON.stringify({
        external_id: externalId,
        recipient: mapRecipientForPrintful(recipient),
        items: printfulItems,
      }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      result.error = `Printful ${res.status}: ${json?.error?.message || json?.result || res.statusText}`;
      return result;
    }
    result.ok = true;
    result.ref = String(json?.result?.id ?? "");
    return result;
  } catch (e: any) {
    result.error = `Printful request failed: ${e?.message || String(e)}`;
    return result;
  }
}

// ── Apliiq ────────────────────────────────────────────────────
// Apliiq's order API uses HMAC request signing. Until the app
// credentials and exact signing scheme are verified against the
// live account, we do NOT fire blind order calls on real payments.
// Instead we record the order as needing Apliiq fulfillment and let
// the caller alert, so nothing is ever silently dropped.
//
// When ready: set APLIIQ_APP_ID + APLIIQ_SHARED_SECRET, implement the
// signed POST here, and flip APLIIQ_AUTO=true.
async function submitApliiqOrder(
  externalId: string,
  _recipient: FulfillmentRecipient,
  items: FulfillmentItem[],
): Promise<SupplierResult> {
  const result: SupplierResult = { provider: "apliq", ok: false, items: items.length };

  const enabled = process.env.APLIIQ_AUTO === "true";
  const appId = process.env.APLIIQ_APP_ID;
  const secret = process.env.APLIIQ_SHARED_SECRET;

  if (!enabled || !appId || !secret) {
    result.skipped = true;
    result.error =
      "Apliiq auto-fulfillment not configured (needs APLIIQ_APP_ID, APLIIQ_SHARED_SECRET, APLIIQ_AUTO=true) — flagged for manual fulfillment";
    return result;
  }

  // NOTE: HMAC-signed POST to the Apliiq order endpoint goes here once
  // the signing scheme is confirmed. Intentionally left unimplemented
  // rather than guessed, to avoid mishandling a paid order.
  result.skipped = true;
  result.error = `Apliiq signed submission not yet implemented for order ${externalId} (${items.length} item[s])`;
  return result;
}

/**
 * Route a paid order's items to their suppliers. Returns one result per
 * provider involved. Pure function over its inputs — the caller persists
 * results and decides on alerts.
 */
export async function fulfillOrder(
  orderId: string,
  recipient: FulfillmentRecipient,
  items: FulfillmentItem[],
): Promise<SupplierResult[]> {
  const byProvider = new Map<string, FulfillmentItem[]>();
  for (const item of items) {
    const provider = (item.fulfillment_provider || "").toLowerCase();
    if (!provider) continue; // non-POD / manual items are skipped
    if (!byProvider.has(provider)) byProvider.set(provider, []);
    byProvider.get(provider)!.push(item);
  }

  const results: SupplierResult[] = [];
  for (const [provider, providerItems] of byProvider) {
    if (provider === "printful") {
      results.push(await submitPrintfulOrder(orderId, recipient, providerItems));
    } else if (provider === "apliq" || provider === "apliiq") {
      results.push(await submitApliiqOrder(orderId, recipient, providerItems));
    } else {
      results.push({
        provider,
        ok: false,
        skipped: true,
        error: `Unknown fulfillment provider "${provider}"`,
        items: providerItems.length,
      });
    }
  }
  return results;
}
