-- =====================================================================
-- AUXOIS INTENDANCE — 0002 : rôles, permissions et Row Level Security
--
-- Principe :
--   * l’équipe (super_admin, intendant, assistant) voit toutes les maisons ;
--   * un propriétaire ne voit QUE ce qui est rattaché à ses propriétés,
--     et seulement ce qui a été partagé (débrief envoyé, photo partageable,
--     document « client ») ;
--   * un propriétaire n’écrit jamais directement dans les tables : ses
--     actions passent par des fonctions contrôlées (voir 0003) ;
--   * le visiteur non connecté (anon) n’a accès à rien.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Fonctions d’aide (SECURITY DEFINER pour éviter toute récursion RLS)
-- ---------------------------------------------------------------------
create or replace function public.current_role_name()
returns text
language sql stable security definer
set search_path = public
as $$
  select u.role from public.users u
  where u.id = (select auth.uid()) and u.is_active
$$;

create or replace function public.is_staff()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select coalesce(public.current_role_name() in ('super_admin', 'intendant', 'assistant'), false)
$$;

create or replace function public.has_role(variadic p_roles text[])
returns boolean
language sql stable security definer
set search_path = public
as $$
  select coalesce(public.current_role_name() = any (p_roles), false)
$$;

create or replace function public.my_client_ids()
returns setof uuid
language sql stable security definer
set search_path = public
as $$
  select c.id
  from public.clients c
  join public.users u on u.id = c.user_id
  where c.user_id = (select auth.uid()) and u.is_active
$$;

create or replace function public.owns_property(p_property_id uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.property_owners po
    join public.clients c on c.id = po.client_id
    join public.users u on u.id = c.user_id
    where po.property_id = p_property_id
      and c.user_id = (select auth.uid())
      and u.is_active
  )
$$;

-- Un propriétaire voit une visite planifiée (date à venir) ou une visite
-- dont le débrief lui a été envoyé — jamais un brouillon en cours.
create or replace function public.client_can_see_visit(p_visit_id uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.visits v
    where v.id = p_visit_id
      and v.debrief_sent_at is not null
      and public.owns_property(v.property_id)
  )
$$;

-- ---------------------------------------------------------------------
-- Création automatique du profil à l’inscription.
-- Le tout premier compte créé devient super_admin (installation) ;
-- tous les suivants sont « client » sans aucune propriété rattachée
-- tant que l’équipe ne les a pas liés à une fiche client.
-- ---------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer
set search_path = public
as $$
declare
  v_role text := 'client';
begin
  perform pg_advisory_xact_lock(hashtext('auxois_first_admin'));
  if not exists (select 1 from public.users where role = 'super_admin') then
    v_role := 'super_admin';
  end if;
  insert into public.users (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), ''),
    v_role
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- Garde-fou : personne ne peut s’attribuer un rôle.
-- Seul un super_admin modifie rôle / activation ; on ne peut pas retirer
-- le dernier super_admin actif.
-- ---------------------------------------------------------------------
create or replace function public.guard_users_update()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  if new.id is distinct from old.id then
    raise exception 'Identifiant non modifiable';
  end if;
  if (new.role is distinct from old.role or new.is_active is distinct from old.is_active) then
    -- auth.uid() nul = opération serveur (clé de service / éditeur SQL)
    if (select auth.uid()) is not null and not public.has_role('super_admin') then
      raise exception 'Seul un super administrateur peut modifier un rôle'
        using errcode = '42501';
    end if;
    if old.role = 'super_admin' and old.is_active
       and (new.role <> 'super_admin' or not new.is_active)
       and not exists (
         select 1 from public.users
         where role = 'super_admin' and is_active and id <> old.id
       ) then
      raise exception 'Impossible de retirer le dernier super administrateur';
    end if;
  end if;
  return new;
end;
$$;

create trigger guard_users_update
  before update on public.users
  for each row execute function public.guard_users_update();

-- ---------------------------------------------------------------------
-- Activation de RLS sur TOUTES les tables
-- ---------------------------------------------------------------------
do $$
declare t record;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t.tablename);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- Privilèges de base
--   anon : rien du tout
--   authenticated : droits de table larges, filtrés par les politiques RLS,
--   puis restrictions ciblées plus bas.
-- ---------------------------------------------------------------------
revoke all on all tables in schema public from anon, public;
revoke all on all sequences in schema public from anon, public;
revoke all on all functions in schema public from anon, public;
alter default privileges in schema public revoke all on tables from anon, public;
alter default privileges in schema public revoke all on sequences from anon, public;
alter default privileges in schema public revoke execute on functions from anon, public;

revoke all on all tables in schema public from authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage on all sequences in schema public to authenticated;
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;

-- Restrictions ciblées
revoke all on public.property_secrets from authenticated;          -- via fonctions uniquement
revoke insert, update, delete on public.activity_logs from authenticated;
revoke insert, update, delete on public.notifications from authenticated;
grant update (read_at) on public.notifications to authenticated;
revoke insert, update, delete on public.users from authenticated;
grant update (full_name, phone, language, role, is_active) on public.users to authenticated;

grant execute on function
  public.current_role_name(), public.is_staff(), public.has_role(text[]),
  public.my_client_ids(), public.owns_property(uuid), public.client_can_see_visit(uuid)
to authenticated;

