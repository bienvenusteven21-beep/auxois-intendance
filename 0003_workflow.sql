-- =====================================================================
-- AUXOIS INTENDANCE — 0003 : logique métier
-- Workflow de visite, décisions du propriétaire, interventions,
-- demandes, séjours, notifications, journal d’activité, statistiques.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Formatage français
-- ---------------------------------------------------------------------
create or replace function public.fr_date(p_ts timestamptz)
returns text
language sql stable
set search_path = public
as $$
  select extract(day from (p_ts at time zone 'Europe/Paris'))::int
         || case when extract(day from (p_ts at time zone 'Europe/Paris'))::int = 1 then 'er ' else ' ' end
         || (array['janvier','février','mars','avril','mai','juin','juillet','août',
                   'septembre','octobre','novembre','décembre'])
            [extract(month from (p_ts at time zone 'Europe/Paris'))::int]
         || ' ' || extract(year from (p_ts at time zone 'Europe/Paris'))::int
$$;

create or replace function public.fr_time(p_ts timestamptz)
returns text
language sql stable
set search_path = public
as $$
  select to_char(p_ts at time zone 'Europe/Paris', 'HH24"h"MI')
$$;

create or replace function public.status_label(p_status text)
returns text
language sql immutable
set search_path = public
as $$
  select case p_status
    when 'bon' then 'BON' when 'vigilance' then 'VIGILANCE' when 'urgent' then 'URGENT'
    when 'nouvelle' then 'Nouvelle' when 'vue' then 'Vue' when 'planifiee' then 'Planifiée'
    when 'en_cours' then 'En cours' when 'terminee' then 'Terminée'
    else coalesce(p_status, '') end
$$;

-- ---------------------------------------------------------------------
-- NOTIFICATIONS : création à partir des modèles (table notification_templates)
-- Les lignes créées sont ensuite expédiées (push + email) par l’application.
-- ---------------------------------------------------------------------
create or replace function public.notify(
  p_user_id uuid, p_key text, p_vars jsonb default '{}',
  p_link text default null, p_property_id uuid default null)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  t public.notification_templates%rowtype;
  v_title text; v_body text; k text; v text;
begin
  if p_user_id is null then return; end if;
  select * into t from public.notification_templates where key = p_key;
  if not found or not t.is_enabled then return; end if;
  if not exists (select 1 from public.users where id = p_user_id and is_active) then return; end if;
  v_title := t.title; v_body := t.body;
  for k, v in select * from jsonb_each_text(coalesce(p_vars, '{}')) loop
    v_title := replace(v_title, '{{' || k || '}}', coalesce(v, ''));
    v_body  := replace(v_body,  '{{' || k || '}}', coalesce(v, ''));
  end loop;
  insert into public.notifications
    (user_id, template_key, title, body, link, property_id, send_push, send_email)
  values (p_user_id, p_key, v_title, v_body, p_link, p_property_id, t.send_push, t.send_email);
end;
$$;

create or replace function public.notify_owners(
  p_property_id uuid, p_key text, p_vars jsonb default '{}', p_link text default null)
returns void
language plpgsql security definer
set search_path = public
as $$
declare r record; v_name text;
begin
  select name into v_name from public.properties where id = p_property_id;
  for r in
    select distinct c.user_id
    from public.property_owners po
    join public.clients c on c.id = po.client_id
    where po.property_id = p_property_id and c.user_id is not null
  loop
    perform public.notify(r.user_id, p_key,
      jsonb_build_object('maison', v_name) || coalesce(p_vars, '{}'), p_link, p_property_id);
  end loop;
end;
$$;

create or replace function public.notify_staff(
  p_key text, p_vars jsonb default '{}', p_link text default null, p_property_id uuid default null)
returns void
language plpgsql security definer
set search_path = public
as $$
declare r record; v_name text;
begin
  select name into v_name from public.properties where id = p_property_id;
  for r in
    select id from public.users
    where is_active and role in ('super_admin', 'intendant', 'assistant')
  loop
    perform public.notify(r.id, p_key,
      jsonb_build_object('maison', coalesce(v_name, '')) || coalesce(p_vars, '{}'), p_link, p_property_id);
  end loop;
end;
$$;

create or replace function public.mark_all_notifications_read()
returns void
language sql security definer
set search_path = public
as $$
  update public.notifications set read_at = now()
  where user_id = (select auth.uid()) and read_at is null
$$;

-- ---------------------------------------------------------------------
-- JOURNAL D’ACTIVITÉ
-- ---------------------------------------------------------------------
create or replace function public.log_activity()
returns trigger
language plpgsql security definer
set search_path = public
as $$
declare
  j_new jsonb := case when tg_op <> 'DELETE' then to_jsonb(new) end;
  j_old jsonb := case when tg_op <> 'INSERT' then to_jsonb(old) end;
  j jsonb := coalesce(j_new, j_old);
  meta jsonb := '{}';
