-- ─────────────────────────────────────────────────────────────
--  Luveni GM — data-driven pricing engine
--
--  1. pricing_rules: per-category retail pricing parameters, seeded from
--     the owner's Printful cost/shipping spreadsheet. The formula every
--     caller (edge functions, worker agents, admin UI) must use:
--
--        floor_fees   = (cost + ship_first + min_profit) / (1 - fee_rate)
--        floor_margin = cost / (1 - target_margin)
--        retail       = charm( max(floor_fees, floor_margin) )
--
--     charm() rounds UP to the next ".99" ending. fee_rate covers payment
--     processing + marketplace referral (TikTok Shop ~6% + Stripe ~2.9%),
--     so min_profit is real profit AFTER fees and shipping.
--
--  2. products.cost_cents / shipping_cents / category: keep vendor COST
--     separate from retail price_cents forever (imports used to overwrite
--     price with cost — never again).
--
--  Additive + idempotent. Agents may UPDATE rule parameters (that is the
--  tuning surface) but the formula lives in code.
-- ─────────────────────────────────────────────────────────────

create table if not exists public.pricing_rules (
  key text primary key,
  category text not null,
  examples text,
  match_keywords text[] not null default '{}',
  ship_first_cents integer not null default 0,
  ship_addl_cents integer not null default 0,
  min_profit_cents integer not null default 500,
  target_margin numeric not null default 0.55 check (target_margin >= 0 and target_margin < 0.95),
  fee_rate numeric not null default 0.09 check (fee_rate >= 0 and fee_rate < 0.5),
  active boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table public.pricing_rules enable row level security;

do $$ begin
  create policy "pricing_rules_public_read" on public.pricing_rules
    for select using (true);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "pricing_rules_admin_write" on public.pricing_rules
    for all using (public.has_role(auth.uid(), 'admin'))
    with check (public.has_role(auth.uid(), 'admin'));
exception when duplicate_object then null; end $$;

-- Seed: owner's Printful category sheet (US shipping) + defaults for CJ.
insert into public.pricing_rules
  (key, category, examples, match_keywords, ship_first_cents, ship_addl_cents, min_profit_cents, target_margin, fee_rate)
values
  ('bags',          'Bags',                   'Backpacks',                                '{backpack,bag,tote,duffel}',                         1049, 450, 1000, 0.55, 0.09),
  ('footwear',      'Footwear',               'Slides, sneakers, canvas shoes',           '{sneaker,slide,shoe,footwear,canvas}',                899, 899,  700, 0.55, 0.09),
  ('shirts',        'Shirts',                 'T-shirts, tank tops, polo shirts, crop tops','{t-shirt,tshirt,tee,shirt,tank,polo,crop}',          475, 220,  800, 0.55, 0.09),
  ('all_over_print','All-Over Print Clothing','Shirts, leggings, dresses, shorts',        '{all-over,aop,legging,dress,shorts}',                 449, 200,  850, 0.55, 0.09),
  ('kids',          'Kids and Youth Clothing','T-shirts, hoodies, baby items',            '{kids,youth,baby,toddler}',                           449, 200,  500, 0.55, 0.09),
  ('tech',          'Tech Accessories',       'Phone cases, AirPods cases',               '{phone case,airpods,tech}',                           499, 100,  500, 0.60, 0.09),
  ('mugs',          'Mugs',                   'White/Black Mugs (11oz)',                  '{mug}',                                               649, 350,  500, 0.60, 0.09),
  ('stationery',    'Stationery',             'Notebooks, Calendars',                     '{notebook,calendar,journal,sticker}',                 449, 200,  500, 0.60, 0.09),
  ('premium',       'Premium Apparel',        'Hoodies, jackets, vests, embroidered',     '{hoodie,jacket,vest,sweatshirt,embroider,windbreaker}',849, 250, 1000, 0.55, 0.09),
  ('headwear',      'Headwear',               'Hats, caps, beanies, bucket hats',         '{hat,cap,beanie,bucket}',                             399, 199,  700, 0.60, 0.09),
  ('default',       'Default',                'Anything unmatched (CJ general)',          '{}',                                                  600, 300,  800, 0.55, 0.09)
on conflict (key) do nothing;

-- Cost vs retail separation on products --------------------------------------
alter table public.products
  add column if not exists cost_cents integer,
  add column if not exists shipping_cents integer,
  add column if not exists category text;

comment on column public.products.cost_cents is
  'Vendor COST for the cheapest variant (what we pay). price_cents is RETAIL.';
comment on column public.products.shipping_cents is
  'Estimated first-item shipping cost used when this product was priced.';
comment on column public.products.category is
  'pricing_rules.key used to price this product.';
