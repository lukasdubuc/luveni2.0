-- ─────────────────────────────────────────────────────────────
--  Luveni GM — TikTok content-posting integration (developers.tiktok.com)
--
--  tiktok_posts: audit log of every photo/video the tiktok-post function
--  submits (publish_id ↔ product, privacy, status) so the admin UI and the
--  fleet can track what went out and poll publish status.
--
--  OAuth tokens live in site_config.metadata.tiktok_auth (managed by the
--  tiktok-oauth function) — no new secret storage here.
--
--  Additive + idempotent.
-- ─────────────────────────────────────────────────────────────

create table if not exists public.tiktok_posts (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references public.products(id) on delete set null,
  publish_id text,
  post_type text not null check (post_type in ('photo','video')),
  title text,
  privacy text not null default 'SELF_ONLY',
  post_mode text not null default 'DIRECT_POST',
  media jsonb not null default '[]'::jsonb,
  status text not null default 'submitted',
  raw jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists tiktok_posts_publish_idx on public.tiktok_posts (publish_id);
create index if not exists tiktok_posts_product_idx on public.tiktok_posts (product_id, created_at);

alter table public.tiktok_posts enable row level security;

do $$ begin
  create policy "tiktok_posts_admin_manage" on public.tiktok_posts
    for all to authenticated
    using (public.has_role(auth.uid(), 'admin'))
    with check (public.has_role(auth.uid(), 'admin'));
exception when duplicate_object then null; end $$;