begin
  if tg_op = 'UPDATE' and (j_new ->> 'status') is distinct from (j_old ->> 'status') then
    meta := jsonb_build_object('statut_avant', j_old ->> 'status', 'statut_apres', j_new ->> 'status');
  end if;
  insert into public.activity_logs (actor_id, action, entity_type, entity_id, property_id, metadata)
  values (
    (select auth.uid()), lower(tg_op), tg_table_name,
    coalesce(j ->> 'id', j ->> 'property_id', j ->> 'client_id'),
    case when tg_table_name = 'properties' then (j ->> 'id')::uuid
         else nullif(j ->> 'property_id', '')::uuid end,
    meta);
  return null;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array[
    'users', 'clients', 'properties', 'property_owners', 'subscriptions', 'visits',
    'observations', 'interventions', 'client_requests', 'stays', 'documents',
    'partners', 'photos', 'data_requests', 'settings'
  ] loop
    execute format(
      'create trigger log_activity after insert or update or delete on public.%I
         for each row execute function public.log_activity()', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- INFORMATIONS SENSIBLES (clés, codes) : accès tracé, rôles autorisés
-- ---------------------------------------------------------------------
create or replace function public.get_property_secrets(p_property_id uuid)
returns public.property_secrets
language plpgsql security definer
set search_path = public
as $$
declare r public.property_secrets;
begin
  if not public.has_role('super_admin', 'intendant') then
    raise exception 'Accès refusé' using errcode = '42501';
  end if;
  select * into r from public.property_secrets where property_id = p_property_id;
  insert into public.activity_logs (actor_id, action, entity_type, entity_id, property_id)
  values ((select auth.uid()), 'consultation', 'property_secrets', p_property_id::text, p_property_id);
  return r;
end;
$$;

create or replace function public.set_property_secrets(
  p_property_id uuid, p_key_location text, p_key_label text,
  p_alarm_code text, p_gate_code text, p_access_notes text)
returns void
language plpgsql security definer
set search_path = public
as $$
begin
  if not public.has_role('super_admin', 'intendant') then
    raise exception 'Accès refusé' using errcode = '42501';
  end if;
  insert into public.property_secrets
    (property_id, key_location, key_label, alarm_code, gate_code, access_notes)
  values (p_property_id, p_key_location, p_key_label, p_alarm_code, p_gate_code, p_access_notes)
  on conflict (property_id) do update set
    key_location = excluded.key_location, key_label = excluded.key_label,
    alarm_code = excluded.alarm_code, gate_code = excluded.gate_code,
    access_notes = excluded.access_notes;
  insert into public.activity_logs (actor_id, action, entity_type, entity_id, property_id)
  values ((select auth.uid()), 'modification', 'property_secrets', p_property_id::text, p_property_id);
end;
$$;

-- ---------------------------------------------------------------------
-- VISITES
-- ---------------------------------------------------------------------

-- Fréquence de visite effective d’une propriété (visites / an)
create or replace function public.property_visits_per_year(p_property_id uuid)
returns integer
language sql stable security definer
set search_path = public
as $$
  select coalesce(
    (select coalesce(s.visits_per_year_override, p.visits_per_year)
     from public.subscriptions s
     join public.subscription_plans p on p.id = s.plan_id
     where s.property_id = p_property_id and s.status = 'actif'
     limit 1), 12)
$$;

create or replace function public.start_visit(p_visit_id uuid)
returns uuid
language plpgsql security definer
set search_path = public
as $$
declare
  v public.visits%rowtype;
  v_template uuid;
  v_name text;
begin
  if not public.is_staff() then
    raise exception 'Accès refusé' using errcode = '42501';
  end if;
  select * into v from public.visits where id = p_visit_id for update;
  if not found then raise exception 'Visite introuvable'; end if;
  if v.status = 'en_cours' then return v.id; end if;          -- reprise d’une visite
  if v.status <> 'planifiee' then
    raise exception 'Cette visite ne peut pas être démarrée (statut : %)', v.status;
  end if;

  select full_name into v_name from public.users where id = (select auth.uid());
  update public.visits
     set status = 'en_cours', started_at = now(),
         intendant_id = (select auth.uid()), intendant_name = nullif(v_name, '')
   where id = v.id;

  if not exists (select 1 from public.visit_checklist_items where visit_id = v.id) then
    select id into v_template from public.checklist_templates where property_id = v.property_id;
    if v_template is null then
      select id into v_template from public.checklist_templates where is_default limit 1;
    end if;
    insert into public.visit_checklist_items (visit_id, category, label, kind, unit, position)
    select v.id, i.category, i.label, i.kind, i.unit, i.position
    from public.checklist_template_items i
    where i.template_id = v_template
    order by i.position;
  end if;
  return v.id;
end;
$$;

-- Visite non planifiée : créée et démarrée immédiatement
create or replace function public.start_unplanned_visit(p_property_id uuid, p_kind text default 'controle')
returns uuid
language plpgsql security definer
set search_path = public
as $$
declare v_id uuid;
begin
  if not public.is_staff() then
    raise exception 'Accès refusé' using errcode = '42501';
  end if;
  perform set_config('auxois.silent', '1', true);
  insert into public.visits (property_id, kind, scheduled_at)
  values (p_property_id, p_kind, now()) returning id into v_id;
  perform set_config('auxois.silent', '', true);
  return public.start_visit(v_id);
end;
$$;

-- Résumé chiffré d’une visite (écran « Terminer la visite », débrief, PDF)
create or replace function public.visit_summary(p_visit_id uuid)
returns jsonb
language plpgsql stable security definer
set search_path = public
as $$
declare v_staff boolean := public.is_staff();
begin
  if not (v_staff or public.client_can_see_visit(p_visit_id)) then
    raise exception 'Accès refusé' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'points_controles', (select count(*) from public.visit_checklist_items
                         where visit_id = p_visit_id and result in ('ok', 'anomalie')),
    'points_total',     (select count(*) from public.visit_checklist_items where visit_id = p_visit_id),
    'ok',               (select count(*) from public.visit_checklist_items
                         where visit_id = p_visit_id and result = 'ok'),
    'anomalies',        (select count(*) from public.visit_checklist_items
                         where visit_id = p_visit_id and result = 'anomalie'),
    'non_controles',    (select count(*) from public.visit_checklist_items
                         where visit_id = p_visit_id and (result is null or result = 'non_controle')),
    'observations',     (select count(*) from public.observations
                         where visit_id = p_visit_id and (v_staff or is_shared)),
    'interventions_recommandees',
                        (select count(*) from public.observations
                         where visit_id = p_visit_id and (v_staff or is_shared)
                           and level in ('intervention_recommandee', 'urgent')),
    'photos',           (select count(*) from public.photos
                         where visit_id = p_visit_id and (v_staff or is_shared))
  );
