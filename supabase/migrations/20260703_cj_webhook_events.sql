-- ─────────────────────────────────────────────────────────────
--  Luveni GM — CJ webhook event log
--
--  Every push CJ sends to the cj-webhook function is recorded here with
--  what we did about it, so Dexter's health checks can spot silent
--  failures (events arriving but no products updating) and the admin can
--  audit near-real-time inventory behaviour.
--
--  Additive + idempotent.
-- ─────────────────────────────────────────────────────────────

create table if not exists public.cj_webhook_events (
  id uuid primary key default gen_random_uuid(),
  type text not null default 'unknown',
  payload jsonb,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists cj_webhook_events_created_idx on public.cj_webhook_events (created_at desc);

alter table public.cj_webhook_events enable row level security;

do $$ begin
  create policy "cj_webhook_events_admin_read" on public.cj_webhook_events
    for select to authenticated
    using (public.has_role(auth.uid(), 'admin'));
exception when duplicate_object then null; end $$;
