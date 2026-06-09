-- 1) Restrict anon access to products: create a public-safe view and revoke anon SELECT on base table.
DROP POLICY IF EXISTS "Anon can view safe columns of published products" ON public.products;

CREATE OR REPLACE VIEW public.products_public
WITH (security_invoker = true)
AS
SELECT
  id, slug, title, description,
  price_cents, price_cents_discounted, currency,
  image_urls, is_published, is_archived,
  display_order, variants, created_at, updated_at
FROM public.products
WHERE is_published = true AND COALESCE(is_archived, false) = false;

REVOKE ALL ON public.products_public FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.products_public TO anon, authenticated;

-- Re-allow anon to read only the safe view's underlying rows by giving a narrow base-row policy
-- (security_invoker views require the caller to have row-level access on the base table).
CREATE POLICY "Anon read via products_public view"
ON public.products
FOR SELECT TO anon
USING (is_published = true AND COALESCE(is_archived, false) = false);

-- Note: column-level GRANTs on the base table further restrict what anon can SELECT directly.
REVOKE SELECT ON public.products FROM anon;
GRANT SELECT (
  id, slug, title, description,
  price_cents, price_cents_discounted, currency,
  image_urls, is_published, is_archived,
  display_order, variants, created_at, updated_at
) ON public.products TO anon;

-- 2) Remove overly-broad authenticated SELECT on page_events; admins-only remains in place.
DROP POLICY IF EXISTS "Allow select access to page_events for authenticated users" ON public.page_events;
