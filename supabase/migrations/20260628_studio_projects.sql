create table if not exists public.studio_projects (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Untitled project',
  manufacturer text default 'printful',
  template_key text default 'tee',
  price_cents int default 0,
  -- Konva scene graph (layers, transforms, text) serialized as JSON.
  canvas jsonb not null default '{}'::jsonb,
  artboard_w int default 4500,
  artboard_h int default 5400,
  thumbnail_url text,
  status text not null default 'draft',
  source text default 'manual', -- 'manual' | 'ai_auto'
  created_by uuid references auth.users(id) on delete set null,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.studio_projects enable row level security;

create policy "Admins manage studio_projects"
  on public.studio_projects for all
  to authenticated
  using (public.has_role(auth.uid(), 'admin'::public.app_role))
  with check (public.has_role(auth.uid(), 'admin'::public.app_role));

create trigger studio_projects_updated_at
  before update on public.studio_projects
  for each row execute function public.touch_updated_at();

alter publication supabase_realtime add table public.studio_projects;
alter table public.studio_projects replica identity full;
