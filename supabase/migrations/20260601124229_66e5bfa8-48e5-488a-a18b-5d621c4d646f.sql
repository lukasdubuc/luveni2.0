
-- 1. admin_users: enable RLS + admin-only policies
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.admin_users FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_users TO authenticated;
GRANT ALL ON public.admin_users TO service_role;

CREATE POLICY "Admins can view admin_users"
  ON public.admin_users FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins can insert admin_users"
  ON public.admin_users FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins can update admin_users"
  ON public.admin_users FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins can delete admin_users"
  ON public.admin_users FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- 2. page_events: narrow SELECT to admins only
DROP POLICY IF EXISTS "auth read" ON public.page_events;
CREATE POLICY "Admins can read page_events"
  ON public.page_events FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- 3. products: hide internal columns from anon (admins still see via authenticated)
REVOKE SELECT (printful_id, fulfillment_type, api_synced_at) ON public.products FROM anon;

-- 4. has_role: revoke EXECUTE from anon (still callable by authenticated for RLS)
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;

-- 5. delete_order: set search_path, restrict execute, admin-only check inside
CREATE OR REPLACE FUNCTION public.delete_order(order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  DELETE FROM public.orders WHERE id = order_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.delete_order(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.delete_order(uuid) TO authenticated, service_role;

-- 6. Realtime: restrict channel subscriptions to admins only
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can read realtime" ON realtime.messages;
CREATE POLICY "Admins can read realtime"
  ON realtime.messages FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Admins can write realtime" ON realtime.messages;
CREATE POLICY "Admins can write realtime"
  ON realtime.messages FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
