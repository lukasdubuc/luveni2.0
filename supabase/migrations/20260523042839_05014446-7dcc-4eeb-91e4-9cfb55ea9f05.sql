-- Enable RLS on site_config (policies already exist)
ALTER TABLE public.site_config ENABLE ROW LEVEL SECURITY;

-- Re-apply column-level REVOKE on internal product fields for anon/authenticated roles
REVOKE SELECT (fulfillment_notes, source_url, fulfillment_provider, external_sku)
  ON public.products FROM anon, authenticated;

-- Ensure admins (via service role / RLS) can still read everything; service_role bypasses column grants
GRANT SELECT (id, title, slug, description, price_cents, price_cents_discounted, currency, image_urls, bullet_points, variants, is_published, is_featured, created_at, updated_at)
  ON public.products TO anon, authenticated;