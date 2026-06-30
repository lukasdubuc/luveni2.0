// ─────────────────────────────────────────────────────────────
//  Luveni GM — Multi-vendor media pipeline & fulfillment routing
//
//  Pure, dependency-free utilities shared by edge functions (Deno) and
//  the React app. They solve four concrete backlog gaps:
//
//   1. parseManufacturerMedia()  — retrieve the FULL array of mockup views
//      (front/back/side/model/lifestyle) for every variant from Printful,
//      Apliiq, or Zendrop payloads. Fixes the "only the primary photo
//      survives publishing" bug.
//   2. selectTikTokImages()      — map media into TikTok Shop's 9-image
//      cap: 1 primary per variant for multi-variant items, otherwise fill
//      the slots with secondary/flat/lifestyle views.
//   3. applyInventoryBuffer()    — print-on-demand oversell dampener.
//   4. splitCartByVendor()       — split a multi-vendor cart so each
//      manufacturer gets its own sub-order at checkout.
//
//  No imports on purpose: this file must run unchanged in Deno edge
//  functions and in the Vite/React bundle.
// ─────────────────────────────────────────────────────────────

export type VendorSource = "printful" | "apliiq" | "zendrop" | "manual";

export type MediaViewType =
  | "front_flat"
  | "back_flat"
  | "side_flat"
  | "sleeve"
  | "model"
  | "lifestyle"
  | "detail"
  | "other";

export interface NormalizedMedia {
  /** Variant this asset belongs to. `null` = product-wide (generic lifestyle). */
  variantKey: string | null;
  viewType: MediaViewType;
  url: string;
  /** The single flat transparent mockup used on the Yeezy-style grid. */
  isPrimary: boolean;
  isTransparent: boolean;
  /** Order within (product, variant) for carousel sequencing. */
  position: number;
  source: VendorSource;
  metadata: Record<string, unknown>;
}

// ── View classification ────────────────────────────────────────
// Manufacturers label assets inconsistently. We classify from the file
// "type"/placement plus any hints in the URL/title.
const VIEW_RULES: Array<{ type: MediaViewType; re: RegExp }> = [
  { type: "back_flat", re: /\b(back|rear)\b/i },
  { type: "side_flat", re: /\b(side|left|right|profile)\b/i },
  { type: "sleeve", re: /\b(sleeve|cuff|arm)\b/i },
  { type: "model", re: /\b(model|on[-_ ]?body|worn|lifestyle[-_ ]?model|person)\b/i },
  { type: "lifestyle", re: /\b(lifestyle|scene|context|flat[-_ ]?lay|flatlay)\b/i },
  { type: "detail", re: /\b(detail|closeup|close[-_ ]?up|zoom|label|tag)\b/i },
  { type: "front_flat", re: /\b(front|default|preview|main|primary|flat)\b/i },
];

function classifyView(...hints: Array<string | null | undefined>): MediaViewType {
  const hay = hints.filter(Boolean).join(" ");
  for (const rule of VIEW_RULES) {
    if (rule.re.test(hay)) return rule.type;
  }
  return "other";
}

// Transparent-background mockups are the grid-eligible flat shots. POD
// providers mark these on the file type or as PNG previews; lifestyle/model
// shots are JPG composites with backgrounds.
function looksTransparent(...hints: Array<string | null | undefined>): boolean {
  const hay = hints.filter(Boolean).join(" ").toLowerCase();
  if (/\b(model|lifestyle|scene|on[-_ ]?body|worn)\b/.test(hay)) return false;
  return /\.png(\?|$)|transparent|flat|preview|default|front/.test(hay);
}

const isHttp = (u: unknown): u is string =>
  typeof u === "string" && /^https?:\/\//i.test(u);

// ── Per-vendor extractors → unified NormalizedMedia[] ──────────
// Each returns assets for the WHOLE product across all variants. The
// caller persists them into product_media (one row per variant+url).

/* eslint-disable @typescript-eslint/no-explicit-any */

