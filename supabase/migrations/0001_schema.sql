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