end;
$$;

create or replace function public.finish_visit(
  p_visit_id uuid, p_comment text, p_general_status text default 'bon')
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  v public.visits%rowtype;
  v_per_year integer;
  v_next timestamptz;
begin
  if not public.is_staff() then
    raise exception 'Accès refusé' using errcode = '42501';
  end if;
  if p_general_status not in ('bon', 'vigilance', 'urgent') then
    raise exception 'État général invalide';
  end if;
  select * into v from public.visits where id = p_visit_id for update;
  if not found then raise exception 'Visite introuvable'; end if;
  if v.status <> 'en_cours' then
    raise exception 'Seule une visite en cours peut être terminée';
  end if;

  update public.visit_checklist_items
     set result = 'non_controle' where visit_id = v.id and result is null;

  update public.visits
     set status = 'terminee', ended_at = now(),
         intendant_comment = nullif(trim(coalesce(p_comment, '')), ''),
         general_status = p_general_status
   where id = v.id;

  update public.properties set status = p_general_status where id = v.property_id;

  -- Planification automatique de la prochaine visite régulière
  if v.kind = 'reguliere' and not exists (
       select 1 from public.visits
       where property_id = v.property_id and status = 'planifiee'
         and kind = 'reguliere' and scheduled_at > now()) then
    v_per_year := public.property_visits_per_year(v.property_id);
    if 12 % v_per_year = 0 then
      v_next := v.scheduled_at + make_interval(months => 12 / v_per_year);
    else
      v_next := v.scheduled_at + make_interval(days => 365 / v_per_year);
    end if;
    if v_next <= now() then
      v_next := now() + make_interval(days => greatest(365 / v_per_year, 1));
    end if;
    perform set_config('auxois.silent', '1', true);
    insert into public.visits (property_id, kind, scheduled_at)
    values (v.property_id, 'reguliere', v_next);
    perform set_config('auxois.silent', '', true);
  end if;

  return public.visit_summary(v.id);
end;
$$;

-- Envoi du débrief : rend la visite, ses observations et ses photos
-- partageables visibles du propriétaire, puis le notifie.
create or replace function public.send_debrief(p_visit_id uuid)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v public.visits%rowtype;
  o record;
  v_count integer;
  v_obs_text text;
  v_next timestamptz;
