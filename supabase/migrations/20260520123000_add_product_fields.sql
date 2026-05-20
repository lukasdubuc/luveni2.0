-- Add new product fields for fulfillment and rich offer content.
ALTER TABLE public.products
  ADD COLUMN bullet_points text[] NOT NULL DEFAULT '{}',
  ADD COLUMN fulfillment_provider text,
  ADD COLUMN external_sku text;
