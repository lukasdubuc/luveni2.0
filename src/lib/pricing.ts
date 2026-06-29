// ─────────────────────────────────────────────────────────────
//  Luveni — retail pricing calculator
//  Turns a manufacturer's live blank cost into a studio retail price:
//      cost  →  margin  →  retail
//  Margin is the share of the retail price that is profit, so
//      retail = cost / (1 - margin)
//  Retail is then rounded up to a clean ".99" charm-price ending.
// ─────────────────────────────────────────────────────────────

// Default gross margin target for studio blanks (60%).
export const DEFAULT_MARGIN = 0.6;

// Round a cents value up to the next whole-dollar ".99" ending
// (e.g. 2310 → 2399, 2400 → 2499). Keeps storefront prices tidy.
function toCharmPrice(cents: number): number {
  if (cents <= 0) return 0;
  const dollars = Math.ceil((cents - 99) / 100);
  return dollars * 100 + 99;
}

// cost (cents) + margin (0–1) → retail price (cents), charm-rounded.
export function computeRetailCents(costCents: number, margin: number = DEFAULT_MARGIN): number {
  if (!costCents || costCents <= 0) return 0;
  const m = Math.min(Math.max(margin, 0), 0.95); // guard against /0 and negatives
  const raw = costCents / (1 - m);
  return toCharmPrice(Math.round(raw));
}

// The realized margin for a given cost/retail pair (0–1). Useful for display.
export function realizedMargin(costCents: number, retailCents: number): number {
  if (!retailCents || retailCents <= 0) return 0;
  return Math.max(0, (retailCents - costCents) / retailCents);
}