begin
  if not public.is_staff() then
    raise exception 'Accès refusé' using errcode = '42501';
  end if;
  select * into v from public.visits where id = p_visit_id for update;
  if not found then raise exception 'Visite introuvable'; end if;
  if v.status <> 'terminee' then
    raise exception 'La visite doit être terminée avant l’envoi du débrief';
  end if;
  if v.debrief_sent_at is not null then
    raise exception 'Le débrief a déjà été envoyé';
  end if;

  update public.visits set debrief_sent_at = now() where id = v.id;

  update public.observations set is_shared = true where visit_id = v.id;
  update public.observations
     set status = 'en_attente_client'
   where visit_id = v.id and status = 'nouveau'
     and level in ('intervention_recommandee', 'urgent');

  select count(*) into v_count from public.observations where visit_id = v.id;
  v_obs_text := case
    when v_count = 0 then 'Aucune observation à signaler.'
    when v_count = 1 then '1 observation a été signalée.'
    else v_count || ' observations ont été signalées.' end;

  select min(scheduled_at) into v_next from public.visits
   where property_id = v.property_id and status = 'planifiee' and scheduled_at > now();

  perform public.notify_owners(v.property_id, 'visite_terminee', jsonb_build_object(
      'date', public.fr_date(v.ended_at),
      'heure', public.fr_time(v.ended_at),
      'etat', public.status_label(v.general_status),
      'pastille', case v.general_status when 'bon' then '🟢' when 'vigilance' then '🟠' else '🔴' end,
      'observations', v_obs_text,
      'prochaine_visite', coalesce(public.fr_date(v_next), 'à planifier')),
    '/client/visites/' || v.id);

  for o in
    select * from public.observations
    where visit_id = v.id and level in ('a_surveiller', 'intervention_recommandee')
    order by created_at
  loop
    if o.level = 'intervention_recommandee' then
      perform public.notify_owners(v.property_id, 'intervention_recommandee',
        jsonb_build_object('titre', o.title, 'detail', coalesce(o.recommended_action, '')),
        '/client/interventions');
    else
      perform public.notify_owners(v.property_id, 'anomalie_creee',
        jsonb_build_object('titre', o.title, 'detail', coalesce(o.description, '')),
        '/client/visites/' || v.id);
    end if;
  end loop;
end;
$$;

-- Notification « prochaine visite prévue » quand l’équipe planifie ou déplace
-- une visite à la main (pas lors des planifications automatiques).
create or replace function public.on_visit_scheduled()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  if coalesce(current_setting('auxois.silent', true), '') = '1' then return null; end if;
  if (select auth.uid()) is null then return null; end if;   -- import / données de démonstration
  if new.status = 'planifiee' and new.scheduled_at > now()
     and (tg_op = 'INSERT' or new.scheduled_at is distinct from old.scheduled_at) then
    perform public.notify_owners(new.property_id, 'prochaine_visite',
      jsonb_build_object('date', public.fr_date(new.scheduled_at),
                         'heure', public.fr_time(new.scheduled_at)),
      '/client');
  end if;
  return null;
end;
$$;

create trigger on_visit_scheduled
  after insert or update of scheduled_at on public.visits
  for each row execute function public.on_visit_scheduled();

-- ---------------------------------------------------------------------
-- OBSERVATIONS
-- ---------------------------------------------------------------------
create or replace function public.on_observation_before()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' and new.created_by is null then
    new.created_by := (select auth.uid());
  end if;
  -- Une urgence est partagée immédiatement, sans attendre le débrief
  if new.level = 'urgent' then
    new.is_shared := true;
  end if;
  if new.status in ('resolu', 'classe_sans_suite') and new.resolved_at is null then
    new.resolved_at := now();
  elsif new.status not in ('resolu', 'classe_sans_suite') then
    new.resolved_at := null;
  end if;
  return new;
end;
$$;

create trigger on_observation_before
  before insert or update on public.observations
  for each row execute function public.on_observation_before();

create or replace function public.on_observation_after()
returns trigger
language plpgsql security definer
set search_path = public
as $$
declare v_open_urgent boolean;
begin
  if new.level = 'urgent' and new.status not in ('resolu', 'classe_sans_suite')
     and (tg_op = 'INSERT' or old.level is distinct from 'urgent') then
    update public.properties set status = 'urgent'
     where id = new.property_id and status <> 'urgent';
    if (select auth.uid()) is not null then
      perform public.notify_owners(new.property_id, 'alerte_urgente',
        jsonb_build_object('titre', new.title, 'detail', coalesce(new.description, '')),
        '/client/interventions');
    end if;
  end if;

  -- Urgence levée : la maison quitte l’état « urgent » s’il n’en reste aucune
  if tg_op = 'UPDATE' and new.level = 'urgent'
     and new.status in ('resolu', 'classe_sans_suite')
     and old.status not in ('resolu', 'classe_sans_suite') then
    select exists (
      select 1 from public.observations
      where property_id = new.property_id and level = 'urgent'
        and status not in ('resolu', 'classe_sans_suite')) into v_open_urgent;
    if not v_open_urgent then
      update public.properties set status = 'vigilance'
       where id = new.property_id and status = 'urgent';
    end if;
  end if;
  return null;
end;
$$;

create trigger on_observation_after
  after insert or update on public.observations
  for each row execute function public.on_observation_after();

-- Décision du propriétaire sur une intervention recommandée.
-- p_decision : 'autorise' | 'contacter_avant' | 'client_gere'
-- L’équipe peut aussi enregistrer la décision reçue par téléphone.
create or replace function public.decide_observation(
  p_observation_id uuid, p_decision text, p_message text default null)