-- ---------------------------------------------------------------------
-- POLITIQUES
-- ---------------------------------------------------------------------

-- users
create policy users_select on public.users for select to authenticated
  using (id = (select auth.uid()) or public.is_staff());
create policy users_update_self on public.users for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy users_update_super on public.users for update to authenticated
  using (public.has_role('super_admin')) with check (public.has_role('super_admin'));

-- settings, formules, catégories : lecture pour tout utilisateur connecté
create policy settings_select on public.settings for select to authenticated using (true);
create policy settings_write on public.settings for all to authenticated
  using (public.has_role('super_admin')) with check (public.has_role('super_admin'));

create policy plans_select on public.subscription_plans for select to authenticated using (true);
create policy plans_write on public.subscription_plans for all to authenticated
  using (public.has_role('super_admin')) with check (public.has_role('super_admin'));

create policy doc_categories_select on public.document_categories for select to authenticated using (true);
create policy doc_categories_write on public.document_categories for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

-- clients
create policy clients_select on public.clients for select to authenticated
  using (public.is_staff() or user_id = (select auth.uid()));
create policy clients_write on public.clients for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

create policy client_internal_notes_staff on public.client_internal_notes for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

-- propriétés
create policy properties_select on public.properties for select to authenticated
  using (public.is_staff() or public.owns_property(id));
create policy properties_write on public.properties for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

-- property_secrets : aucune politique => aucun accès direct (fonctions dédiées)

create policy property_owners_select on public.property_owners for select to authenticated
  using (public.is_staff() or public.owns_property(property_id));
create policy property_owners_write on public.property_owners for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

create policy property_notes_select on public.property_notes for select to authenticated
  using (public.is_staff() or (visibility = 'client' and public.owns_property(property_id)));
create policy property_notes_write on public.property_notes for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

create policy subscriptions_select on public.subscriptions for select to authenticated
  using (public.is_staff() or public.owns_property(property_id));
create policy subscriptions_write on public.subscriptions for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

-- checklists modèles, partenaires, tâches internes : équipe uniquement
create policy checklist_templates_staff on public.checklist_templates for all to authenticated
  using (public.is_staff()) with check (public.is_staff());
create policy checklist_template_items_staff on public.checklist_template_items for all to authenticated
  using (public.is_staff()) with check (public.is_staff());
create policy partners_staff on public.partners for all to authenticated
  using (public.is_staff()) with check (public.is_staff());
create policy internal_tasks_staff on public.internal_tasks for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

-- séjours
create policy stays_select on public.stays for select to authenticated
  using (public.is_staff() or public.owns_property(property_id));
create policy stays_write on public.stays for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

-- visites
create policy visits_select on public.visits for select to authenticated
  using (
    public.is_staff()
    or (public.owns_property(property_id)
        and (status = 'planifiee' or debrief_sent_at is not null))
  );
create policy visits_write on public.visits for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

create policy visit_items_select on public.visit_checklist_items for select to authenticated
  using (public.is_staff() or public.client_can_see_visit(visit_id));
create policy visit_items_write on public.visit_checklist_items for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

-- observations
create policy observations_select on public.observations for select to authenticated
  using (public.is_staff() or (is_shared and public.owns_property(property_id)));
create policy observations_write on public.observations for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

-- interventions
create policy interventions_select on public.interventions for select to authenticated
  using (public.is_staff() or public.owns_property(property_id));
create policy interventions_write on public.interventions for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

-- photos
create policy photos_select on public.photos for select to authenticated
  using (
    public.is_staff()
    or (is_shared
        and public.owns_property(property_id)
        and (visit_id is null or public.client_can_see_visit(visit_id)))
  );
create policy photos_write on public.photos for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

-- demandes client
create policy requests_select on public.client_requests for select to authenticated
  using (public.is_staff() or public.owns_property(property_id));
create policy requests_write on public.client_requests for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

-- documents
create policy documents_select on public.documents for select to authenticated
  using (
    public.is_staff()
    or (visibility = 'client'
        and ((property_id is not null and public.owns_property(property_id))
             or (client_id is not null and client_id in (select public.my_client_ids()))))
  );
create policy documents_write on public.documents for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

-- notifications
create policy notification_templates_select on public.notification_templates for select to authenticated
  using (public.is_staff());
create policy notification_templates_write on public.notification_templates for all to authenticated
  using (public.has_role('super_admin')) with check (public.has_role('super_admin'));

create policy notifications_select on public.notifications for select to authenticated
  using (user_id = (select auth.uid()));
create policy notifications_mark_read on public.notifications for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy push_subscriptions_own on public.push_subscriptions for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- RGPD
create policy consents_select on public.consents for select to authenticated
  using (user_id = (select auth.uid()) or public.is_staff());
create policy consents_insert on public.consents for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy data_requests_select on public.data_requests for select to authenticated
  using (user_id = (select auth.uid()) or public.is_staff());
create policy data_requests_insert on public.data_requests for insert to authenticated
  with check (user_id = (select auth.uid()) and status = 'nouvelle');
create policy data_requests_update on public.data_requests for update to authenticated
  using (public.is_staff()) with check (public.is_staff());

-- journal d’activité : lecture super_admin uniquement
create policy activity_logs_select on public.activity_logs for select to authenticated
  using (public.has_role('super_admin'));

grant select on public.observation_photos to authenticated;
