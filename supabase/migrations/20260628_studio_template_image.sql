alter table public.studio_projects add column if not exists template_image text;
alter table public.studio_projects add column if not exists canvas_kind text default 'product';
