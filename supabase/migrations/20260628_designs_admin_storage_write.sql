-- Let authenticated admins upload to the public 'designs' bucket so the
-- studio editor can save flattened print files directly (for publishing).
create policy "Admins write designs"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'designs' and public.has_role(auth.uid(), 'admin'::public.app_role));

create policy "Admins update designs"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'designs' and public.has_role(auth.uid(), 'admin'::public.app_role));
