-- ─────────────────────────────────────────────────────────────
--  Luveni GM — supplier / manufacturer integrations registry
--  Lets the admin add and manage POD/dropship suppliers from the
--  dashboard: enable/disable, see status, and trigger each supplier's
--  sync edge function. API credentials still live in Supabase Edge
--  secrets (never in this table); this row holds the metadata + wiring.
-- ─────────────────────────────────────────────────────────────

create table if not exists public.supplier_integrations (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  kind text not null default 'print_on_demand'
    check (kind in ('print_on_demand','dropship','other')),
  enabled boolean not null default false,
  -- Edge function to invoke for a catalog sync (e.g. 'printful-sync').
  sync_function text,
  api_base text,
  -- Names of the Supabase Edge secrets this supplier needs (for the UI to
  -- remind the admin what to set — values are NEVER stored here).
  required_secrets text[] not null default '{}',
  notes text,
  config jsonb not null default '{}'::jsonb,
  status text not null default 'unconfigured'
    check (status in ('unconfigured','connected','error','disabled')),
  last_synced_at timestamptz,
  last_result jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.supplier_integrations enable row level security;

drop policy if exists "Admins manage supplier_integrations" on public.supplier_integrations;
create policy "Admins manage supplier_integrations"
  on public.supplier_integrations for all
  to authenticated
  using (public.has_role(auth.uid(), 'admin'::public.app_role))
  with check (public.has_role(auth.uid(), 'admin'::public.app_role));

create trigger supplier_integrations_updated_at
  before update on public.supplier_integrations
  for each row execute function public.touch_updated_at();

-- Seed the three suppliers the codebase already integrates.
insert into public.supplier_integrations (slug, name, kind, sync_function, api_base, required_secrets, notes)
values
  ('printful', 'Printful', 'print_on_demand', 'printful-sync', 'https://api.printful.com',
   array['PRINTFUL_API_KEY','PRINTFUL_STORE_ID'], 'Custom designs + blanks. Powers the Studio publish flow.'),
  ('apliiq', 'Apliiq', 'print_on_demand', 'apliiq-sync', 'https://api.apliiq.com',
   array['APLIIQ_APP_ID','APLIIQ_SHARED_SECRET'], 'HMAC-signed API via the apliiq-proxy edge function.'),
  ('zendrop', 'Zendrop', 'dropship', 'zendrop-sync', 'https://api.zendrop.com',
   array['ZENDROP_API_KEY'], 'Ready-made dropship products. Imports land in the curation buffer.')
on conflict (slug) do nothing;
