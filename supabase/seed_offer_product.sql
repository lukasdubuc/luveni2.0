-- Insert the existing hardcoded offer into the Supabase products table.
-- Run this from your Supabase SQL editor or CLI.

INSERT INTO public.products (
  title,
  slug,
  description,
  bullet_points,
  variants,
  price_cents,
  currency,
  image_urls,
  source_url,
  fulfillment_provider,
  external_sku,
  fulfillment_notes,
  is_published
) VALUES (
  'The Starter Package',
  'the-starter-package',
  'Everything you need to get started in one focused, no-fluff package.',
  ARRAY[
    'Instant digital delivery — access immediately after checkout',
    'Step-by-step onboarding so you never feel stuck',
    'Lifetime updates included with your purchase',
    'Friendly human support, usually replies within 24 hours'
  ],
  '[
    {"sku": "starter-black-s", "stock": 12, "price_cents": 4900, "attributes": {"color": "Black", "size": "S"}},
    {"sku": "starter-black-m", "stock": 8, "price_cents": 4900, "attributes": {"color": "Black", "size": "M"}},
    {"sku": "starter-white-m", "stock": 0, "price_cents": 4900, "attributes": {"color": "White", "size": "M"}}
  ]'::jsonb,
  4900,
  'usd',
  ARRAY['https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1200&q=80'],
  'https://services2day.lovable.app/offer',
  'email',
  'starter-package',
  'Includes instant access and lifetime updates. Delivered digitally via email.',
  true
);
