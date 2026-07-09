-- ─────────────────────────────────────────────────────────────
-- Catalog hero fixes (run in Supabase SQL editor, project unitqfuetxedmmrvlocu)
--
-- Why this exists: two published products violate the "darkest colorway
-- leads / best image leads" rule, and the fix is DATA, not code:
--
--  A. Tooth Drill Hip-Hop Tee (b300a2fd-…): the good black-variant cutout
--     was manually hidden (NOT quality-gated) and a poor gallery cutout is
--     the hero. Fully determined — PART 1 below is safe to run as-is.
--
--  B. Distressed Sleeveless Vest (9d599b15-…): its CJ variants are named
--     "1Style/2Style/3Style" — no colour identity exists anywhere in the
--     data, so code can never rank the black one first. PART 2 renames the
--     styles to real colour names and promotes the black cutout, but FIRST
--     a human must confirm which style is which colour by looking at:
--       1Style: …/transparent-1783155521814-faysd0.png
--       2Style: …/transparent-1783155037272-ll65s1.png
--       3Style: …/transparent-1783151888889-gp3ii2.png
--     (base: https://unitqfuetxedmmrvlocu.supabase.co/storage/v1/object/
--      public/product-media/products/9d599b15-6e6c-4a0f-b64a-564134cc0e0e/)
--     Then edit the CASE mapping + hero URL below before running.
-- ─────────────────────────────────────────────────────────────

-- ── PART 1 — Tooth Drill Hip-Hop Tee (safe to run as-is) ──────────────────

-- Bring back the curated black-variant cutout as primary…
update product_media
set hidden = false, is_primary = true
where product_id = 'b300a2fd-79e4-4cc4-a67b-d7a96c68de38'
  and url like '%transparent-1783168115941-8h9ln6.png';

-- …and the white-variant cutout…
update product_media
set hidden = false
where product_id = 'b300a2fd-79e4-4cc4-a67b-d7a96c68de38'
  and url like '%transparent-1783170158611-h6bsti.png';

-- …hide the poor-quality current hero…
update product_media
set hidden = true, is_primary = false
where product_id = 'b300a2fd-79e4-4cc4-a67b-d7a96c68de38'
  and url like '%transparent-1783169260646-395crv.png';

-- …and make the catalog order lead with black, then white, then legacy.
update products
set image_urls = array[
  'https://unitqfuetxedmmrvlocu.supabase.co/storage/v1/object/public/product-media/products/b300a2fd-79e4-4cc4-a67b-d7a96c68de38/transparent-1783168115941-8h9ln6.png',
  'https://unitqfuetxedmmrvlocu.supabase.co/storage/v1/object/public/product-media/products/b300a2fd-79e4-4cc4-a67b-d7a96c68de38/transparent-1783170158611-h6bsti.png',
  'https://unitqfuetxedmmrvlocu.supabase.co/storage/v1/object/public/product-media/products/b300a2fd-79e4-4cc4-a67b-d7a96c68de38/transparent-1783124616173.png'
]
where id = 'b300a2fd-79e4-4cc4-a67b-d7a96c68de38';

-- ── PART 2 — Distressed Sleeveless Vest ───────────────────────────────────
-- EDIT FIRST: set the real colour for each style after eyeballing the three
-- cutouts listed in the header, then uncomment and run.

-- update products p
-- set variants = (
--   select jsonb_agg(
--     jsonb_set(v, '{attributes,color}',
--       to_jsonb(case v->'attributes'->>'color'
--         when '1Style' then 'Black'   -- ← confirm
--         when '2Style' then 'Brown'   -- ← confirm
--         when '3Style' then 'Grey'    -- ← confirm
--         else v->'attributes'->>'color' end))
--   )
--   from jsonb_array_elements(p.variants) v
-- )
-- where p.id = '9d599b15-6e6c-4a0f-b64a-564134cc0e0e';

-- Promote the BLACK style's cutout to the front of image_urls (keep the rest
-- in order). Replace <BLACK_CUTOUT_URL> with the confirmed style's cutout.
-- update products p
-- set image_urls =
--   array_prepend(
--     '<BLACK_CUTOUT_URL>',
--     array_remove(p.image_urls, '<BLACK_CUTOUT_URL>'))
-- where p.id = '9d599b15-6e6c-4a0f-b64a-564134cc0e0e';

-- Verify both products afterwards:
-- select slug, image_urls[1] from products
-- where id in ('b300a2fd-79e4-4cc4-a67b-d7a96c68de38',
--              '9d599b15-6e6c-4a0f-b64a-564134cc0e0e');