returns uuid
language plpgsql security definer
set search_path = public
as $$
declare
  o public.observations%rowtype;
  v_staff boolean := public.is_staff();
  v_intervention uuid;
  v_client uuid;
  v_who text;
begin
  if p_decision not in ('autorise', 'contacter_avant', 'client_gere') then
    raise exception 'Décision invalide';
  end if;
  select * into o from public.observations where id = p_observation_id for update;
  if not found
     or not (v_staff or (o.is_shared and public.owns_property(o.property_id))) then
    raise exception 'Observation introuvable' using errcode = '42501';
  end if;
  if o.status <> 'en_attente_client' then
    raise exception 'Cette observation n’attend plus de décision';
  end if;

  select id into v_client from public.my_client_ids() as id limit 1;
  select coalesce(nullif(full_name, ''), email, 'Le propriétaire') into v_who
    from public.users where id = (select auth.uid());

  if p_decision = 'autorise' then
    update public.observations
       set status = 'autorise', client_decision = 'autorise',
           client_decision_at = now(), client_decision_by = (select auth.uid())
     where id = o.id;
    select id into v_intervention from public.interventions
     where observation_id = o.id and status <> 'annulee' limit 1;
    if v_intervention is null then
      insert into public.interventions (property_id, observation_id, title, description, created_by)
      values (o.property_id, o.id, o.title,
              coalesce(o.recommended_action, o.description), (select auth.uid()))
      returning id into v_intervention;
    end if;
    perform public.notify_staff('autorisation_recue',
      jsonb_build_object('titre', o.title, 'client', v_who),
      '/admin/interventions/' || v_intervention, o.property_id);

  elsif p_decision = 'contacter_avant' then
    update public.observations
       set client_decision = 'contacter_avant',
           client_decision_at = now(), client_decision_by = (select auth.uid())
     where id = o.id;
    insert into public.client_requests
      (property_id, client_id, created_by, kind, observation_id, subject, message)
    values (o.property_id, v_client, (select auth.uid()), 'contact', o.id,
            'Me contacter avant intervention : ' || o.title, p_message);
    perform public.notify_staff('contact_demande',
      jsonb_build_object('titre', o.title, 'client', v_who),
      '/admin/demandes', o.property_id);

  else
    update public.observations
       set status = 'classe_sans_suite', client_decision = 'client_gere',
           client_decision_at = now(), client_decision_by = (select auth.uid())
     where id = o.id;
    perform public.notify_staff('intervention_refusee',
      jsonb_build_object('titre', o.title, 'client', v_who),
      '/admin/proprietes/' || o.property_id, o.property_id);
  end if;

  return v_intervention;
end;
$$;

-- ---------------------------------------------------------------------
-- INTERVENTIONS
-- ---------------------------------------------------------------------
create or replace function public.on_intervention_before()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' and new.created_by is null then
    new.created_by := (select auth.uid());
  end if;
  if new.partner_id is null then
    new.partner_name := null;
  elsif tg_op = 'INSERT' or new.partner_id is distinct from old.partner_id then
    select company into new.partner_name from public.partners where id = new.partner_id;
  end if;
  if new.status = 'terminee' and new.completed_at is null then
    new.completed_at := now();
  end if;
  return new;
end;
$$;

create trigger on_intervention_before
  before insert or update on public.interventions
  for each row execute function public.on_intervention_before();

create or replace function public.on_intervention_after()
returns trigger
language plpgsql security definer
set search_path = public
as $$
declare
  v_obs_status text;
  v_obs public.observations%rowtype;
  v_changed boolean := tg_op = 'INSERT' or new.status is distinct from old.status;
  v_rescheduled boolean := tg_op = 'UPDATE' and new.status = 'rdv_confirme'
                           and new.scheduled_at is distinct from old.scheduled_at;
begin
  if v_changed and new.observation_id is not null then
    v_obs_status := case new.status
      when 'artisan_contacte' then 'artisan_contacte'
      when 'rdv_confirme'     then 'rdv_prevu'
      when 'en_cours'         then 'intervention_en_cours'
      when 'terminee'         then 'resolu'
      else null end;
    if v_obs_status is not null then
      update public.observations set status = v_obs_status, is_shared = true
       where id = new.observation_id and status is distinct from v_obs_status;
    end if;
  end if;

  if (select auth.uid()) is null then return null; end if;   -- import / démonstration

  if (v_changed or v_rescheduled) and new.status = 'rdv_confirme' then
    perform public.notify_owners(new.property_id, 'rdv_artisan_confirme', jsonb_build_object(
        'titre', new.title,
        'artisan', coalesce(new.partner_name, 'L’artisan'),
        'date', coalesce(public.fr_date(new.scheduled_at), 'date à confirmer'),
        'heure', coalesce(public.fr_time(new.scheduled_at), '')),
      '/client/interventions');
  elsif v_changed and new.status = 'terminee' then
    select * into v_obs from public.observations where id = new.observation_id;
    perform public.notify_owners(new.property_id, 'intervention_terminee', jsonb_build_object(
        'titre', new.title,
        'date_constat', coalesce(public.fr_date(v_obs.observed_at), public.fr_date(new.created_at))),
      '/client/interventions');
  end if;
  return null;
