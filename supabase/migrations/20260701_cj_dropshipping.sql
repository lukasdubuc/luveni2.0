-- ─────────────────────────────────────────────────────────────
--  Luveni GM — CJ Dropshipping support + oversell protection
--
--  1. Allow 'cj' as a product source and supplier_integrations type.
--  2. Per-product low-stock threshold + alert de-dup timestamp so the
--     inventory watcher can fire a single Discord alert per drop instead
--     of spamming on every sweep.
--
--  Additive + idempotent. No drops of data. Review before deploy.
-- ─────────────────────────────────────────────────────────────

-- 1. Allow 'cj' as a product source -------------------------------------------
do $$
begin
  if exists (select 1 from pg_constraint where conname = 'products_source_check') then
    alter table public.products drop constraint products_source_check;
  end if;
  alter table public.products
    add constraint products_source_check
    check (source in ('printful', 'apliiq', 'zendrop', 'cj', 'manual'));
end $$;

-- Allow 'cj' as a supplier_integrations type ----------------------------------
do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'supplier_integrations_type_check'
  ) then
    alter table public.supplier_integrations drop constraint supplier_integrations_type_check;
  end if;
  alter table public.supplier_integrations
    add constraint supplier_integrations_type_check
    check (type in ('printful', 'apliiq', 'zendrop', 'cj', 'custom'));
end $$;

-- 2. Oversell-protection bookkeeping ------------------------------------------
alter table public.products
  add column if not exists low_stock_threshold integer not null default 3,
  add column if not exists last_low_stock_alert_at timestamptz;

comment on column public.products.low_stock_threshold is
  'Buffered stock at or below this fires a low-stock alert (default 3).';
comment on column public.products.last_low_stock_alert_at is
  'When the last low-stock Discord alert was sent, for de-duplication.';
