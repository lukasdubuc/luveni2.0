
create table public.leads (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  source text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index leads_email_idx on public.leads(email);
alter table public.leads enable row level security;
create policy "anyone can insert leads" on public.leads for insert with check (true);
create policy "authenticated can read leads" on public.leads for select to authenticated using (true);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  name text,
  amount_cents integer not null default 0,
  currency text not null default 'usd',
  status text not null default 'pending',
  provider text,
  provider_ref text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index orders_email_idx on public.orders(email);
alter table public.orders enable row level security;
create policy "anyone can insert orders" on public.orders for insert with check (true);
create policy "authenticated can read orders" on public.orders for select to authenticated using (true);