end;
$$;

create trigger on_intervention_after
  after insert or update on public.interventions
  for each row execute function public.on_intervention_after();

-- ---------------------------------------------------------------------
-- DEMANDES CLIENT ET SÉJOURS
-- ---------------------------------------------------------------------
create or replace function public.create_request(
  p_property_id uuid, p_subject text, p_message text default null)
returns uuid
language plpgsql security definer
set search_path = public
as $$
declare v_id uuid; v_client uuid; v_who text;
begin
  if not public.owns_property(p_property_id) then
    raise exception 'Propriété introuvable' using errcode = '42501';
  end if;
  if length(trim(coalesce(p_subject, ''))) = 0 then
    raise exception 'Merci de décrire votre demande';
  end if;
  select c.id, trim(c.first_name || ' ' || c.last_name) into v_client, v_who
    from public.clients c
    join public.property_owners po on po.client_id = c.id and po.property_id = p_property_id
   where c.user_id = (select auth.uid()) limit 1;

  insert into public.client_requests (property_id, client_id, created_by, kind, subject, message)
  values (p_property_id, v_client, (select auth.uid()), 'general',
          left(trim(p_subject), 200), nullif(trim(coalesce(p_message, '')), ''))
  returning id into v_id;

  perform public.notify_staff('nouvelle_demande',
    jsonb_build_object('titre', left(trim(p_subject), 200), 'client', v_who),
    '/admin/demandes/' || v_id, p_property_id);
  return v_id;
end;
$$;

-- « Je viens dans ma maison »
create or replace function public.declare_stay(
  p_property_id uuid, p_arrival_date date, p_arrival_time text,
  p_departure_date date, p_options text[] default '{}', p_message text default null)
returns uuid
language plpgsql security definer
set search_path = public
as $$
declare v_stay uuid; v_req uuid; v_client uuid; v_who text; v_opts text;
begin
  if not public.owns_property(p_property_id) then
    raise exception 'Propriété introuvable' using errcode = '42501';
  end if;
  if p_arrival_date is null or p_departure_date is null then
    raise exception 'Merci d’indiquer vos dates d’arrivée et de départ';
  end if;
  if p_arrival_date < (now() at time zone 'Europe/Paris')::date then
    raise exception 'La date d’arrivée est déjà passée';
  end if;
  if p_departure_date < p_arrival_date then
    raise exception 'La date de départ doit suivre la date d’arrivée';
  end if;

  select c.id, trim(c.first_name || ' ' || c.last_name) into v_client, v_who
    from public.clients c
    join public.property_owners po on po.client_id = c.id and po.property_id = p_property_id
   where c.user_id = (select auth.uid()) limit 1;

  insert into public.stays
    (property_id, client_id, arrival_date, arrival_time, departure_date, options, message)
  values (p_property_id, v_client, p_arrival_date, nullif(trim(coalesce(p_arrival_time, '')), ''),
          p_departure_date, coalesce(p_options, '{}'), nullif(trim(coalesce(p_message, '')), ''))
  returning id into v_stay;

  v_opts := array_to_string(coalesce(p_options, '{}'), ', ');
  insert into public.client_requests
    (property_id, client_id, created_by, kind, stay_id, subject, message)
  values (p_property_id, v_client, (select auth.uid()), 'sejour', v_stay,
          'Séjour du ' || public.fr_date(p_arrival_date::timestamp at time zone 'Europe/Paris')
            || ' au ' || public.fr_date(p_departure_date::timestamp at time zone 'Europe/Paris'),
          nullif(concat_ws(E'\n',
            nullif('Préparatifs souhaités : ' || nullif(v_opts, ''), ''),
            nullif(trim(coalesce(p_message, '')), '')), ''))
  returning id into v_req;

  perform public.notify_staff('sejour_declare', jsonb_build_object(
      'client', v_who,
      'date', public.fr_date(p_arrival_date::timestamp at time zone 'Europe/Paris'),
      'date_depart', public.fr_date(p_departure_date::timestamp at time zone 'Europe/Paris')),
    '/admin/demandes/' || v_req, p_property_id);
  return v_stay;
end;
$$;