function parsePrintful(payload: any): NormalizedMedia[] {
  const out: NormalizedMedia[] = [];
  const variants: any[] = payload?.sync_variants ?? payload?.result?.sync_variants ?? [];
  for (const v of variants) {
    const variantKey = String(v?.sku ?? v?.id ?? "");
    const files: any[] = v?.files ?? [];
    let pos = 0;
    for (const f of files) {
      const url = f?.preview_url || f?.thumbnail_url || f?.url;
      if (!isHttp(url)) continue;
      // Printful file.type: 'preview' | 'default' | 'back' | 'front' | placement codes.
      const viewType = classifyView(f?.type, f?.placement, url);
      out.push({
        variantKey: variantKey || null,
        viewType,
        url,
        isPrimary: f?.type === "preview" || f?.is_default === true,
        isTransparent: looksTransparent(f?.type, url),
        position: pos++,
        source: "printful",
        metadata: { fileId: f?.id ?? null, type: f?.type ?? null },
      });
    }
  }
  return out;
}

function parseApliiq(payload: any): NormalizedMedia[] {
  const out: NormalizedMedia[] = [];
  // Apliiq returns product mockups grouped under `mockups`/`images` with a
  // `side` ('front'|'back') and a colour variant id.
  const items: any[] = payload?.mockups ?? payload?.images ?? payload?.result ?? [];
  const byVariant = new Map<string, number>();
  for (const m of items) {
    const url = m?.url || m?.image || m?.src;
    if (!isHttp(url)) continue;
    const variantKey = String(m?.variantId ?? m?.color ?? m?.colorId ?? "") || null;
    const k = variantKey ?? "_";
    const pos = byVariant.get(k) ?? 0;
    byVariant.set(k, pos + 1);
    out.push({
      variantKey,
      viewType: classifyView(m?.side, m?.view, m?.label, url),
      url,
      isPrimary: m?.isPrimary === true || m?.side === "front" || pos === 0,
      isTransparent: looksTransparent(m?.side, m?.type, url),
      position: pos,
      source: "apliiq",
      metadata: { side: m?.side ?? null, color: m?.color ?? null },
    });
  }
  return out;
}

function parseZendrop(payload: any): NormalizedMedia[] {
  const out: NormalizedMedia[] = [];
  // Zendrop products carry a product-level `images[]` plus per-variant
  // `variants[].image`. Product images are gallery/lifestyle; variant
  // images are the colour-specific shots.
  const productImages: any[] = payload?.images ?? payload?.product?.images ?? [];
  productImages.forEach((img: any, i: number) => {
    const url = typeof img === "string" ? img : img?.src || img?.url;
    if (!isHttp(url)) return;
    out.push({
      variantKey: null,
      viewType: classifyView(typeof img === "object" ? img?.alt : null, url),
      url,
      isPrimary: i === 0,
      isTransparent: looksTransparent(url),
      position: i,
      source: "zendrop",
      metadata: { alt: typeof img === "object" ? (img?.alt ?? null) : null },
    });
  });
  const variants: any[] = payload?.variants ?? payload?.product?.variants ?? [];
  for (const v of variants) {
    const url = v?.image?.src || v?.image || v?.image_url;
    if (!isHttp(url)) continue;
    out.push({
      variantKey: String(v?.id ?? v?.sku ?? v?.title ?? "") || null,
      viewType: classifyView(v?.title, url),
      url,
      isPrimary: false,
      isTransparent: looksTransparent(url),
      position: 0,
      source: "zendrop",
      metadata: { variantTitle: v?.title ?? null },
    });
  }
  return out;
}

/**
 * Normalize any supported manufacturer payload into the unified media
 * model. Deduplicates per (variantKey,url) — NOT globally — so a back
 * shot shared as a fallback isn't dropped from a variant that needs it.
 */
