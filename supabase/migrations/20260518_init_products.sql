CREATE TABLE IF NOT EXISTS public.products (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    title TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    price_cents INTEGER DEFAULT 0,
    currency TEXT DEFAULT 'usd',
    is_published BOOLEAN DEFAULT true
);

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow_All_Deletes" ON public.orders;
CREATE POLICY "Allow_All_Deletes" ON public.orders FOR DELETE USING (true);

DROP POLICY IF EXISTS "Allow_All_Deletes" ON public.products;
CREATE POLICY "Allow_All_Deletes" ON public.products FOR DELETE USING (true);

DROP POLICY IF EXISTS "Allow_All_Selects" ON public.products;
CREATE POLICY "Allow_All_Selects" ON public.products FOR SELECT USING (true);
