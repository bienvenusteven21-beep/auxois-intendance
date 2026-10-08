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
