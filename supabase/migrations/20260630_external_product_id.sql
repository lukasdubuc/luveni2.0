-- ─────────────────────────────────────────────────────────────
--  Luveni GM — generic external product id for non-Printful vendors
--  Printful upserts on products.printful_id; Apliiq/Zendrop need their
--  own idempotency key. One column + a partial unique index keyed by
--  (source, external_product_id) lets each importer upsert cleanly.
-- ─────────────────────────────────────────────────────────────

alter table public.products
  add column if not exists external_product_id text;

comment on column public.products.external_product_id is
  'Vendor-native product id for non-Printful sources (Apliiq/Zendrop). Unique per source.';

create unique index if not exists products_source_external_uidx
  on public.products (source, external_product_id)
  where external_product_id is not null;
