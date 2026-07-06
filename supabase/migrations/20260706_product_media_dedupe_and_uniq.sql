-- ─────────────────────────────────────────────────────────────
--  product_media hygiene: dedupe + real uniqueness.
--
--  The original unique(product_id, variant_key, url) never fires for
--  product-level rows because variant_key is NULL and NULLs are distinct,
--  so every catalog sync re-inserted the same rows. Storefront galleries
--  then showed look-alike duplicates and stale primaries.
--
--  Applied to production 2026-07-06 alongside a one-time data repair
--  (dedupe, variant rows stripped of is_primary, CJ image_urls rewritten
--  to the visible transparent gallery). This file keeps the schema part
--  reproducible. Idempotent.
-- ─────────────────────────────────────────────────────────────

-- Dedupe (keep curated/oldest row of each identical set).
delete from public.product_media a using public.product_media b
where a.product_id = b.product_id
  and a.url = b.url
  and a.variant_key is not distinct from b.variant_key
  and a.ctid > b.ctid
  and not (a.hidden and not b.hidden);

delete from public.product_media a using public.product_media b
where a.product_id = b.product_id
  and a.url = b.url
  and a.variant_key is not distinct from b.variant_key
  and a.ctid > b.ctid;

-- Primary is product-level only.
update public.product_media set is_primary = false
where variant_key is not null and is_primary;

-- NULLS NOT DISTINCT so product-level rows are actually unique (PG15+).
alter table public.product_media
  drop constraint if exists product_media_product_id_variant_key_url_key;
do $$
begin
  alter table public.product_media
    add constraint product_media_product_variant_url_uniq
    unique nulls not distinct (product_id, variant_key, url);
exception when duplicate_table or duplicate_object then null;
end $$;
