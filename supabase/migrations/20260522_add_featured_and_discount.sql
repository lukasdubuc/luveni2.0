-- Add is_featured and price_cents_discounted columns to support featured products
-- and discounted pricing display.
ALTER TABLE public.products
  ADD COLUMN is_featured boolean NOT NULL DEFAULT false,
  ADD COLUMN price_cents_discounted integer;

-- Create index on is_featured for faster queries
CREATE INDEX idx_products_is_featured ON public.products(is_featured) WHERE is_featured = true;
