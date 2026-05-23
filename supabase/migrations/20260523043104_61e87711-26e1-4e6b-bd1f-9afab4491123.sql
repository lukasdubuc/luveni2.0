-- Replace hardcoded email admin policy on site_config with has_role()
DROP POLICY IF EXISTS "Admins can manage site_config" ON public.site_config;

CREATE POLICY "Admins can manage site_config"
  ON public.site_config
  AS PERMISSIVE
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Re-assert column-level REVOKE on internal product fields
REVOKE SELECT (fulfillment_notes, source_url, fulfillment_provider, external_sku)
  ON public.products FROM anon, authenticated;