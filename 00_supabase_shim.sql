-- Reproduit en local le strict nécessaire d’un projet Supabase
-- (rôles, schéma auth, schéma storage, privilèges par défaut) pour
-- pouvoir tester les migrations sur un PostgreSQL ordinaire.
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end $$;

create schema auth;
create table auth.users (
  id uuid primary key default gen_random_uuid(),
  email text unique,
  raw_user_meta_data jsonb default '{}'
);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub', '')::uuid
$$;
grant usage on schema auth to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;

create schema storage;
create table storage.buckets (
  id text primary key, name text not null, public boolean default false,
  file_size_limit bigint, allowed_mime_types text[]
);
create table storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets (id),
  name text, owner uuid,
  unique (bucket_id, name)
);
alter table storage.objects enable row level security;
grant usage on schema storage to anon, authenticated, service_role;
grant all on storage.objects, storage.buckets to anon, authenticated, service_role;

-- Privilèges par défaut de Supabase : tout nouvel objet de « public »
-- est accordé à anon / authenticated / service_role.
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;

-- Outils de test
create schema t;
grant usage on schema t to anon, authenticated, service_role;
create table t.results (n serial, ok boolean, label text);
grant all on t.results to anon, authenticated, service_role;
grant all on sequence t.results_n_seq to anon, authenticated, service_role;

create function t.ok(p_cond boolean, p_label text) returns void language plpgsql as $$
begin
  insert into t.results (ok, label) values (coalesce(p_cond, false), p_label);
  if not coalesce(p_cond, false) then raise warning 'ÉCHEC : %', p_label; end if;
end $$;

-- Vérifie qu’une requête est refusée (erreur) ou sans effet (0 ligne touchée)
create function t.denied(p_sql text, p_label text) returns void language plpgsql as $$
declare n bigint;
begin
  begin
    execute p_sql;
    get diagnostics n = row_count;
  exception when others then
    insert into t.results (ok, label) values (true, p_label || ' [' || sqlerrm || ']');
    return;
  end;
  insert into t.results (ok, label) values (n = 0, p_label || ' [' || n || ' ligne(s)]');
  if n <> 0 then raise warning 'ÉCHEC : % (% ligne(s) touchée(s))', p_label, n; end if;
end $$;

create function t.login(p_user uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, false);
$$;
grant execute on all functions in schema t to anon, authenticated, service_role;
