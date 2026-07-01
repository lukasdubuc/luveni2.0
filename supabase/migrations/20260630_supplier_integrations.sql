-- ─────────────────────────────────────────────────────────────
--  Luveni GM — supplier / manufacturer integrations registry
--  Backs the Admin → Settings → Integrations UI (IntegrationsSettings.tsx):
--  add/edit/enable/disable a manufacturer or dropship supplier, storing its
--  per-vendor credential fields. Admin-only via RLS.
-- ─────────────────────────────────────────────────────────────

create table if not exists public.supplier_integrations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null default 'custom'
    check (type in ('printful','apliiq','zendrop','custom')),
  -- Per-vendor credential fields (api_key, app_id, secret, endpoint, ...).
  -- Admin-only table, RLS-gated below; still sensitive, so treat with the
  -- same care as any other credential store.
  credentials jsonb not null default '{}'::jsonb,
  enabled boolean not null default true,
  notes text,
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
