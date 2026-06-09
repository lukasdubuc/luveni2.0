
-- 1) Recreate products_public view as security definer (default), include all published rows regardless of archived flag
DROP VIEW IF EXISTS public.products_public;
CREATE VIEW public.products_public
WITH (security_invoker = false) AS
SELECT
  id, slug, title, description, price_cents, price_cents_discounted,
  currency, image_urls, is_published, is_archived, display_order,
  variants, created_at, updated_at
FROM public.products
WHERE is_published = true;

GRANT SELECT ON public.products_public TO anon, authenticated;

-- 2) Drop anon SELECT policy on base products table; anon now only reads via the view
DROP POLICY IF EXISTS "Anon read via products_public view" ON public.products;
REVOKE SELECT ON public.products FROM anon;

-- 3) Memories: explicit restrictive policy denying anon/authenticated
REVOKE ALL ON public.memories FROM anon, authenticated;
DROP POLICY IF EXISTS "Deny non-service access to memories" ON public.memories;
CREATE POLICY "Deny non-service access to memories"
  ON public.memories AS RESTRICTIVE
  FOR ALL TO anon, authenticated
  USING (false) WITH CHECK (false);

-- 4) Remove sensitive tables from realtime publication
ALTER PUBLICATION supabase_realtime DROP TABLE public.products;
ALTER PUBLICATION supabase_realtime DROP TABLE public.site_config;
