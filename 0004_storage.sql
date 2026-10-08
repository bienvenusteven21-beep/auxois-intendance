-- =====================================================================
-- AUXOIS INTENDANCE — 0004 : stockage sécurisé des photos et documents
-- Buckets privés : aucun fichier n’a d’adresse publique. L’application
-- génère des URL signées temporaires, uniquement si la personne connectée
-- a le droit de lire le fichier.
-- Convention de chemin : <id de la propriété>/<nom de fichier>
-- =====================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('photos', 'photos', false, 15728640,
     array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'image/svg+xml']),
  ('documents', 'documents', false, 26214400, null),
  ('branding', 'branding', false, 5242880,
     array['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'])
on conflict (id) do nothing;

create or replace function public.client_can_read_object(p_bucket text, p_name text)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select case p_bucket
    when 'photos' then
      exists (
        select 1 from public.photos p
        where p.storage_path = p_name
          and p.is_shared
          and public.owns_property(p.property_id)
          and (p.visit_id is null or public.client_can_see_visit(p.visit_id)))
      or exists (
        select 1 from public.properties pr
        where pr.cover_photo_path = p_name and public.owns_property(pr.id))
    when 'documents' then
      exists (
        select 1 from public.documents d
        where d.storage_path = p_name
          and d.visibility = 'client'
          and ((d.property_id is not null and public.owns_property(d.property_id))
               or (d.client_id is not null and d.client_id in (select public.my_client_ids()))))
    when 'branding' then true
    else false
  end
$$;

revoke all on function public.client_can_read_object(text, text) from anon, public;
grant execute on function public.client_can_read_object(text, text) to authenticated, service_role;

create policy "auxois equipe lecture" on storage.objects for select to authenticated
  using (bucket_id in ('photos', 'documents', 'branding') and public.is_staff());

create policy "auxois equipe ajout" on storage.objects for insert to authenticated
  with check (bucket_id in ('photos', 'documents', 'branding') and public.is_staff());

create policy "auxois equipe modification" on storage.objects for update to authenticated
  using (bucket_id in ('photos', 'documents', 'branding') and public.is_staff())
  with check (bucket_id in ('photos', 'documents', 'branding') and public.is_staff());

create policy "auxois equipe suppression" on storage.objects for delete to authenticated
  using (bucket_id in ('photos', 'documents', 'branding') and public.is_staff());

create policy "auxois proprietaire lecture" on storage.objects for select to authenticated
  using (bucket_id in ('photos', 'documents', 'branding')
         and public.client_can_read_object(bucket_id, name));
