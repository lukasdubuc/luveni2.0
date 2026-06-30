-- ─────────────────────────────────────────────────────────────
--  Luveni GM — Multi-vendor sourcing + curation buffer + media spine
--
--  Adds the data layer the storefront/ops backlog depends on:
--    1. products.source            → which manufacturer a product came from
--                                     ('printful' | 'apliiq' | 'zendrop' | 'manual')
--    2. products.raw_payload       → the untouched manufacturer JSON, so we
--                                     never lose data the importer didn't map.
--    3. products.buffer_qty        → inventory safety dampener per product
--                                     (displayed = max(0, physical - buffer)).
--    4. public.product_media       → EVERY mockup view, per variant, ordered.
--                                     Fixes the "only the primary photo survives"
--                                     bug by storing back/side/model/lifestyle
--                                     shots instead of one flat image_urls array.
--    5. public.channel_publications→ curation buffer: a product stays a local
--                                     draft until an admin one-click publishes it
--                                     to a specific channel (tiktok / etsy / shop).
--
--  Additive + idempotent. No drops, no data loss. Review before deploy
--  per CLAUDE.md rule #4.
-- ─────────────────────────────────────────────────────────────

-- 1–3. Product-level columns ----------------------------------------------------
alter table public.products
  add column if not exists source text not null default 'printful',
  add column if not exists raw_payload jsonb,
  add column if not exists buffer_qty integer not null default 0;

-- Constrain source to the vendors we actually route to.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'products_source_check'
  ) then
    alter table public.products
      add constraint products_source_check
      check (source in ('printful', 'apliiq', 'zendrop', 'manual'));
  end if;
end $$;

comment on column public.products.source is
  'Originating manufacturer: printful | apliiq | zendrop | manual. Drives split-fulfillment routing.';
comment on column public.products.raw_payload is
  'Untouched manufacturer JSON payload captured at import time (curation buffer source of truth).';
comment on column public.products.buffer_qty is
  'Inventory safety dampener. Displayed stock = max(0, physical_stock - buffer_qty).';


-- 4. product_media — every view, per variant, ordered ---------------------------
create table if not exists public.product_media (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  -- Variant this asset belongs to. Null = applies to the whole product
  -- (e.g. a generic lifestyle shot). Matches products.variants[].sku /
  -- external_sku so the modal can filter the carousel by colour.
  variant_key text,
  -- Classified view so the storefront grid can pick the flat-transparent
  -- shot and the modal can show back/side/model/lifestyle.
  view_type text not null default 'other'
    check (view_type in ('front_flat','back_flat','side_flat','sleeve','model','lifestyle','detail','other')),
  url text not null,
  -- True for the single flat transparent mockup used on the Yeezy-style grid.
  is_primary boolean not null default false,
  -- Whether the source asset has a transparent background (grid-eligible).
  is_transparent boolean not null default false,
  -- Ordering within (product, variant) for carousel sequencing.
  position integer not null default 0,
  source text not null default 'printful',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  -- One row per (product, variant, url): re-imports upsert instead of dupe.
  unique (product_id, variant_key, url)
);

create index if not exists product_media_product_idx on public.product_media (product_id);
create index if not exists product_media_variant_idx on public.product_media (product_id, variant_key);

alter table public.product_media enable row level security;

-- Public can read media for published products (storefront grid + modal).
drop policy if exists "Public reads media of published products" on public.product_media;
create policy "Public reads media of published products"
  on public.product_media for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.products p
      where p.id = product_media.product_id
        and p.is_published = true
        and p.is_archived = false
    )
  );

-- Admins manage all media.
drop policy if exists "Admins manage product_media" on public.product_media;
create policy "Admins manage product_media"
  on public.product_media for all
  to authenticated
  using (public.has_role(auth.uid(), 'admin'::public.app_role))
  with check (public.has_role(auth.uid(), 'admin'::public.app_role));


-- 5. channel_publications — the curation buffer / publish state machine ----------
create table if not exists public.channel_publications (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  channel text not null check (channel in ('shop','tiktok','etsy')),
  -- draft → curated (reviewed, ready) → published (live on channel) → error.
  status text not null default 'draft'
    check (status in ('draft','curated','published','error')),
  -- The channel's own id once published (TikTok product id, Etsy listing id…).
  external_id text,
  -- The exact formatted payload we pushed (or will push) to the channel.
  payload jsonb,
  -- Subset of product_media chosen for this channel (e.g. the TikTok 9).
  selected_media jsonb not null default '[]'::jsonb,
  last_error text,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_id, channel)
);

create index if not exists channel_pub_product_idx on public.channel_publications (product_id);
create index if not exists channel_pub_status_idx on public.channel_publications (channel, status);

alter table public.channel_publications enable row level security;

drop policy if exists "Admins manage channel_publications" on public.channel_publications;
create policy "Admins manage channel_publications"
  on public.channel_publications for all
  to authenticated
  using (public.has_role(auth.uid(), 'admin'::public.app_role))
  with check (public.has_role(auth.uid(), 'admin'::public.app_role));

create trigger channel_publications_updated_at
  before update on public.channel_publications
  for each row execute function public.touch_updated_at();
