-- Replace broad "public" SELECT policy with one explicitly scoped to anon/authenticated.
-- Combined with the existing per-column GRANTs (sensitive columns revoked from anon),
-- this enforces column-level security at the privilege layer.

DROP POLICY IF EXISTS "Anyone can view published products" ON public.products;

CREATE POLICY "Anon can view safe columns of published products"
ON public.products
FOR SELECT
TO anon
USING (is_published = true);

CREATE POLICY "Authenticated can view published products"
ON public.products
FOR SELECT
TO authenticated
USING (is_published = true);

-- Belt-and-braces: re-assert column-level GRANTs so anon physically cannot
-- read printful_id, fulfillment_type, or api_synced_at even via select(*).
REVOKE SELECT ON public.products FROM anon;
REVOKE SELECT (printful_id, fulfillment_type, api_synced_at) ON public.products FROM PUBLIC;

GRANT SELECT (
  id, slug, title, description, price_cents, price_cents_discounted, currency,
  image_urls, is_published, is_archived, display_order, variants,
  created_at, updated_at
) ON public.products TO anon;
