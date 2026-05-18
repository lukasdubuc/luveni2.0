
-- 1) Hide internal product columns from anon/public via column privileges.
-- RLS still allows row access for published products, but anon can't SELECT these columns.
REVOKE SELECT (fulfillment_notes, source_url) ON public.products FROM anon;
REVOKE SELECT (fulfillment_notes, source_url) ON public.products FROM PUBLIC;
-- Ensure authenticated admins keep full access (RLS still gates rows).
GRANT SELECT ON public.products TO authenticated;

-- 2) Explicitly block non-admins from writing user_roles (defense in depth).
CREATE POLICY "Block non-admin role inserts"
ON public.user_roles
AS RESTRICTIVE
FOR INSERT
TO authenticated, anon
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Block non-admin role updates"
ON public.user_roles
AS RESTRICTIVE
FOR UPDATE
TO authenticated, anon
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Block non-admin role deletes"
ON public.user_roles
AS RESTRICTIVE
FOR DELETE
TO authenticated, anon
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- 3) Restrict EXECUTE on has_role: revoke from public/anon. Authenticated keeps EXECUTE
-- because RLS policies on other tables call it during query planning under the
-- authenticated role.
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
