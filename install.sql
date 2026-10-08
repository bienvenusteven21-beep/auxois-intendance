-- AUXOIS INTENDANCE — installation complète de la base (toutes les migrations, dans l'ordre).
-- À coller tel quel dans Supabase > SQL Editor, puis « Run ».

-- >>> supabase/migrations/0001_schema.sql
-- =====================================================================
-- AUXOIS INTENDANCE — 0001 : structure de la base de données
-- Toutes les tables vivent dans le schéma "public" et sont protégées
-- par Row Level Security (voir 0002).
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- Utilitaire : mise à jour automatique de updated_at
-- ---------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- UTILISATEURS (profil applicatif lié à auth.users)
-- Rôles : super_admin, intendant, assistant (équipe) / client (propriétaire)
-- ---------------------------------------------------------------------
create table public.users (
  id          uuid primary key references auth.users (id) on delete cascade,
  role        text not null default 'client'
              check (role in ('super_admin', 'intendant', 'assistant', 'client')),
  full_name   text not null default '',
  email       text,
  phone       text,
  language    text not null default 'fr',
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- PARAMÈTRES GÉNÉRAUX (une seule ligne)
-- ---------------------------------------------------------------------
create table public.settings (
  id            boolean primary key default true check (id),
  company_name  text not null default 'Auxois Intendance',
  tagline       text not null default 'Votre maison, suivie toute l’année.',
  phone         text,
  email         text,
  address       text,
  logo_path     text,
  privacy_policy_version text not null default '2026-10',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- FORMULES D’ABONNEMENT
-- ---------------------------------------------------------------------
create table public.subscription_plans (
  id               uuid primary key default gen_random_uuid(),
  code             text not null unique,
  name             text not null,
  monthly_price    numeric(10,2) not null check (monthly_price >= 0),
  visits_per_year  integer not null check (visits_per_year between 1 and 365),
  included_services text[] not null default '{}',
  position         integer not null default 0,
  is_active        boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- CLIENTS (propriétaires)
-- user_id relie la fiche client à son compte de connexion.
-- Les notes internes sont dans une table séparée, invisible du client.
-- ---------------------------------------------------------------------
create table public.clients (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid unique references public.users (id) on delete set null,
  first_name    text not null,
  last_name     text not null,
  phone         text,
  email         text,
  main_address  text,
  preferred_language text not null default 'fr',
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index clients_user_id_idx on public.clients (user_id);

create table public.client_internal_notes (
  client_id   uuid primary key references public.clients (id) on delete cascade,
  notes       text not null default '',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- PROPRIÉTÉS + CARNET MAISON
-- ---------------------------------------------------------------------
create table public.properties (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  address       text,
  postal_code   text,
  commune       text,
  status        text not null default 'bon'
                check (status in ('bon', 'vigilance', 'urgent')),
  -- Carnet Maison (partie consultable par le propriétaire)
  heating_type        text,
  boiler              text,
  electric_meter      text,
  water_meter         text,
  water_valve         text,
  electrical_panel    text,
  internet            text,
  special_equipment   text,
  outbuildings        text,
  pool                text,
  gate                text,
  garden              text,
  usual_tradespeople  text,
  insurer             text,
  useful_contacts     text,
  particular_notes    text,
  cover_photo_path    text,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Informations très sensibles (clés, codes, alarme) : équipe autorisée
-- uniquement, lecture exclusivement via la fonction get_property_secrets()
-- qui journalise chaque consultation.
create table public.property_secrets (
  property_id   uuid primary key references public.properties (id) on delete cascade,
  key_location  text,
  key_label     text,
  alarm_code    text,
  gate_code     text,
  access_notes  text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Plusieurs propriétaires possibles pour une même maison (couple, famille)
create table public.property_owners (
  property_id  uuid not null references public.properties (id) on delete cascade,
  client_id    uuid not null references public.clients (id) on delete cascade,
  is_primary   boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  primary key (property_id, client_id)
);
create index property_owners_client_idx on public.property_owners (client_id);

-- Notes libres sur une propriété ; visibility = 'interne' (équipe) ou 'client'
create table public.property_notes (
  id           uuid primary key default gen_random_uuid(),
  property_id  uuid not null references public.properties (id) on delete cascade,
  visibility   text not null default 'interne' check (visibility in ('interne', 'client')),
  body         text not null,
  author_id    uuid references public.users (id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index property_notes_property_idx on public.property_notes (property_id);

-- ---------------------------------------------------------------------
-- ABONNEMENTS (une formule par propriété ; fréquence modifiable à la main)
-- ---------------------------------------------------------------------
create table public.subscriptions (
  id            uuid primary key default gen_random_uuid(),
  property_id   uuid not null references public.properties (id) on delete cascade,
  plan_id       uuid not null references public.subscription_plans (id),
  status        text not null default 'actif' check (status in ('actif', 'suspendu', 'resilie')),
  started_on    date not null default current_date,
  renewal_on    date,
  visits_per_year_override integer check (visits_per_year_override between 1 and 365),
  monthly_price_override   numeric(10,2) check (monthly_price_override >= 0),
  -- prévu pour la facturation future (Stripe)
  billing_provider    text,
  billing_customer_id text,
  billing_subscription_id text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create unique index subscriptions_one_active_per_property
  on public.subscriptions (property_id) where status = 'actif';

-- ---------------------------------------------------------------------
-- MODÈLES DE CHECKLIST
-- property_id nul = modèle général ; renseigné = modèle propre à la maison
-- ---------------------------------------------------------------------
create table public.checklist_templates (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  property_id  uuid unique references public.properties (id) on delete cascade,
  is_default   boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create unique index checklist_templates_one_default
  on public.checklist_templates (is_default) where is_default;

create table public.checklist_template_items (
  id           uuid primary key default gen_random_uuid(),
  template_id  uuid not null references public.checklist_templates (id) on delete cascade,
  category     text not null,
  label        text not null,
  kind         text not null default 'check' check (kind in ('check', 'number')),
  unit         text,
  position     integer not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index checklist_template_items_tpl_idx on public.checklist_template_items (template_id, position);

-- ---------------------------------------------------------------------
-- PARTENAIRES / ARTISANS (équipe uniquement)
-- ---------------------------------------------------------------------
create table public.partners (
  id            uuid primary key default gen_random_uuid(),
  company       text not null,
  trade         text not null,
  contact_name  text,
  phone         text,
  email         text,
  zone          text,
  internal_notes text,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- SÉJOURS (« Je viens dans ma maison »)
-- ---------------------------------------------------------------------
create table public.stays (
  id              uuid primary key default gen_random_uuid(),
  property_id     uuid not null references public.properties (id) on delete cascade,
  client_id       uuid references public.clients (id) on delete set null,
  arrival_date    date not null,
  arrival_time    text,
  departure_date  date not null,
  options         text[] not null default '{}',
  message         text,
  status          text not null default 'declare'
                  check (status in ('declare', 'preparation_planifiee', 'pret', 'termine', 'annule')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  check (departure_date >= arrival_date)
);
create index stays_property_idx on public.stays (property_id, arrival_date);

-- ---------------------------------------------------------------------
-- VISITES
-- ---------------------------------------------------------------------
create table public.visits (
  id              uuid primary key default gen_random_uuid(),
  property_id     uuid not null references public.properties (id) on delete cascade,
  kind            text not null default 'reguliere'
                  check (kind in ('reguliere', 'preparation', 'controle', 'apres_depart')),
  stay_id         uuid references public.stays (id) on delete set null,
  scheduled_at    timestamptz not null,
  started_at      timestamptz,
  ended_at        timestamptz,
  intendant_id    uuid references public.users (id) on delete set null,
  intendant_name  text,
  status          text not null default 'planifiee'
                  check (status in ('planifiee', 'en_cours', 'terminee', 'annulee')),
  general_status  text check (general_status in ('bon', 'vigilance', 'urgent')),
  intendant_comment text,
  indoor_temperature numeric(4,1),
  mail_count      integer,
  debrief_sent_at timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index visits_property_idx on public.visits (property_id, scheduled_at desc);
create index visits_scheduled_idx on public.visits (scheduled_at);

create table public.visit_checklist_items (
  id            uuid primary key default gen_random_uuid(),
  visit_id      uuid not null references public.visits (id) on delete cascade,
  category      text not null,
  label         text not null,
  kind          text not null default 'check' check (kind in ('check', 'number')),
  unit          text,
  position      integer not null default 0,
  result        text check (result in ('ok', 'anomalie', 'non_controle')),
  value_number  numeric(10,2),
  note          text,
  checked_at    timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index visit_checklist_items_visit_idx on public.visit_checklist_items (visit_id, position);

-- ---------------------------------------------------------------------
-- OBSERVATIONS / PROBLÈMES
-- is_shared = visible par le propriétaire (à l’envoi du débrief, ou
-- immédiatement pour une urgence).
-- ---------------------------------------------------------------------
create table public.observations (
  id            uuid primary key default gen_random_uuid(),
  property_id   uuid not null references public.properties (id) on delete cascade,
  visit_id      uuid references public.visits (id) on delete set null,
  checklist_item_id uuid references public.visit_checklist_items (id) on delete set null,
  title         text not null,
  description   text,
  level         text not null default 'information'
                check (level in ('information', 'a_surveiller', 'intervention_recommandee', 'urgent')),
  recommended_action text,
  estimate_min  numeric(10,2),
  estimate_max  numeric(10,2),
  status        text not null default 'nouveau'
                check (status in ('nouveau', 'en_attente_client', 'autorise', 'artisan_contacte',
                                  'rdv_prevu', 'intervention_en_cours', 'resolu', 'classe_sans_suite')),
  client_decision text check (client_decision in ('autorise', 'contacter_avant', 'client_gere')),
  client_decision_at timestamptz,
  client_decision_by uuid references public.users (id) on delete set null,
  is_shared     boolean not null default false,
  observed_at   timestamptz not null default now(),
  resolved_at   timestamptz,
  created_by    uuid references public.users (id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index observations_property_idx on public.observations (property_id, observed_at desc);
create index observations_visit_idx on public.observations (visit_id);

-- ---------------------------------------------------------------------
-- INTERVENTIONS
-- partner_name est recopié depuis la fiche partenaire : le propriétaire
-- voit le nom de l’artisan sans avoir accès à la base partenaires.
-- ---------------------------------------------------------------------
create table public.interventions (
  id              uuid primary key default gen_random_uuid(),
  property_id     uuid not null references public.properties (id) on delete cascade,
  observation_id  uuid references public.observations (id) on delete set null,
  partner_id      uuid references public.partners (id) on delete set null,
  partner_name    text,
  title           text not null,
  description     text,
  scheduled_at    timestamptz,
  status          text not null default 'a_planifier'
                  check (status in ('a_planifier', 'artisan_contacte', 'rdv_confirme',
                                    'en_cours', 'terminee', 'annulee')),
  report          text,
  final_cost      numeric(10,2),
  completed_at    timestamptz,
  created_by      uuid references public.users (id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index interventions_property_idx on public.interventions (property_id, created_at desc);
create index interventions_scheduled_idx on public.interventions (scheduled_at);

-- ---------------------------------------------------------------------
-- PHOTOS (visite, observation, intervention avant / après)
-- La table demandée « observation_photos » est couverte par cette table
-- unique : une photo d’observation porte un observation_id.
-- ---------------------------------------------------------------------
create table public.photos (
  id              uuid primary key default gen_random_uuid(),
  property_id     uuid not null references public.properties (id) on delete cascade,
  visit_id        uuid references public.visits (id) on delete cascade,
  observation_id  uuid references public.observations (id) on delete set null,
  intervention_id uuid references public.interventions (id) on delete set null,
  phase           text check (phase in ('avant', 'apres')),
  category        text,
  caption         text,
  storage_path    text not null unique,
  is_shared       boolean not null default true,
  taken_at        timestamptz not null default now(),
  uploaded_by     uuid references public.users (id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index photos_property_idx on public.photos (property_id, taken_at desc);
create index photos_visit_idx on public.photos (visit_id);
create index photos_observation_idx on public.photos (observation_id);
create index photos_intervention_idx on public.photos (intervention_id);

create view public.observation_photos
with (security_invoker = true) as
  select * from public.photos where observation_id is not null;

-- ---------------------------------------------------------------------
-- DEMANDES CLIENT
-- ---------------------------------------------------------------------
create table public.client_requests (
  id            uuid primary key default gen_random_uuid(),
  property_id   uuid not null references public.properties (id) on delete cascade,
  client_id     uuid references public.clients (id) on delete set null,
  created_by    uuid references public.users (id) on delete set null,
  kind          text not null default 'general' check (kind in ('general', 'sejour', 'contact')),
  stay_id       uuid references public.stays (id) on delete set null,
  observation_id uuid references public.observations (id) on delete set null,
  subject       text not null,
  message       text,
  status        text not null default 'nouvelle'
                check (status in ('nouvelle', 'vue', 'planifiee', 'en_cours', 'terminee')),
  planned_for   timestamptz,
  reply         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index client_requests_property_idx on public.client_requests (property_id, created_at desc);
create index client_requests_status_idx on public.client_requests (status);

-- ---------------------------------------------------------------------
-- TÂCHES INTERNES (calendrier administrateur)
-- ---------------------------------------------------------------------
create table public.internal_tasks (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,
  notes         text,
  due_at        timestamptz not null,
  property_id   uuid references public.properties (id) on delete cascade,
  assigned_to   uuid references public.users (id) on delete set null,
  is_done       boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- DOCUMENTS
-- ---------------------------------------------------------------------
create table public.document_categories (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  position    integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.documents (
  id              uuid primary key default gen_random_uuid(),
  property_id     uuid references public.properties (id) on delete cascade,
  client_id       uuid references public.clients (id) on delete cascade,
  visit_id        uuid references public.visits (id) on delete set null,
  intervention_id uuid references public.interventions (id) on delete set null,
  category_id     uuid references public.document_categories (id) on delete set null,
  title           text not null,
  storage_path    text not null unique,
  mime_type       text,
  size_bytes      bigint,
  visibility      text not null default 'interne' check (visibility in ('interne', 'client')),
  uploaded_by     uuid references public.users (id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  check (property_id is not null or client_id is not null)
);
create index documents_property_idx on public.documents (property_id, created_at desc);
create index documents_client_idx on public.documents (client_id);

-- ---------------------------------------------------------------------
-- NOTIFICATIONS
-- ---------------------------------------------------------------------
create table public.notification_templates (
  key         text primary key,
  audience    text not null check (audience in ('client', 'equipe')),
  label       text not null,
  title       text not null,
  body        text not null,
  send_push   boolean not null default true,
  send_email  boolean not null default true,
  is_enabled  boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.notifications (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.users (id) on delete cascade,
  template_key  text,
  title         text not null,
  body          text not null,
  link          text,
  property_id   uuid references public.properties (id) on delete cascade,
  send_push     boolean not null default true,
  send_email    boolean not null default true,
  read_at       timestamptz,
  delivered_at  timestamptz,
  delivery_error text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);
create index notifications_pending_idx on public.notifications (created_at) where delivered_at is null;

create table public.push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.users (id) on delete cascade,
  endpoint    text not null unique,
  p256dh      text not null,
  auth        text not null,
  user_agent  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index push_subscriptions_user_idx on public.push_subscriptions (user_id);

-- ---------------------------------------------------------------------
-- RGPD : consentements et demandes d’export / suppression
-- ---------------------------------------------------------------------
create table public.consents (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.users (id) on delete cascade,
  policy_version  text not null,
  accepted_at     timestamptz not null default now(),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (user_id, policy_version)
);

create table public.data_requests (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.users (id) on delete cascade,
  kind        text not null check (kind in ('export', 'suppression')),
  status      text not null default 'nouvelle' check (status in ('nouvelle', 'en_cours', 'traitee')),
  message     text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- JOURNAL D’ACTIVITÉ (écriture uniquement par les déclencheurs)
-- ---------------------------------------------------------------------
create table public.activity_logs (
  id           bigint generated always as identity primary key,
  actor_id     uuid,
  action       text not null,
  entity_type  text not null,
  entity_id    text,
  property_id  uuid,
  metadata     jsonb not null default '{}',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index activity_logs_created_idx on public.activity_logs (created_at desc);
create index activity_logs_entity_idx on public.activity_logs (entity_type, entity_id);

-- ---------------------------------------------------------------------
-- updated_at automatique sur toutes les tables
-- ---------------------------------------------------------------------
do $$
declare t record;
begin
  for t in
    select c.table_name
    from information_schema.columns c
    join information_schema.tables tb
      on tb.table_schema = c.table_schema and tb.table_name = c.table_name
    where c.table_schema = 'public' and c.column_name = 'updated_at'
      and tb.table_type = 'BASE TABLE'
  loop
    execute format(
      'create trigger set_updated_at before update on public.%I
         for each row execute function public.set_updated_at()', t.table_name);
  end loop;
end $$;

-- >>> supabase/migrations/0002_security.sql
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

-- >>> supabase/migrations/0003_workflow.sql
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

-- >>> supabase/migrations/0004_storage.sql
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

-- >>> supabase/migrations/0005_reference_data.sql
-- =====================================================================
-- AUXOIS INTENDANCE — 0005 : données de référence
-- Formules, checklist par défaut, modèles de notifications, catégories.
-- Tout est modifiable ensuite depuis Paramètres.
-- =====================================================================

insert into public.settings (id, company_name, tagline, address)
values (true, 'Auxois Intendance', 'Votre maison, suivie toute l’année.', 'Semur-en-Auxois (21140)')
on conflict (id) do nothing;

insert into public.subscription_plans (code, name, monthly_price, visits_per_year, position, included_services)
values
  ('essentiel', 'Essentiel', 69, 6, 1, array[
     '6 visites de contrôle par an',
     'Débrief avec photos après chaque visite',
     'Carnet de santé numérique de la maison',
     'Relevé du courrier',
     'Signalement immédiat des anomalies']),
  ('serenite', 'Sérénité', 129, 12, 2, array[
     '12 visites de contrôle par an',
     'Débrief avec photos après chaque visite',
     'Carnet de santé numérique de la maison',
     'Relevé du courrier',
     'Organisation et suivi des interventions d’artisans',
     'Préparation de la maison avant votre arrivée']),
  ('signature', 'Signature', 229, 24, 3, array[
     '24 visites de contrôle par an',
     'Débrief avec photos après chaque visite',
     'Carnet de santé numérique de la maison',
     'Relevé du courrier',
     'Organisation et suivi des interventions d’artisans',
     'Préparation de la maison avant votre arrivée',
     'Accueil de vos artisans et livraisons',
     'Demandes prioritaires'])
on conflict (code) do nothing;

insert into public.document_categories (name, position)
values ('Contrat Auxois Intendance', 1), ('Facture', 2), ('Devis', 3), ('Facture artisan', 4),
       ('Rapport de visite', 5), ('Document de la propriété', 6), ('Notice', 7), ('Diagnostic', 8)
on conflict (name) do nothing;

-- Checklist par défaut ---------------------------------------------------
do $$
declare v_tpl uuid;
begin
  if exists (select 1 from public.checklist_templates where is_default) then return; end if;
  insert into public.checklist_templates (name, is_default)
  values ('Checklist standard', true) returning id into v_tpl;

  insert into public.checklist_template_items (template_id, category, label, kind, unit, position)
  select v_tpl, x.category, x.label, x.kind, x.unit, x.ord::int * 10
  from (values
    (1, 'Accès', 'Portail', 'check', null),
    (2, 'Accès', 'Porte principale', 'check', null),
    (3, 'Accès', 'Fenêtres et volets', 'check', null),
    (4, 'Accès', 'Traces d’effraction visibles', 'check', null),
    (5, 'Eau', 'Fuite visible', 'check', null),
    (6, 'Eau', 'Sanitaires', 'check', null),
    (7, 'Eau', 'Robinetterie', 'check', null),
    (8, 'Eau', 'Chauffe-eau', 'check', null),
    (9, 'Chauffage', 'Chauffage fonctionne', 'check', null),
    (10, 'Chauffage', 'Température intérieure', 'number', '°C'),
    (11, 'Électricité', 'Électricité OK', 'check', null),
    (12, 'Électricité', 'Tableau électrique', 'check', null),
    (13, 'Électricité', 'Coupure visible', 'check', null),
    (14, 'Humidité', 'Odeur inhabituelle', 'check', null),
    (15, 'Humidité', 'Traces d’humidité', 'check', null),
    (16, 'Humidité', 'Moisissure visible', 'check', null),
    (17, 'Cuisine', 'Réfrigérateur', 'check', null),
    (18, 'Cuisine', 'Congélateur', 'check', null),
    (19, 'Cuisine', 'Électroménager visible', 'check', null),
    (20, 'Extérieurs', 'Jardin', 'check', null),
    (21, 'Extérieurs', 'Terrasse', 'check', null),
    (22, 'Extérieurs', 'Toiture : contrôle visuel uniquement', 'check', null),
    (23, 'Extérieurs', 'Dépendances', 'check', null),
    (24, 'Courrier', 'Courrier relevé', 'check', null),
    (25, 'Courrier', 'Nombre de courriers', 'number', 'courrier(s)')
  ) as x(ord, category, label, kind, unit);
end $$;

-- Modèles de notifications -------------------------------------------------
-- Variables disponibles entre doubles accolades, par ex. {{maison}}.
insert into public.notification_templates (key, audience, label, title, body) values
  ('visite_terminee', 'client', 'Visite terminée',
   '🔑 Auxois Intendance est passé chez vous',
   'Votre propriété {{maison}} a été contrôlée le {{date}} à {{heure}}. État général : {{pastille}} {{etat}}. {{observations}}'),
  ('anomalie_creee', 'client', 'Point à surveiller',
   'Un point est à surveiller — {{maison}}',
   '{{titre}}. {{detail}}'),
  ('intervention_recommandee', 'client', 'Intervention recommandée (autorisation nécessaire)',
   'Intervention recommandée — {{maison}}',
   '{{titre}}. {{detail}} Votre accord est nécessaire pour organiser l’intervention.'),
  ('alerte_urgente', 'client', 'Alerte urgente',
   '🔴 Urgent — {{maison}}',
   '{{titre}}. {{detail}} Auxois Intendance s’en occupe et vous tient informé.'),
  ('rdv_artisan_confirme', 'client', 'Rendez-vous artisan confirmé',
   'Rendez-vous confirmé — {{maison}}',
   '{{artisan}} interviendra le {{date}} à {{heure}} : {{titre}}.'),
  ('intervention_terminee', 'client', 'Intervention terminée',
   '✅ Intervention terminée — {{maison}}',
   'Le problème constaté le {{date_constat}} a été résolu : {{titre}}.'),
  ('demande_mise_a_jour', 'client', 'Demande mise à jour',
   'Votre demande avance',
   '« {{titre}} » est maintenant {{statut}}.'),
  ('demande_traitee', 'client', 'Demande traitée',
   '✅ Votre demande a été traitée',
   '« {{titre}} ». {{reponse}}'),
  ('sejour_pret', 'client', 'Préparation de séjour terminée',
   '🏠 Votre maison est prête',
   '{{maison}} est prête pour votre arrivée. Bon séjour !'),
  ('prochaine_visite', 'client', 'Prochaine visite prévue',
   'Prochaine visite prévue — {{maison}}',
   'Nous passerons le {{date}} vers {{heure}}.'),
  ('nouveau_document', 'client', 'Nouveau document',
   'Nouveau document disponible',
   '« {{titre}} » a été ajouté à votre espace.'),
  ('nouvelle_demande', 'equipe', 'Nouvelle demande client',
   'Nouvelle demande — {{maison}}',
   '{{client}} : « {{titre}} »'),
  ('autorisation_recue', 'equipe', 'Autorisation reçue',
   '✅ Intervention autorisée — {{maison}}',
   '{{client}} autorise l’intervention : {{titre}}.'),
  ('contact_demande', 'equipe', 'Le client souhaite être contacté',
   '📞 À rappeler — {{maison}}',
   '{{client}} souhaite être contacté avant l’intervention : {{titre}}.'),
  ('intervention_refusee', 'equipe', 'Intervention refusée par le client',
   'Intervention déclinée — {{maison}}',
   '{{client}} s’en occupe lui-même : {{titre}}.'),
  ('sejour_declare', 'equipe', 'Séjour déclaré',
   '🏠 Séjour annoncé — {{maison}}',
   '{{client}} arrive le {{date}} et repart le {{date_depart}}.')
on conflict (key) do nothing;

-- >>> supabase/migrations/0006_demo_data.sql
-- =====================================================================
-- AUXOIS INTENDANCE — 0006 : données de démonstration
--
--   select public.seed_demo('<id admin>', '<id du compte de Jean Martin>');
--   select public.remove_demo();      -- avant de passer en production
--
-- Ces fonctions ne sont appelables que côté serveur (clé de service) :
-- l’assistant d’installation de l’application s’en charge.
-- Tous les identifiants de démonstration commencent par « d0 ».
-- =====================================================================

create or replace function public.seed_demo(p_admin_id uuid, p_client_user_id uuid default null)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  -- identifiants fixes
  c_martin   constant uuid := 'd0000000-0000-4000-8000-000000000001';
  c_dupont_c constant uuid := 'd0000000-0000-4000-8000-000000000002';
  c_dupont_p constant uuid := 'd0000000-0000-4000-8000-000000000003';
  c_rousseau constant uuid := 'd0000000-0000-4000-8000-000000000004';
  p_semur    constant uuid := 'd0000000-0000-4000-8000-000000000011';
  p_epoisses constant uuid := 'd0000000-0000-4000-8000-000000000012';
  p_flavigny constant uuid := 'd0000000-0000-4000-8000-000000000013';
  a_plombier constant uuid := 'd0000000-0000-4000-8000-000000000021';
  a_elec     constant uuid := 'd0000000-0000-4000-8000-000000000022';
  a_chauff   constant uuid := 'd0000000-0000-4000-8000-000000000023';
  a_jardin   constant uuid := 'd0000000-0000-4000-8000-000000000024';
  a_piscine  constant uuid := 'd0000000-0000-4000-8000-000000000025';
  a_menage   constant uuid := 'd0000000-0000-4000-8000-000000000026';
  a_serrure  constant uuid := 'd0000000-0000-4000-8000-000000000027';
  v_last     constant uuid := 'd0000000-0000-4000-8000-000000000101';   -- visite du 8 octobre
  v_prep     constant uuid := 'd0000000-0000-4000-8000-000000000102';
  v_sept     constant uuid := 'd0000000-0000-4000-8000-000000000103';
  v_aout     constant uuid := 'd0000000-0000-4000-8000-000000000104';
  o_wc       constant uuid := 'd0000000-0000-4000-8000-000000000201';
  o_robinet  constant uuid := 'd0000000-0000-4000-8000-000000000202';
  o_cave     constant uuid := 'd0000000-0000-4000-8000-000000000203';
  o_gouttiere constant uuid := 'd0000000-0000-4000-8000-000000000204';
  i_robinet  constant uuid := 'd0000000-0000-4000-8000-000000000301';
  i_piscine  constant uuid := 'd0000000-0000-4000-8000-000000000302';
  s_martin   constant uuid := 'd0000000-0000-4000-8000-000000000401';
  s_dupont   constant uuid := 'd0000000-0000-4000-8000-000000000402';

  v_today  date := (now() at time zone 'Europe/Paris')::date;
  v_anchor date;            -- jour de la dernière visite chez M. Martin
  v_tpl uuid; v_tpl_pool uuid;
  v_plan_ess uuid; v_plan_ser uuid; v_plan_sig uuid;
  v_cat_contrat uuid; v_cat_facture_art uuid; v_cat_notice uuid;
  v_admin_name text;
  v_id uuid; v_ts timestamptz; n integer; r record;
begin
  if exists (select 1 from public.properties where id = p_semur) then
    raise exception 'Les données de démonstration sont déjà installées';
  end if;
  if not exists (select 1 from public.users where id = p_admin_id
                 and role in ('super_admin', 'intendant')) then
    raise exception 'Compte administrateur introuvable';
  end if;

  -- Dates conformes au cahier des charges (8 octobre 2026) tant qu’elles
  -- restent cohérentes ; sinon l’historique est recalé sur la veille.
  if v_today between date '2026-10-08' and date '2026-11-07' then
    v_anchor := date '2026-10-08';
  else
    v_anchor := v_today - 1;
  end if;

  select coalesce(nullif(full_name, ''), 'Auxois Intendance') into v_admin_name
    from public.users where id = p_admin_id;
  select id into v_plan_ess from public.subscription_plans where code = 'essentiel';
  select id into v_plan_ser from public.subscription_plans where code = 'serenite';
  select id into v_plan_sig from public.subscription_plans where code = 'signature';
  select id into v_tpl from public.checklist_templates where is_default;
  select id into v_cat_contrat from public.document_categories where name = 'Contrat Auxois Intendance';
  select id into v_cat_facture_art from public.document_categories where name = 'Facture artisan';
  select id into v_cat_notice from public.document_categories where name = 'Notice';

  perform set_config('auxois.silent', '1', true);

  -- CLIENTS ---------------------------------------------------------------
  insert into public.clients (id, user_id, first_name, last_name, phone, email, main_address, created_at) values
    (c_martin, p_client_user_id, 'Jean', 'Martin', '06 39 98 01 01', 'jean.martin@exemple.fr',
       '14 rue des Lilas, 75011 Paris', v_anchor - 340),
    (c_dupont_c, null, 'Claire', 'Dupont', '06 39 98 02 02', 'claire.dupont@exemple.fr',
       '8 quai Saint-Antoine, 69002 Lyon', v_anchor - 210),
    (c_dupont_p, null, 'Philippe', 'Dupont', '06 39 98 03 03', 'philippe.dupont@exemple.fr',
       '8 quai Saint-Antoine, 69002 Lyon', v_anchor - 210),
    (c_rousseau, null, 'Hélène', 'Rousseau', '06 39 98 04 04', 'helene.rousseau@exemple.fr',
       '22 avenue Louise, 1050 Bruxelles', v_today - 12);

  insert into public.client_internal_notes (client_id, notes) values
    (c_martin, 'Préfère être prévenu par téléphone pour tout devis supérieur à 300 €. Vient surtout aux vacances scolaires.'),
    (c_dupont_c, 'Interlocutrice principale du couple. Très attentive au jardin et à la piscine.');

  -- PROPRIÉTÉS --------------------------------------------------------------
  insert into public.properties
    (id, name, address, postal_code, commune, status, heating_type, boiler, electric_meter,
     water_meter, water_valve, electrical_panel, internet, special_equipment, outbuildings,
     pool, gate, garden, usual_tradespeople, insurer, useful_contacts, particular_notes,
     cover_photo_path, created_at)
  values
    (p_semur, 'Maison de Semur', '5 rue du Rempart', '21140', 'Semur-en-Auxois', 'bon',
     'Chauffage central au gaz + poêle à bois dans le séjour',
     'Chaudière gaz à condensation (2019), dans la buanderie',
     'Compteur Linky dans l’entrée, à gauche de la porte',
     'Compteur d’eau dans le regard devant le portail',
     'Vanne d’arrêt générale dans la cave, au pied de l’escalier',
     'Tableau électrique dans la buanderie',
     'Box fibre dans le bureau du rez-de-chaussée',
     'Adoucisseur d’eau dans la cave',
     'Remise à bois au fond du jardin',
     null,
     'Portail manuel, deux vantaux',
     'Jardin clos de 400 m², deux pommiers, rosiers',
     'Dupont Plomberie · Auxois Chauffage Service',
     'Assurance habitation — contrat résidence secondaire',
     'Voisine : Mme Bernard, au n° 7',
     'Hors gel réglé à 12 °C en hiver. Volets de l’étage à laisser fermés.',
     p_semur || '/demo-facade.svg', v_anchor - 340),
    (p_epoisses, 'Le Clos d’Époisses', '3 chemin du Château', '21460', 'Époisses', 'bon',
     'Pompe à chaleur air-eau + plancher chauffant',
     'Pompe à chaleur (2022), local technique',
     'Compteur Linky en limite de propriété',
     'Compteur d’eau dans le local technique',
     'Vanne générale dans le local technique, poignée rouge',
     'Tableau principal dans le cellier, tableau secondaire au pool-house',
     'Box fibre dans le salon, répéteur à l’étage',
     'Alarme reliée, arrosage automatique',
     'Pool-house, garage double',
     'Piscine 10 × 4 m, volet roulant, local technique attenant',
     'Portail motorisé, télécommande au bureau',
     'Parc arboré de 2 500 m², entretenu toutes les deux semaines',
     'Bleu Bourgogne Piscines · Jardins de l’Armançon',
     'Assurance habitation — contrat propriété de caractère',
     'Gardien du château voisin : M. Lefèvre',
     'Hivernage de la piscine mi-octobre. Alarme à réactiver à chaque départ.',
     p_epoisses || '/demo-facade.svg', v_anchor - 210),
    (p_flavigny, 'La Grange de Flavigny', '11 rue de l’Abbaye', '21150', 'Flavigny-sur-Ozerain', 'vigilance',
     'Radiateurs électriques + insert bois',
     null,
     'Compteur Linky dans le garage',
     'Compteur d’eau sous l’évier de la cuisine',
     'Vanne d’arrêt sous l’évier de la cuisine',
     'Tableau électrique dans le garage',
     'Pas d’abonnement internet',
     null,
     'Garage, ancien four à pain',
     null,
     'Portillon en bois',
     'Cour pavée et petit verger',
     null,
     'Assurance habitation — contrat résidence secondaire',
     null,
     'Maison ancienne : surveiller la gouttière côté rue après chaque épisode de pluie.',
     p_flavigny || '/demo-facade.svg', v_today - 12);

  insert into public.property_owners (property_id, client_id, is_primary) values
    (p_semur, c_martin, true),
    (p_epoisses, c_dupont_c, true),
    (p_epoisses, c_dupont_p, false),
    (p_flavigny, c_rousseau, true);

  insert into public.property_secrets (property_id, key_location, key_label, alarm_code, gate_code, access_notes) values
    (p_semur, 'Armoire à clés du bureau, crochet 12', 'Trousseau n° 12 (3 clés)', null, null,
       'Clé de la remise sur le même trousseau.'),
    (p_epoisses, 'Armoire à clés du bureau, crochet 7', 'Trousseau n° 7 (5 clés + télécommande)',
       'DÉMO-4821', 'DÉMO-1905', 'Désactiver l’alarme dans les 30 secondes, boîtier à droite de l’entrée.'),
    (p_flavigny, 'Armoire à clés du bureau, crochet 15', 'Trousseau n° 15 (2 clés)', null, null, null);

  insert into public.property_notes (property_id, visibility, body, author_id) values
    (p_semur, 'interne', 'La serrure du portail accroche : soulever légèrement le vantail gauche.', p_admin_id),
    (p_semur, 'client', 'Le bois de chauffage est rangé dans la remise, côté droit.', p_admin_id);

  insert into public.subscriptions (property_id, plan_id, started_on, renewal_on) values
    (p_semur, v_plan_ser, v_anchor - 340, (v_anchor - 340) + interval '1 year'),
    (p_epoisses, v_plan_sig, v_anchor - 210, (v_anchor - 210) + interval '1 year'),
    (p_flavigny, v_plan_ess, v_today - 12, (v_today - 12) + interval '1 year');

  -- Checklist personnalisée : maison avec piscine
  insert into public.checklist_templates (name, property_id)
  values ('Checklist Le Clos d’Époisses (piscine)', p_epoisses) returning id into v_tpl_pool;
  insert into public.checklist_template_items (template_id, category, label, kind, unit, position)
  select v_tpl_pool, category, label, kind, unit, position
    from public.checklist_template_items where template_id = v_tpl;
  insert into public.checklist_template_items (template_id, category, label, kind, unit, position) values
    (v_tpl_pool, 'Piscine', 'Niveau d’eau', 'check', null, 300),
    (v_tpl_pool, 'Piscine', 'Volet roulant', 'check', null, 310),
    (v_tpl_pool, 'Piscine', 'Local technique et filtration', 'check', null, 320),
    (v_tpl_pool, 'Piscine', 'Alarme', 'check', null, 330);

  -- PARTENAIRES -------------------------------------------------------------
  insert into public.partners (id, company, trade, contact_name, phone, email, zone, internal_notes) values
    (a_plombier, 'Dupont Plomberie', 'Plombier', 'Marc', '03 53 01 10 10', 'contact@dupont-plomberie.exemple',
       'Semur-en-Auxois et 20 km', 'Très réactif, intervient souvent sous 48 h.'),
    (a_elec, 'Électricité Morvan', 'Électricien', 'Sophie', '03 53 01 20 20', 'contact@electricite-morvan.exemple',
       'Auxois – Morvan', null),
    (a_chauff, 'Auxois Chauffage Service', 'Chauffagiste', 'Julien', '03 53 01 30 30', 'sav@auxois-chauffage.exemple',
       'Semur-en-Auxois, Montbard', 'Contrats d’entretien annuels des chaudières.'),
    (a_jardin, 'Jardins de l’Armançon', 'Paysagiste', 'Thomas', '03 53 01 40 40', 'bonjour@jardins-armancon.exemple',
       'Vallée de l’Armançon', null),
    (a_piscine, 'Bleu Bourgogne Piscines', 'Pisciniste', 'Nadia', '03 53 01 50 50', 'contact@bleu-bourgogne.exemple',
       'Côte-d’Or', 'Hivernage et remise en route.'),
    (a_menage, 'Clair Logis', 'Ménage', 'Isabelle', '03 53 01 60 60', 'planning@clair-logis.exemple',
       'Semur-en-Auxois, Époisses', 'Prévenir 5 jours avant.'),
    (a_serrure, 'Serrurerie du Rempart', 'Serrurier', 'Karim', '03 53 01 70 70', 'contact@serrurerie-rempart.exemple',
       'Semur-en-Auxois', null);

  -- HISTORIQUE DE LA MAISON DE SEMUR ------------------------------------------
  -- Onze visites mensuelles passées (la plus récente = ancre, à 10h42)
  for n in 0..10 loop
    if n = 0 then
      v_id := v_last;
      v_ts := (v_anchor::timestamp + time '10:42') at time zone 'Europe/Paris';
    else
      v_id := case n when 1 then v_sept when 2 then v_aout else gen_random_uuid() end;
      v_ts := ((case n
                  when 1 then v_anchor - 36            -- « 2 septembre »
                  when 2 then v_anchor - 57            -- « 12 août »
                  else (v_anchor - 57) - (n - 2) * 30 end)::timestamp
               + time '10:00' + make_interval(mins => (n * 17) % 50)) at time zone 'Europe/Paris';
    end if;
    insert into public.visits
      (id, property_id, kind, scheduled_at, started_at, ended_at, intendant_id, intendant_name,
       status, general_status, intendant_comment, indoor_temperature, mail_count, debrief_sent_at, created_at)
    values
      (v_id, p_semur, 'reguliere', v_ts - interval '42 minutes', v_ts - interval '38 minutes', v_ts,
       p_admin_id, v_admin_name, 'terminee', 'bon',
       case n
         when 0 then E'Maison globalement en très bon état.\nPetite fuite constatée sur la chasse d’eau des WC de l’étage.\nJe recommande de faire intervenir le plombier.'
         when 1 then 'Tout est en ordre. Le robinet extérieur goutte : je propose de faire passer le plombier.'
         when 2 then 'Maison saine. Humidité un peu élevée dans la cave après les orages, à surveiller.'
         else 'Rien à signaler. Maison propre, aérée pendant la visite.' end,
       case when n in (3, 4, 5) then 21.5 - n * 0.5 else 16.5 + (n % 3) end,
       (n * 2) % 5, v_ts + interval '6 minutes', v_ts - interval '20 days');
    insert into public.visit_checklist_items
      (visit_id, category, label, kind, unit, position, result, value_number, note, checked_at)
    select v_id, i.category, i.label, i.kind, i.unit, i.position,
           case when n = 0 and i.label = 'Sanitaires' then 'anomalie'
                when n = 1 and i.label = 'Robinetterie' then 'anomalie'
                when n = 2 and i.label = 'Traces d’humidité' then 'anomalie'
                else 'ok' end,
           case i.label when 'Température intérieure' then
                  (case when n in (3, 4, 5) then 21.5 - n * 0.5 else 16.5 + (n % 3) end)
                when 'Nombre de courriers' then (n * 2) % 5 end,
           case when n = 0 and i.label = 'Sanitaires' then 'Chasse d’eau des WC de l’étage : léger écoulement continu.' end,
           v_ts - interval '10 minutes'
      from public.checklist_template_items i where i.template_id = v_tpl;
  end loop;

  -- Séjour de septembre + préparation de la maison (« 15 septembre »)
  insert into public.stays (id, property_id, client_id, arrival_date, arrival_time, departure_date, options, message, status, created_at)
  values (s_martin, p_semur, c_martin, v_anchor - 22, 'vers 18h', v_anchor - 16,
          array['Ouvrir les volets', 'Chauffer la maison', 'Préparer du bois'],
          'Nous arrivons en famille pour une petite semaine.', 'termine',
          (v_anchor - 30)::timestamp at time zone 'Europe/Paris');
  v_ts := ((v_anchor - 23)::timestamp + time '15:30') at time zone 'Europe/Paris';
  insert into public.visits
    (id, property_id, kind, stay_id, scheduled_at, started_at, ended_at, intendant_id, intendant_name,
     status, general_status, intendant_comment, indoor_temperature, debrief_sent_at)
  values (v_prep, p_semur, 'preparation', s_martin, v_ts - interval '1 hour', v_ts - interval '55 minutes', v_ts,
          p_admin_id, v_admin_name, 'terminee', 'bon',
          'Volets ouverts, chauffage lancé à 19 °C, panier de bois préparé près du poêle. Bon séjour !',
          19, v_ts + interval '5 minutes');
  insert into public.client_requests
    (property_id, client_id, created_by, kind, stay_id, subject, message, status, reply, created_at)
  values (p_semur, c_martin, p_client_user_id, 'sejour', s_martin, 'Séjour de septembre',
          'Préparatifs souhaités : Ouvrir les volets, Chauffer la maison, Préparer du bois', 'terminee',
          'La maison est prête, bon séjour !', (v_anchor - 30)::timestamp at time zone 'Europe/Paris');

  -- Observations
  insert into public.observations
    (id, property_id, visit_id, title, description, level, recommended_action, estimate_min, estimate_max,
     status, client_decision, client_decision_at, is_shared, observed_at, created_by)
  values
    (o_wc, p_semur, v_last, 'Chasse d’eau WC étage — fuite légère',
     'La chasse d’eau des WC de l’étage laisse couler un filet d’eau en continu. Le robinet d’arrêt a été fermé par précaution.',
     'intervention_recommandee', 'Intervention plombier recommandée : remplacement du mécanisme de chasse.',
     80, 150, 'en_attente_client', null, null, true,
     (v_anchor::timestamp + time '10:31') at time zone 'Europe/Paris', p_admin_id),
    (o_robinet, p_semur, v_sept, 'Robinet extérieur qui goutte',
     'Le robinet du jardin goutte en permanence, même fermé à fond.',
     'intervention_recommandee', 'Remplacement du robinet de puisage par le plombier.',
     60, 110, 'resolu', 'autorise', ((v_anchor - 35)::timestamp + time '19:12') at time zone 'Europe/Paris', true,
     ((v_anchor - 36)::timestamp + time '10:05') at time zone 'Europe/Paris', p_admin_id),
    (o_cave, p_semur, v_aout, 'Humidité cave — surveillance',
     'Humidité légèrement élevée dans la cave après les orages. Pas de trace d’infiltration. Soupirail entrouvert pour ventiler.',
     'a_surveiller', 'Contrôle à chaque visite ; déshumidificateur à envisager si cela persiste.',
     null, null, 'nouveau', null, null, true,
     ((v_anchor - 57)::timestamp + time '10:20') at time zone 'Europe/Paris', p_admin_id);

  insert into public.observations
    (property_id, visit_id, title, description, level, status, is_shared, observed_at, created_by)
  values (p_semur, v_last, 'Courrier récupéré', 'Trois courriers relevés et déposés sur le bureau de l’entrée.',
          'information', 'resolu', true,
          (v_anchor::timestamp + time '10:15') at time zone 'Europe/Paris', p_admin_id);

  -- Intervention plombier terminée (« 28 septembre »)
  insert into public.interventions
    (id, property_id, observation_id, partner_id, title, description, scheduled_at, status,
     report, final_cost, completed_at, created_by, created_at)
  values (i_robinet, p_semur, o_robinet, a_plombier, 'Remplacement du robinet extérieur',
          'Remplacement du robinet de puisage du jardin.',
          ((v_anchor - 10)::timestamp + time '14:00') at time zone 'Europe/Paris', 'terminee',
          'Robinet de puisage remplacé, purge installée pour l’hiver. Plus aucune fuite constatée.',
          92.40, ((v_anchor - 10)::timestamp + time '15:10') at time zone 'Europe/Paris', p_admin_id,
          ((v_anchor - 35)::timestamp + time '19:12') at time zone 'Europe/Paris');

  -- Demande passée
  insert into public.client_requests
    (property_id, client_id, created_by, kind, subject, message, status, reply, created_at)
  values (p_semur, c_martin, p_client_user_id, 'general',
          'Pouvez-vous vérifier si j’ai laissé une fenêtre ouverte ?',
          'J’ai un doute sur la fenêtre de la salle de bain à l’étage.', 'terminee',
          'Vérifié ce matin : toutes les fenêtres étaient bien fermées.',
          ((v_anchor - 14)::timestamp + time '08:40') at time zone 'Europe/Paris');

  -- Prochaine visite : un mois après (« 8 novembre »)
  insert into public.visits (property_id, kind, scheduled_at)
  values (p_semur, 'reguliere', ((v_anchor + interval '1 month')::date::timestamp + time '10:00') at time zone 'Europe/Paris');

  -- Photos de la dernière visite (8) et de l’intervention (avant / après)
  insert into public.photos (property_id, visit_id, observation_id, category, caption, storage_path, is_shared, taken_at, uploaded_by)
  select p_semur, v_last, x.obs, x.category, x.caption, p_semur || '/' || x.file, x.shared,
         (v_anchor::timestamp + time '10:10' + make_interval(mins => x.ord::int * 3)) at time zone 'Europe/Paris', p_admin_id
  from (values
    (1, 'demo-facade.svg',     'Extérieur', 'Façade et portail',                 true,  null::uuid),
    (2, 'demo-jardin.svg',     'Extérieur', 'Jardin côté remise',                true,  null),
    (3, 'demo-sejour.svg',     'Intérieur', 'Séjour',                            true,  null),
    (4, 'demo-cuisine.svg',    'Cuisine',   'Cuisine',                           true,  null),
    (5, 'demo-chaudiere.svg',  'Chaudière', 'Chaudière — pression 1,5 bar',      true,  null),
    (6, 'demo-cave.svg',       'Intérieur', 'Cave — hygrométrie en baisse',      true,  o_cave),
    (7, 'demo-wc.svg',         'Anomalie',  'Chasse d’eau des WC de l’étage',    true,  o_wc),
    (8, 'demo-compteur.svg',   'Intérieur', 'Relevé du compteur d’eau (interne)', false, null)
  ) as x(ord, file, category, caption, shared, obs);

  insert into public.photos (property_id, intervention_id, observation_id, phase, category, caption, storage_path, is_shared, taken_at, uploaded_by) values
    (p_semur, i_robinet, o_robinet, 'avant', 'Anomalie', 'Robinet extérieur avant intervention',
       p_semur || '/demo-robinet-avant.svg', true, ((v_anchor - 36)::timestamp + time '10:06') at time zone 'Europe/Paris', p_admin_id),
    (p_semur, i_robinet, o_robinet, 'apres', 'Extérieur', 'Robinet remplacé',
       p_semur || '/demo-robinet-apres.svg', true, ((v_anchor - 10)::timestamp + time '15:05') at time zone 'Europe/Paris', p_admin_id);

  -- Documents
  insert into public.documents (property_id, client_id, intervention_id, category_id, title, storage_path, mime_type, size_bytes, visibility, uploaded_by, created_at) values
    (p_semur, c_martin, null, v_cat_contrat, 'Contrat Auxois Intendance — formule Sérénité',
       p_semur || '/demo-contrat-serenite.pdf', 'application/pdf', null, 'client', p_admin_id, (v_anchor - 340)::timestamp at time zone 'Europe/Paris'),
    (p_semur, null, i_robinet, v_cat_facture_art, 'Facture Dupont Plomberie — robinet extérieur',
       p_semur || '/demo-facture-plomberie.pdf', 'application/pdf', null, 'client', p_admin_id, (v_anchor - 9)::timestamp at time zone 'Europe/Paris'),
    (p_semur, null, null, v_cat_notice, 'Notice de la chaudière',
       p_semur || '/demo-notice-chaudiere.pdf', 'application/pdf', null, 'client', p_admin_id, (v_anchor - 300)::timestamp at time zone 'Europe/Paris'),
    (p_semur, null, null, null, 'Inventaire des clés (interne)',
       p_semur || '/demo-inventaire-cles.pdf', 'application/pdf', null, 'interne', p_admin_id, (v_anchor - 339)::timestamp at time zone 'Europe/Paris');

  -- LE CLOS D’ÉPOISSES ---------------------------------------------------------
  for n in 1..6 loop
    v_ts := ((v_today - n * 15)::timestamp + time '11:00' + make_interval(mins => (n * 13) % 40)) at time zone 'Europe/Paris';
    insert into public.visits
      (property_id, kind, scheduled_at, started_at, ended_at, intendant_id, intendant_name,
       status, general_status, intendant_comment, indoor_temperature, mail_count, debrief_sent_at)
    values (p_epoisses, 'reguliere', v_ts - interval '50 minutes', v_ts - interval '47 minutes', v_ts,
            p_admin_id, v_admin_name, 'terminee', 'bon',
            'Propriété en parfait état. Piscine et local technique contrôlés.', 18.5, n % 3,
            v_ts + interval '8 minutes')
    returning id into v_id;
    insert into public.visit_checklist_items (visit_id, category, label, kind, unit, position, result, value_number, checked_at)
    select v_id, i.category, i.label, i.kind, i.unit, i.position, 'ok',
           case i.label when 'Température intérieure' then 18.5 when 'Nombre de courriers' then n % 3 end,
           v_ts - interval '10 minutes'
      from public.checklist_template_items i where i.template_id = v_tpl_pool;
  end loop;
  -- Visites du jour et de la semaine
  insert into public.visits (property_id, kind, scheduled_at) values
    (p_epoisses, 'reguliere', (v_today::timestamp + time '11:00') at time zone 'Europe/Paris'),
    (p_flavigny, 'reguliere', (v_today::timestamp + time '15:00') at time zone 'Europe/Paris'),
    (p_epoisses, 'reguliere', ((v_today + 15)::timestamp + time '11:00') at time zone 'Europe/Paris');

  -- Séjour annoncé + demande à traiter
  insert into public.stays (id, property_id, client_id, arrival_date, arrival_time, departure_date, options, message, status)
  values (s_dupont, p_epoisses, c_dupont_c, v_today + 5, 'vers 19h30', v_today + 9,
          array['Préparer la maison', 'Chauffer la maison', 'Faire les lits', 'Remplir le réfrigérateur'],
          'Nous serons quatre. Merci de prévoir de quoi dîner le premier soir.', 'declare');
  insert into public.client_requests (property_id, client_id, kind, stay_id, subject, message, status)
  values (p_epoisses, c_dupont_c, 'sejour', s_dupont,
          'Séjour du ' || public.fr_date((v_today + 5)::timestamp at time zone 'Europe/Paris')
            || ' au ' || public.fr_date((v_today + 9)::timestamp at time zone 'Europe/Paris'),
          E'Préparatifs souhaités : Préparer la maison, Chauffer la maison, Faire les lits, Remplir le réfrigérateur\nNous serons quatre. Merci de prévoir de quoi dîner le premier soir.',
          'nouvelle');
  insert into public.client_requests (property_id, client_id, kind, subject, message, status, created_at)
  values (p_epoisses, c_dupont_p, 'general', 'Pouvez-vous ouvrir à mon plombier mardi ?',
          'Il doit passer en fin de matinée pour le devis de la salle de bain.', 'vue', now() - interval '1 day');

  -- Intervention planifiée : hivernage de la piscine
  insert into public.interventions (id, property_id, partner_id, title, description, scheduled_at, status, created_by)
  values (i_piscine, p_epoisses, a_piscine, 'Hivernage de la piscine',
          'Hivernage complet : traitement, baisse du niveau, mise hors gel de la filtration.',
          ((v_today + 3)::timestamp + time '09:00') at time zone 'Europe/Paris', 'rdv_confirme', p_admin_id);

  -- LA GRANGE DE FLAVIGNY (nouveau client) -----------------------------------------
  v_ts := ((v_today - 10)::timestamp + time '14:20') at time zone 'Europe/Paris';
  insert into public.visits
    (property_id, kind, scheduled_at, started_at, ended_at, intendant_id, intendant_name,
     status, general_status, intendant_comment, indoor_temperature, mail_count, debrief_sent_at)
  values (p_flavigny, 'reguliere', v_ts - interval '1 hour', v_ts - interval '56 minutes', v_ts,
          p_admin_id, v_admin_name, 'terminee', 'vigilance',
          'Première visite. Maison saine ; la gouttière côté rue déborde par forte pluie, à faire nettoyer.',
          15, 6, v_ts + interval '10 minutes')
  returning id into v_id;
  insert into public.visit_checklist_items (visit_id, category, label, kind, unit, position, result, value_number, checked_at)
  select v_id, i.category, i.label, i.kind, i.unit, i.position,
         case when i.label like 'Toiture%' then 'anomalie' else 'ok' end,
         case i.label when 'Température intérieure' then 15 when 'Nombre de courriers' then 6 end,
         v_ts - interval '10 minutes'
    from public.checklist_template_items i where i.template_id = v_tpl;
  insert into public.observations
    (id, property_id, visit_id, title, description, level, recommended_action, estimate_min, estimate_max,
     status, is_shared, observed_at, created_by)
  values (o_gouttiere, p_flavigny, v_id, 'Gouttière encombrée côté rue',
          'La gouttière déborde par forte pluie : feuilles et mousse visibles depuis la rue.',
          'intervention_recommandee', 'Nettoyage de la gouttière avant l’hiver.', 90, 160,
          'en_attente_client', true, v_ts - interval '15 minutes', p_admin_id);

  -- Tâche interne
  insert into public.internal_tasks (title, notes, due_at, assigned_to) values
    ('Commander des étiquettes pour les trousseaux', null,
       ((v_today + 2)::timestamp + time '09:00') at time zone 'Europe/Paris', p_admin_id);

  -- NOTIFICATIONS d’exemple ------------------------------------------------------
  if p_client_user_id is not null then
    perform public.notify(p_client_user_id, 'visite_terminee', jsonb_build_object(
        'maison', 'Maison de Semur',
        'date', public.fr_date((v_anchor::timestamp + time '10:42') at time zone 'Europe/Paris'),
        'heure', '10h42', 'etat', 'BON', 'pastille', '🟢',
        'observations', '1 observation a été signalée.'),
      '/client/visites/' || v_last, p_semur);
    perform public.notify(p_client_user_id, 'intervention_recommandee', jsonb_build_object(
        'maison', 'Maison de Semur', 'titre', 'Chasse d’eau WC étage — fuite légère',
        'detail', 'Intervention plombier recommandée.'),
      '/client/interventions', p_semur);
  end if;
  for r in select id from public.client_requests where status = 'nouvelle' and stay_id = s_dupont loop
    perform public.notify(p_admin_id, 'sejour_declare', jsonb_build_object(
        'maison', 'Le Clos d’Époisses', 'client', 'Claire Dupont',
        'date', public.fr_date((v_today + 5)::timestamp at time zone 'Europe/Paris'),
        'date_depart', public.fr_date((v_today + 9)::timestamp at time zone 'Europe/Paris')),
      '/admin/demandes/' || r.id, p_epoisses);
  end loop;
  -- Les notifications de démonstration ne partent ni en push ni par email
  update public.notifications set delivered_at = now()
   where delivered_at is null and property_id in (p_semur, p_epoisses, p_flavigny);

  perform set_config('auxois.silent', '', true);
end;
$$;

-- Suppression complète des données de démonstration
create or replace function public.remove_demo()
returns void
language plpgsql security definer
set search_path = public
as $$
begin
  delete from public.internal_tasks where title = 'Commander des étiquettes pour les trousseaux';
  delete from public.properties where id::text like 'd0000000-0000-4000-8000-%';
  delete from public.clients    where id::text like 'd0000000-0000-4000-8000-%';
  delete from public.partners   where id::text like 'd0000000-0000-4000-8000-%';
end;
$$;

revoke all on function public.seed_demo(uuid, uuid) from anon, public, authenticated;
revoke all on function public.remove_demo() from anon, public, authenticated;
grant execute on function public.seed_demo(uuid, uuid) to service_role;
grant execute on function public.remove_demo() to service_role;

-- >>> supabase/migrations/0007_lockdown.sql
-- =====================================================================
-- AUXOIS INTENDANCE — 0007 : verrouillage final
-- Supabase accorde par défaut des droits au rôle « anon » (visiteur non
-- connecté) sur tout nouvel objet. On les retire ici, en dernier.
-- À relancer après toute future migration qui crée des tables/fonctions.
-- =====================================================================
revoke all on all tables in schema public from anon, public;
revoke all on all sequences in schema public from anon, public;
revoke all on all functions in schema public from anon, public;

-- Vérification : RLS doit être active sur toutes les tables publiques
do $$
declare missing text;
begin
  select string_agg(c.relname, ', ') into missing
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity;
  if missing is not null then
    raise exception 'RLS inactive sur : %', missing;
  end if;
end $$;
