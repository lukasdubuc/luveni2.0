-- Shop view must hide archived (tombstoned) products, not just unpublished ones.
DROP VIEW IF EXISTS public.products_public;
CREATE VIEW public.products_public
WITH (security_invoker = false) AS
SELECT
  id, slug, title, description, price_cents, price_cents_discounted,
  currency, image_urls, is_published, is_archived, display_order,
  variants, created_at, updated_at
FROM public.products
WHERE is_published = true AND is_archived = false;
GRANT SELECT ON public.products_public TO anon, authenticated;

-- Deleting a product must not fail on analytics rows; null them out instead.
ALTER TABLE public.page_events
  DROP CONSTRAINT IF EXISTS page_events_product_id_fkey;
ALTER TABLE public.page_events
  ADD CONSTRAINT page_events_product_id_fkey
  FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE SET NULL;

-- Clean up rows that were archived (tombstoned) but left published.
UPDATE public.products SET is_published = false WHERE is_archived = true AND is_published = true;
