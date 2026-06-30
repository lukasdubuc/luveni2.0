// ─────────────────────────────────────────────────────────────
//  Luveni GM — shared product importer (Deno)
//  Persists a normalized product from ANY vendor into the curation
//  buffer: upserts products, stores raw_payload + media (all views per
//  variant), and seeds draft channel rows. Nothing auto-publishes.
// ─────────────────────────────────────────────────────────────

/* eslint-disable @typescript-eslint/no-explicit-any */

import { SUPABASE_URL, SERVICE_KEY } from "./http.ts";
import { parseManufacturerMedia, VendorSource } from "./media-pipeline.ts";

const svc = () => ({ apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` });

export interface ImportableProduct {
  externalId: string;
  title: string;
  slug: string;
  description?: string;
  priceCents: number;
  imageUrls: string[];
  variants: any[];
  /** Raw vendor JSON used by parseManufacturerMedia + stored for curation. */
  payload: any;
}

export interface ImportResult { ok: boolean; productId?: string; error?: string }

/** Upsert one imported product into the curation buffer (draft, never live channels). */
export async function persistImportedProduct(
  source: VendorSource,
  p: ImportableProduct,
): Promise<ImportResult> {
  // Preserve an admin's prior publish/draft choice for this product.
  const existing = await fetch(
    `${SUPABASE_URL}/rest/v1/products?select=id,is_published&source=eq.${source}&external_product_id=eq.${encodeURIComponent(p.externalId)}&limit=1`,
    { headers: svc() },
  ).then((r) => (r.ok ? r.json() : [])).catch(() => []);
  const prior = Array.isArray(existing) && existing[0];
  // New imports default to UNPUBLISHED (curation buffer); existing keep choice.
  const isPublished = prior ? !!prior.is_published : false;

  const up = await fetch(
    `${SUPABASE_URL}/rest/v1/products?on_conflict=source,external_product_id`,
    {
      method: "POST",
      headers: { ...svc(), "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify({
        title: p.title,
        slug: p.slug,
        description: p.description ?? p.title,
        price_cents: p.priceCents,
        image_urls: p.imageUrls,
        is_archived: false,
        is_published: isPublished,
        source,
        external_product_id: p.externalId,
        raw_payload: p.payload,
        variants: p.variants.length ? p.variants : null,
        updated_at: new Date().toISOString(),
      }),
    },
  );
  if (!up.ok) return { ok: false, error: `upsert ${up.status}: ${await up.text().catch(() => "")}` };
  const rows = await up.json().catch(() => []);
  const productId: string | undefined = rows?.[0]?.id;
  if (!productId) return { ok: false, error: "no product id returned" };

  // Media — every view, per variant.
  const media = parseManufacturerMedia(source, p.payload);
  if (media.length) {
    await fetch(`${SUPABASE_URL}/rest/v1/product_media?on_conflict=product_id,variant_key,url`, {
      method: "POST",
      headers: { ...svc(), "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify(media.map((m) => ({
        product_id: productId, variant_key: m.variantKey, view_type: m.viewType,
        url: m.url, is_primary: m.isPrimary, is_transparent: m.isTransparent,
        position: m.position, source, metadata: m.metadata,
      }))),
    }).catch(() => {});
  }

  // Seed draft channel rows (no auto-sync).
  await fetch(`${SUPABASE_URL}/rest/v1/channel_publications?on_conflict=product_id,channel`, {
    method: "POST",
    headers: { ...svc(), "Content-Type": "application/json", Prefer: "resolution=ignore-duplicates,return=minimal" },
    body: JSON.stringify(["tiktok", "etsy"].map((channel) => ({ product_id: productId, channel, status: "draft" }))),
  }).catch(() => {});

  return { ok: true, productId };
}

export function slugify(s: string): string {
  return (s || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
