-- ─────────────────────────────────────────────────────────────
--  Luveni GM — per-photo curation for product_media
--
--  The transparency pipeline auto-decides which images are "good". Real
--  vendor imagery (CJ especially) ships near-identical shots and photos
--  that don't cut out cleanly, so the admin needs a manual override to
--  hide/show individual photos without deleting the row (re-imports and
--  re-processing must not resurrect a photo the owner deliberately hid).
--
--    • hidden      → admin unchecked this photo; storefront never shows it,
--                    regardless of quality/transparency grading.
--    • curated     → admin has reviewed this product's gallery at least once
--                    (drives the "needs review" badge in the admin panel).
--
--  Additive + idempotent. No drops, no data loss.
-- ─────────────────────────────────────────────────────────────

alter table public.product_media
  add column if not exists hidden boolean not null default false,
  add column if not exists curated boolean not null default false;

comment on column public.product_media.hidden is
  'Admin manually hid this photo. Storefront must never show it, overriding quality/transparency grading.';
comment on column public.product_media.curated is
  'Admin has reviewed this photo in the product gallery curator at least once.';

-- Storefront reads (offer gallery, shop modal) filter on hidden constantly.
create index if not exists product_media_visible_idx
  on public.product_media (product_id)
  where hidden = false;