-- Suivi des demandes : notification du propriétaire à chaque étape
-- importante, et synchronisation du séjour lié.
create or replace function public.on_request_status()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  if new.status is not distinct from old.status then return null; end if;

  if new.kind = 'sejour' and new.stay_id is not null then
    update public.stays set status = case new.status
        when 'planifiee' then 'preparation_planifiee'
        when 'en_cours'  then 'preparation_planifiee'
        when 'terminee'  then 'pret'
        else status end
     where id = new.stay_id and status not in ('termine', 'annule');
  end if;

  if (select auth.uid()) is null then return null; end if;

  if new.status = 'terminee' and new.kind = 'sejour' then
    perform public.notify_owners(new.property_id, 'sejour_pret',
      jsonb_build_object('titre', new.subject), '/client/demandes');
  elsif new.status = 'terminee' then
    perform public.notify_owners(new.property_id, 'demande_traitee',
      jsonb_build_object('titre', new.subject, 'reponse', coalesce(new.reply, '')),
      '/client/demandes');
  elsif new.status in ('planifiee', 'en_cours') then
    perform public.notify_owners(new.property_id, 'demande_mise_a_jour',
      jsonb_build_object('titre', new.subject, 'statut', lower(public.status_label(new.status))),
      '/client/demandes');
  end if;
  return null;
end;
$$;

create trigger on_request_status
  after update of status on public.client_requests
  for each row execute function public.on_request_status();

-- ---------------------------------------------------------------------
-- DOCUMENTS : notification quand un document est partagé au propriétaire
-- ---------------------------------------------------------------------
create or replace function public.on_document_shared()
returns trigger
language plpgsql security definer
set search_path = public
as $$
declare r record;
begin
  if (select auth.uid()) is null then return null; end if;
  if new.visibility = 'client'
     and (tg_op = 'INSERT' or old.visibility is distinct from 'client') then
    if new.property_id is not null then
      perform public.notify_owners(new.property_id, 'nouveau_document',
        jsonb_build_object('titre', new.title), '/client/documents');
    elsif new.client_id is not null then
      for r in select user_id from public.clients where id = new.client_id and user_id is not null loop
        perform public.notify(r.user_id, 'nouveau_document',
          jsonb_build_object('titre', new.title, 'maison', ''), '/client/documents');
      end loop;
    end if;
  end if;
  return null;
end;
$$;

create trigger on_document_shared
  after insert or update of visibility on public.documents
  for each row execute function public.on_document_shared();

-- ---------------------------------------------------------------------
-- HISTORIQUE : le « carnet de santé » de la maison
-- (security_invoker : les politiques RLS s’appliquent au lecteur)
-- ---------------------------------------------------------------------
create view public.property_timeline
with (security_invoker = true) as
  select v.property_id, v.ended_at as happened_at, 'visite'::text as kind,
         case v.kind when 'preparation' then 'Maison préparée avant arrivée'
                     when 'apres_depart' then 'Contrôle après départ'
                     when 'controle' then 'Visite de contrôle terminée'
                     else 'Visite terminée' end as title,
         v.general_status as detail, v.id as entity_id
    from public.visits v
   where v.status = 'terminee' and v.debrief_sent_at is not null
  union all
  select o.property_id, o.observed_at, 'observation',
         o.title, o.level, o.id
    from public.observations o
   where o.is_shared and o.level <> 'information'
  union all
  select i.property_id, i.completed_at, 'intervention',
         'Intervention terminée : ' || i.title, i.partner_name, i.id
    from public.interventions i
   where i.status = 'terminee'
  union all
  select s.property_id, (s.arrival_date::timestamp at time zone 'Europe/Paris'), 'sejour',
         'Séjour du propriétaire', null, s.id
    from public.stays s
   where s.status <> 'annule' and s.arrival_date <= (now() at time zone 'Europe/Paris')::date;

grant select on public.property_timeline to authenticated;

-- ---------------------------------------------------------------------
-- STATISTIQUES (équipe)
-- ---------------------------------------------------------------------
create or replace function public.admin_stats()
returns jsonb
language plpgsql stable security definer
set search_path = public
as $$
declare
  v_today date := (now() at time zone 'Europe/Paris')::date;
  v_day_start timestamptz := (v_today::timestamp at time zone 'Europe/Paris');
  v_week_start timestamptz := (date_trunc('week', v_today::timestamp) at time zone 'Europe/Paris');
  v_month_start timestamptz := (date_trunc('month', v_today::timestamp) at time zone 'Europe/Paris');
