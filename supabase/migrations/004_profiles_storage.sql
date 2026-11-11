-- Fase 2: fotos y banners en Storage, y sectores de inversores/empresas visibles en su perfil público.
begin;

-- Los sectores de interés/experiencia se muestran en el perfil público de inversores y empresas;
-- solo su dueño puede modificarlos.
drop policy if exists "Users manage their own profile sectors" on public.profile_sectors;
create policy "Authenticated users can read profile sectors" on public.profile_sectors
  for select to authenticated using (true);
create policy "Users add their own profile sectors" on public.profile_sectors
  for insert to authenticated with check (profile_id = (select auth.uid()));
create policy "Users remove their own profile sectors" on public.profile_sectors
  for delete to authenticated using (profile_id = (select auth.uid()));

-- Dos buckets públicos de lectura. Foto: máx. 2 MB; banner: máx. 5 MB; solo JPG, PNG o WebP.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('avatars', 'avatars', true, 2097152, array['image/jpeg', 'image/png', 'image/webp']),
  ('banners', 'banners', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- Escritura solo dentro de la carpeta del propio usuario: {user_id}/archivo
drop policy if exists "Public read of avatars and banners" on storage.objects;
create policy "Public read of avatars and banners" on storage.objects
  for select using (bucket_id in ('avatars', 'banners'));
drop policy if exists "Users upload to their own folder" on storage.objects;
create policy "Users upload to their own folder" on storage.objects
  for insert to authenticated
  with check (bucket_id in ('avatars', 'banners') and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists "Users replace files in their own folder" on storage.objects;
create policy "Users replace files in their own folder" on storage.objects
  for update to authenticated
  using (bucket_id in ('avatars', 'banners') and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id in ('avatars', 'banners') and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists "Users delete files in their own folder" on storage.objects;
create policy "Users delete files in their own folder" on storage.objects
  for delete to authenticated
  using (bucket_id in ('avatars', 'banners') and (storage.foldername(name))[1] = (select auth.uid())::text);

commit;