export function parseManufacturerMedia(
  source: VendorSource,
  payload: unknown,
): NormalizedMedia[] {
  let raw: NormalizedMedia[];
  switch (source) {
    case "printful": raw = parsePrintful(payload); break;
    case "apliiq": raw = parseApliiq(payload); break;
    case "zendrop": raw = parseZendrop(payload); break;
    default: raw = [];
  }
  const seen = new Set<string>();
  const deduped: NormalizedMedia[] = [];
  for (const m of raw) {
    const key = `${m.variantKey ?? "_"}::${m.url}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(m);
  }
  return deduped;
}

/* eslint-enable @typescript-eslint/no-explicit-any */

// ── TikTok Shop 9-image mapping ────────────────────────────────
export const TIKTOK_MAX_IMAGES = 9;

/**
 * Choose ≤9 images for a TikTok Shop listing.
 *  • Multi-variant products: one primary (transparent flat preferred) per
 *    variant, capped at 9 variants, so the colour grid renders correctly.
 *  • Single / low-variant products: fill the remaining slots with the best
 *    secondary views — flat angles first, then model/lifestyle/detail.
 * Returns ordered, de-duplicated URLs.
 */
export function selectTikTokImages(media: NormalizedMedia[]): string[] {
  if (media.length === 0) return [];

  const variantKeys = Array.from(
    new Set(media.filter((m) => m.variantKey).map((m) => m.variantKey as string)),
  );

  const pickPrimaryFor = (key: string | null): NormalizedMedia | undefined => {
    const pool = media.filter((m) => m.variantKey === key);
    return (
      pool.find((m) => m.isPrimary && m.isTransparent) ??
      pool.find((m) => m.isPrimary) ??
      pool.find((m) => m.isTransparent) ??
      pool[0]
    );
  };

  const chosen: string[] = [];
  const push = (url?: string) => {
    if (url && !chosen.includes(url) && chosen.length < TIKTOK_MAX_IMAGES) chosen.push(url);
  };

  // Multi-variant: 1 primary per variant (up to 9).
  if (variantKeys.length > 1) {
    for (const key of variantKeys.slice(0, TIKTOK_MAX_IMAGES)) {
      push(pickPrimaryFor(key)?.url);
    }
    // Spare slots → secondary views from the first variant.
    if (chosen.length < TIKTOK_MAX_IMAGES) {
      for (const m of rankSecondary(media)) push(m.url);
    }
    return chosen;
  }

  // Single / no variant: primary first, then ranked secondary views.
  push(pickPrimaryFor(variantKeys[0] ?? null)?.url);
  for (const m of rankSecondary(media)) push(m.url);
  return chosen;
}

// Secondary-view ranking for filling spare TikTok slots / modal carousels.
const VIEW_RANK: Record<MediaViewType, number> = {
  front_flat: 0, back_flat: 1, side_flat: 2, sleeve: 3,
  model: 4, lifestyle: 5, detail: 6, other: 7,
};

function rankSecondary(media: NormalizedMedia[]): NormalizedMedia[] {
  return [...media]
    .filter((m) => !m.isPrimary)
    .sort((a, b) => VIEW_RANK[a.viewType] - VIEW_RANK[b.viewType] || a.position - b.position);
}

// ── Inventory safety dampener ──────────────────────────────────
/**
 * Prevent overselling POD stock that syncs asynchronously.
 *   displayedStock = max(0, physicalStock - bufferQty)
 */
export function applyInventoryBuffer(physicalStock: number, bufferQty: number): number {
  const physical = Number.isFinite(physicalStock) ? Math.floor(physicalStock) : 0;
  const buffer = Number.isFinite(bufferQty) ? Math.max(0, Math.floor(bufferQty)) : 0;
  return Math.max(0, physical - buffer);
}

// ── Split-fulfillment routing ──────────────────────────────────
export interface RoutableCartItem {
  sku: string;
  quantity: number;
  /** Resolved manufacturer for this line. */
  source: VendorSource;
  /** The provider's own variant id used to place the sub-order. */
  externalSku?: string;
  [k: string]: unknown;
}

/**
 * Split a multi-vendor cart into per-manufacturer sub-orders so each
 * provider (Printful / Apliiq / Zendrop) receives only its own lines.
 * Items with an unknown/`manual` source are grouped under `manual` for
 * human handling rather than silently dropped.
 */
export function splitCartByVendor<T extends RoutableCartItem>(
  items: T[],
): Record<VendorSource, T[]> {
  const groups: Record<VendorSource, T[]> = {
    printful: [], apliiq: [], zendrop: [], manual: [],
  };
  for (const item of items) {
    const src: VendorSource =
      item.source && groups[item.source] ? item.source : "manual";
    groups[src].push(item);
  }
  return groups;
}
