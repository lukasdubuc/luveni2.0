-- Insert the existing hardcoded offer into the Supabase products table.
-- Run this from your Supabase SQL editor or CLI.

INSERT INTO public.products (
  title,
  slug,
  description,
  price_cents,
  currency,
  image_urls,
  source_url,
  fulfillment_notes,
  is_published
) VALUES (
  'The Starter Package',
  'the-starter-package',
  'Everything you need to get started in one focused, no-fluff package.\n\n• Instant digital delivery — access immediately after checkout\n• Step-by-step onboarding so you never feel stuck\n• Lifetime updates included with your purchase\n• Friendly human support, usually replies within 24 hours',
  4900,
  'usd',
  ARRAY['https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1200&q=80'],
  'https://services2day.lovable.app/offer',
  'Includes instant access and lifetime updates. Delivered digitally via email.',
  true
);