begin
  if not public.is_staff() then
    raise exception 'Accès refusé' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'proprietes_actives', (select count(*) from public.properties where is_active),
    'clients', (select count(*) from public.clients where is_active),
    'nouveaux_clients_mois', (select count(*) from public.clients where created_at >= v_month_start),
    'visites_aujourdhui', (select count(*) from public.visits
        where status in ('planifiee', 'en_cours')
          and scheduled_at >= v_day_start and scheduled_at < v_day_start + interval '1 day'),
    'visites_semaine', (select count(*) from public.visits
        where status in ('planifiee', 'en_cours')
          and scheduled_at >= v_week_start and scheduled_at < v_week_start + interval '7 days'),
    'visites_realisees', (select count(*) from public.visits where status = 'terminee'),
    'visites_realisees_mois', (select count(*) from public.visits
        where status = 'terminee' and ended_at >= v_month_start),
    'duree_moyenne_visite_min', (select round(avg(extract(epoch from (ended_at - started_at)) / 60))
        from public.visits where status = 'terminee' and started_at is not null and ended_at is not null),
    'interventions_ouvertes', (select count(*) from public.interventions
        where status not in ('terminee', 'annulee')),
    'observations_ouvertes', (select count(*) from public.observations
        where status not in ('resolu', 'classe_sans_suite') and level <> 'information'),
    'alertes_urgentes', (select count(*) from public.observations
        where status not in ('resolu', 'classe_sans_suite') and level = 'urgent'),
    'demandes_en_attente', (select count(*) from public.client_requests
        where status in ('nouvelle', 'vue')),
    'demandes_total', (select count(*) from public.client_requests),
    'abonnements', (select coalesce(jsonb_object_agg(code, n), '{}') from (
        select p.code, count(s.id) as n
        from public.subscription_plans p
        left join public.subscriptions s on s.plan_id = p.id and s.status = 'actif'
        group by p.code) x),
    'revenu_mensuel_recurrent', (select coalesce(sum(coalesce(s.monthly_price_override, p.monthly_price)), 0)
        from public.subscriptions s join public.subscription_plans p on p.id = s.plan_id
        where s.status = 'actif')
  );
end;
$$;

-- ---------------------------------------------------------------------
-- RGPD : export des données personnelles de l’utilisateur connecté
-- ---------------------------------------------------------------------
create or replace function public.export_my_data()
returns jsonb
language plpgsql stable security definer
set search_path = public
as $$
declare
  v_uid uuid := (select auth.uid());
  v_props uuid[];
begin
  if v_uid is null then raise exception 'Non connecté' using errcode = '42501'; end if;
  select coalesce(array_agg(distinct po.property_id), '{}') into v_props
    from public.property_owners po where po.client_id in (select public.my_client_ids());
  return jsonb_build_object(
    'exporte_le', now(),
    'compte', (select to_jsonb(u) from public.users u where u.id = v_uid),
    'fiche_client', (select coalesce(jsonb_agg(to_jsonb(c)), '[]') from public.clients c where c.user_id = v_uid),
    'proprietes', (select coalesce(jsonb_agg(to_jsonb(p)), '[]') from public.properties p where p.id = any (v_props)),
    'abonnements', (select coalesce(jsonb_agg(to_jsonb(s)), '[]') from public.subscriptions s where s.property_id = any (v_props)),
    'visites', (select coalesce(jsonb_agg(to_jsonb(v)), '[]') from public.visits v
                 where v.property_id = any (v_props) and v.debrief_sent_at is not null),
    'observations', (select coalesce(jsonb_agg(to_jsonb(o)), '[]') from public.observations o
                 where o.property_id = any (v_props) and o.is_shared),
    'interventions', (select coalesce(jsonb_agg(to_jsonb(i)), '[]') from public.interventions i where i.property_id = any (v_props)),
    'demandes', (select coalesce(jsonb_agg(to_jsonb(r)), '[]') from public.client_requests r where r.property_id = any (v_props)),
    'sejours', (select coalesce(jsonb_agg(to_jsonb(s)), '[]') from public.stays s where s.property_id = any (v_props)),
    'documents', (select coalesce(jsonb_agg(jsonb_build_object('titre', d.title, 'ajoute_le', d.created_at)), '[]')
                 from public.documents d
                 where d.visibility = 'client'
                   and (d.property_id = any (v_props) or d.client_id in (select public.my_client_ids()))),
    'consentements', (select coalesce(jsonb_agg(to_jsonb(c)), '[]') from public.consents c where c.user_id = v_uid),
    'notifications', (select coalesce(jsonb_agg(jsonb_build_object('titre', n.title, 'texte', n.body, 'date', n.created_at)), '[]')
                 from public.notifications n where n.user_id = v_uid)
  );
end;
$$;

-- ---------------------------------------------------------------------
-- Droits d’exécution : uniquement les fonctions destinées à l’application.
-- (notify*, log_activity et les fonctions de déclencheur restent internes.)
-- ---------------------------------------------------------------------
revoke all on all functions in schema public from anon, public, authenticated;
grant execute on all functions in schema public to service_role;
grant execute on function
  public.current_role_name(), public.is_staff(), public.has_role(text[]),
  public.my_client_ids(), public.owns_property(uuid), public.client_can_see_visit(uuid),
  public.fr_date(timestamptz), public.fr_time(timestamptz), public.status_label(text),
  public.mark_all_notifications_read(),
  public.get_property_secrets(uuid),
  public.set_property_secrets(uuid, text, text, text, text, text),
  public.start_visit(uuid), public.start_unplanned_visit(uuid, text),
  public.visit_summary(uuid), public.finish_visit(uuid, text, text),
  public.send_debrief(uuid),
  public.decide_observation(uuid, text, text),
  public.create_request(uuid, text, text),
  public.declare_stay(uuid, date, text, date, text[], text),
  public.admin_stats(), public.export_my_data()
to authenticated;
