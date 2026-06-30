-- ─────────────────────────────────────────────────────────────
--  Luveni GM — inventory safety dampener in the public shop view
--  displayedStock = max(0, physicalStock - buffer_qty), applied per
--  variant so async POD stock can't oversell. Mirrors the TS
--  applyInventoryBuffer() used elsewhere.
-- ─────────────────────────────────────────────────────────────

-- Map each variant's `stock` down by the product's buffer_qty.
create or replace function public.apply_inventory_buffer(variants jsonb, buffer integer)
returns jsonb
language sql
immutable
as $$
  select coalesce(
    jsonb_agg(
      case
        when (v ? 'stock') then
          jsonb_set(v, '{stock}', to_jsonb(greatest(0, coalesce((v->>'stock')::int, 0) - greatest(coalesce(buffer,0),0))))
        else v
      end
    ),
    '[]'::jsonb
  )
  from jsonb_array_elements(coalesce(variants, '[]'::jsonb)) as v;
$$;

drop view if exists public.products_public;
create view public.products_public
with (security_invoker = false) as
select
  id, slug, title, description, price_cents, price_cents_discounted,
  currency, image_urls, is_published, is_archived, display_order,
  -- Buffered variants so the storefront never shows un-dampened stock.
  public.apply_inventory_buffer(variants, buffer_qty) as variants,
  source,
  created_at, updated_at
from public.products
where is_published = true and is_archived = false;

grant select on public.products_public to anon, authenticated;
