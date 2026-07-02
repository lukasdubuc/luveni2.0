// ─────────────────────────────────────────────────────────────
//  Luveni GM — shared retail pricing engine (Deno)
//
//  Single source of truth for cost → retail. Parameters live in the
//  pricing_rules table (per-category shipping, minimum after-fee profit,
//  target margin, fee rate) so Orion/Astra can tune them without a deploy.
//
//      floor_fees   = (cost + ship_first + min_profit) / (1 - fee_rate)
//      floor_margin = cost / (1 - target_margin)
//      retail       = charm( max(floor_fees, floor_margin) )
//
//  fee_rate covers payment processing + marketplace referral, so
//  min_profit_cents is profit AFTER fees and shipping — the "maximum
//  profit while realistic" guarantee.
//
//  Also home of formatTitle(): vendor titles (CJ especially) arrive as
//  keyword soup — normalize to clean, capped, Title-Case storefront names.
// ─────────────────────────────────────────────────────────────

/* eslint-disable @typescript-eslint/no-explicit-any */

import { SUPABASE_URL, SERVICE_KEY } from "./http.ts";

export interface PricingRule {
  key: string;
  category: string;
  match_keywords: string[];
  ship_first_cents: number;
  ship_addl_cents: number;
  min_profit_cents: number;
  target_margin: number;
  fee_rate: number;
}

const svc = () => ({ apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` });

let rulesCache: { rules: PricingRule[]; at: number } | null = null;

export async function loadPricingRules(): Promise<PricingRule[]> {
  if (rulesCache && Date.now() - rulesCache.at < 60_000) return rulesCache.rules;
  const res = await fetch(`${SUPABASE_URL}/rest/v1/pricing_rules?active=eq.true&select=*`, { headers: svc() });
  const rules: PricingRule[] = res.ok ? await res.json().catch(() => []) : [];
  if (rules.length) rulesCache = { rules, at: Date.now() };
  return rules;
}

/** Longest-keyword match wins; falls back to the 'default' rule. */
export function matchRule(title: string, rules: PricingRule[], categoryKey?: string | null): PricingRule {
  if (categoryKey) {
    const exact = rules.find((r) => r.key === categoryKey);
    if (exact) return exact;
  }
  const t = (title || "").toLowerCase();
  let best: PricingRule | null = null;
  let bestLen = 0;
  for (const r of rules) {
    for (const kw of r.match_keywords ?? []) {
      if (kw && t.includes(kw.toLowerCase()) && kw.length > bestLen) { best = r; bestLen = kw.length; }
    }
  }
  return best ?? rules.find((r) => r.key === "default") ?? {
    key: "default", category: "Default", match_keywords: [],
    ship_first_cents: 600, ship_addl_cents: 300, min_profit_cents: 800,
    target_margin: 0.55, fee_rate: 0.09,
  };
}

/** Round UP to the next ".99" ending (2310 → 2399, 2400 → 2499). */
export function charmPrice(cents: number): number {
  if (cents <= 0) return 0;
  return Math.ceil((cents - 99) / 100) * 100 + 99;
}

export interface PriceBreakdown {
  cost_cents: number;
  ship_first_cents: number;
  retail_cents: number;
  floor_fees_cents: number;
  floor_margin_cents: number;
  fees_cents: number;
  profit_cents: number;
  margin: number;
  rule: string;
}

export function computeRetail(costCents: number, rule: PricingRule): PriceBreakdown {
  const cost = Math.max(0, Math.round(costCents));
  const floorFees = (cost + rule.ship_first_cents + rule.min_profit_cents) / (1 - rule.fee_rate);
  const floorMargin = cost / (1 - rule.target_margin);
  const retail = charmPrice(Math.round(Math.max(floorFees, floorMargin)));
  const fees = Math.round(retail * rule.fee_rate);
  const profit = retail - fees - cost - rule.ship_first_cents;
  return {
    cost_cents: cost,
    ship_first_cents: rule.ship_first_cents,
    retail_cents: retail,
    floor_fees_cents: Math.round(floorFees),
    floor_margin_cents: Math.round(floorMargin),
    fees_cents: fees,
    profit_cents: profit,
    margin: retail ? (retail - cost) / retail : 0,
    rule: rule.key,
  };
}

// ── Title formatting ─────────────────────────────────────────

const SMALL_WORDS = new Set(["a", "an", "and", "as", "at", "but", "by", "for", "in", "of", "on", "or", "the", "to", "with"]);

/** Vendor keyword-soup → clean storefront name.
 *  "2023 New Men's Hip Hop Retro Washed T-shirt Street..." → "Men's Hip Hop Retro Washed T-Shirt" */
export function formatTitle(raw: string, maxLen = 70): string {
  let t = String(raw ?? "")
    .replace(/[\[\(【（][^\]\)】）]*[\]\)】）]/g, " ")       // bracketed vendor junk
    .replace(/\b(19|20)\d{2}\b/g, " ")                        // years
    .replace(/\b(new|hot|sale|wholesale|dropshipping|drop\s*shipping|free\s*shipping|in\s*stock|high\s*quality|fashion(?:able)?|cross[- ]?border|amazon|ebay|wish|aliexpress)\b/gi, " ")
    .replace(/[|_/\\]+/g, " ")
    .replace(/\s*,\s*/g, ", ")
    .replace(/\s{2,}/g, " ")
    .trim()
    .replace(/^[,\-–—\s]+|[,\-–—\s]+$/g, "");
  if (!t) t = String(raw ?? "").trim();

  // Cut at a word boundary if too long.
  if (t.length > maxLen) {
    const cut = t.slice(0, maxLen);
    t = cut.slice(0, Math.max(cut.lastIndexOf(" "), 30)).replace(/[,\-–—\s]+$/g, "");
  }

  // Title Case (keep small words lowercase mid-title; fix T-Shirt style).
  const words = t.toLowerCase().split(" ").map((w, i) => {
    if (i > 0 && SMALL_WORDS.has(w)) return w;
    return w.split("-").map((p) => (p ? p[0].toUpperCase() + p.slice(1) : p)).join("-");
  });
  return words.join(" ").replace(/\bT-shirt\b/g, "T-Shirt");
}
