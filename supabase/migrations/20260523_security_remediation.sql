-- 1. Enable RLS on all tables
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_config ENABLE ROW LEVEL SECURITY;

-- 2. Clean up loose policies
DROP POLICY IF EXISTS "Allow_All_Deletes" ON public.orders;
DROP POLICY IF EXISTS "Allow_All_Deletes" ON public.products;
DROP POLICY IF EXISTS "Allow_All_Selects" ON public.products;
DROP POLICY IF EXISTS "anyone can insert orders" ON public.orders;
DROP POLICY IF EXISTS "anyone can insert leads" ON public.leads;

-- 3. Implement Strict Access Control
-- Orders: Public can only INSERT, Admins can SELECT/UPDATE/DELETE
CREATE POLICY "Public can create orders" ON public.orders FOR INSERT WITH CHECK (true);
CREATE POLICY "Admins can manage orders" ON public.orders 
  USING (auth.jwt() ->> 'email' = 'lukasdubuc@gmail.com');

-- Leads: Public can only INSERT, Admins can SELECT/DELETE
CREATE POLICY "Public can create leads" ON public.leads FOR INSERT WITH CHECK (true);
CREATE POLICY "Admins can manage leads" ON public.leads 
  USING (auth.jwt() ->> 'email' = 'lukasdubuc@gmail.com');

-- Products: Anyone can view PUBLISHED products, Admins can manage ALL
CREATE POLICY "Public can view published products" ON public.products 
  FOR SELECT USING (is_published = true);
CREATE POLICY "Admins can manage products" ON public.products 
  USING (auth.jwt() ->> 'email' = 'lukasdubuc@gmail.com');

-- Site Config: Admins ONLY
CREATE POLICY "Admins can manage site_config" ON public.site_config 
  USING (auth.jwt() ->> 'email' = 'lukasdubuc@gmail.com');

-- 4. Restrict internal fields for anonymous users
-- This is partially handled by the SELECT policy above, but for extra security:
REVOKE ALL ON public.site_config FROM anon;
GRANT SELECT ON public.products TO anon; -- Required for shop, but gated by RLS
