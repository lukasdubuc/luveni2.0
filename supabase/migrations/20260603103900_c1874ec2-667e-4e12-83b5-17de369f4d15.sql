-- 1) Revoke sensitive product columns from anon (and public)
REVOKE SELECT (printful_id, fulfillment_type, api_synced_at) ON public.products FROM anon;
REVOKE SELECT (printful_id, fulfillment_type, api_synced_at) ON public.products FROM PUBLIC;

-- Re-grant safe columns to anon explicitly so anonymous storefront still works
GRANT SELECT (
  id, slug, title, description, price_cents, price_cents_discounted, currency,
  image_urls, is_published, is_archived, display_order, variants,
  created_at, updated_at
) ON public.products TO anon;

-- 2) Remove sensitive tables from realtime publication
ALTER PUBLICATION supabase_realtime DROP TABLE public.leads;
ALTER PUBLICATION supabase_realtime DROP TABLE public.orders;
ALTER PUBLICATION supabase_realtime DROP TABLE public.admin_users;