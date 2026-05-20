-- Add the product variants JSONB column so external supplier data can be stored per product.
ALTER TABLE public.products
  ADD COLUMN variants jsonb NOT NULL DEFAULT '[]';
