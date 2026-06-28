-- designs storage bucket (public read; writes via service-role only)
insert into storage.buckets (id, name, public)
values ('designs', 'designs', true)
on conflict (id) do nothing;

create policy "Public read designs"
  on storage.objects for select
  using (bucket_id = 'designs');

-- designs metadata table
create table if not exists public.designs (
  id uuid primary key default gen_random_uuid(),
  title text not null default 'Untitled',
  prompt text,
  image_url text not null,
  image_path text,
  width int default 1024,
  height int default 1024,
  model text default 'flux',
  status text not null default 'draft',
  created_by uuid references auth.users(id) on delete set null,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.designs enable row level security;

create policy "Admins can manage designs"
  on public.designs for all
  to authenticated
  using (public.has_role(auth.uid(), 'admin'::public.app_role))
  with check (public.has_role(auth.uid(), 'admin'::public.app_role));

create trigger designs_updated_at
  before update on public.designs
  for each row execute function public.touch_updated_at();

alter publication supabase_realtime add table public.designs;
alter table public.designs replica identity full;
