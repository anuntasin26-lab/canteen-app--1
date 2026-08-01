-- menu-images storage bucket: INSERT/UPDATE/DELETE were open to role "public"
-- (anon included), letting anyone holding the anon key write/overwrite/delete
-- files directly via the Storage API. The app only ever uploads/deletes menu
-- images from the staff-gated /kitchen page, so restrict writes to authenticated.
drop policy if exists "menu images public insert" on storage.objects;
drop policy if exists "menu images public update" on storage.objects;
drop policy if exists "menu images public delete" on storage.objects;

create policy "menu images staff insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'menu-images');

create policy "menu images staff update" on storage.objects
  for update to authenticated
  using (bucket_id = 'menu-images');

create policy "menu images staff delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'menu-images');
