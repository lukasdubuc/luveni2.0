// ─────────────────────────────────────────────────────────────
//  Luveni — supplier capabilities
//
//  Which suppliers ship product photos that need background removal.
//  Printful (and other print-on-demand vendors) already deliver clean
//  transparent PNG mockups, so treating them is wasted work and can only
//  degrade a good image. Dropshipping vendors (CJ) ship opaque studio
//  JPGs that DO need it.
//
//  To enable transparency for a new supplier later, add its `source`
//  value here — nothing else changes.
// ─────────────────────────────────────────────────────────────

/** `products.source` values whose imagery must be background-removed. */
export const TRANSPARENCY_SUPPLIERS: readonly string[] = ["cj"];

/** True when a product's supplier ships imagery that needs transparency. */
export function supplierNeedsTransparency(source: string | null | undefined): boolean {
  if (!source) return false;
  return TRANSPARENCY_SUPPLIERS.includes(source.trim().toLowerCase());
}
