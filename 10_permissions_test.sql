-- =====================================================================
-- Tests des permissions et du workflow, exécutés avec les vrais rôles
-- (anon / authenticated) et un utilisateur simulé par requête.
-- =====================================================================
\set admin     '00000000-0000-4000-8000-0000000000a1'
\set martin    '00000000-0000-4000-8000-0000000000c1'
\set dupont    '00000000-0000-4000-8000-0000000000c2'
\set inconnu   '00000000-0000-4000-8000-0000000000c9'
\set assistant '00000000-0000-4000-8000-0000000000a2'
\set semur     'd0000000-0000-4000-8000-000000000011'
\set epoisses  'd0000000-0000-4000-8000-000000000012'
\set flavigny  'd0000000-0000-4000-8000-000000000013'
\set o_wc      'd0000000-0000-4000-8000-000000000201'
\set o_goutt   'd0000000-0000-4000-8000-000000000204'

-- ---------- Mise en place (serveur) ----------
insert into auth.users (id, email, raw_user_meta_data) values
  (:'admin', 'admin@test.fr', '{"full_name": "Steven Intendant", "role": "super_admin"}');
insert into auth.users (id, email, raw_user_meta_data) values
  (:'martin', 'martin@test.fr', '{"full_name": "Jean Martin", "role": "super_admin"}'),
  (:'dupont', 'dupont@test.fr', '{}'),
  (:'inconnu', 'inconnu@test.fr', '{}'),
  (:'assistant', 'assistant@test.fr', '{}');

select t.ok((select role = 'super_admin' from public.users where id = :'admin'),
  'le premier compte devient super_admin');
select t.ok((select role = 'client' from public.users where id = :'martin'),
  'un compte suivant est client, même s’il réclame super_admin dans ses métadonnées');

update public.users set role = 'assistant' where id = :'assistant';
select public.seed_demo(:'admin', :'martin');
update public.clients set user_id = :'dupont' where id = 'd0000000-0000-4000-8000-000000000002';

-- Fichiers de stockage simulés
insert into storage.objects (bucket_id, name)
select 'photos', storage_path from public.photos;
insert into storage.objects (bucket_id, name)
select 'documents', storage_path from public.documents;
insert into storage.objects (bucket_id, name) values ('photos', :'epoisses' || '/demo-facade.svg');

select t.ok((select count(*) = 3 from public.properties), 'démo : 3 propriétés');
select t.ok((select count(*) = 12 from public.visits where property_id = :'semur' and status = 'terminee'),
  'démo : 12 visites terminées à Semur (11 mensuelles + préparation)');
select t.ok((select count(*) = 0 from public.notifications where delivered_at is null),
  'démo : aucune notification en attente d’envoi');

-- ---------- Visiteur non connecté ----------
set role anon;
select t.denied('select * from public.properties', 'anon : propriétés');
select t.denied('select * from public.users', 'anon : utilisateurs');
select t.denied('select * from public.settings', 'anon : paramètres');
select t.denied('select * from public.property_timeline', 'anon : historique');
select t.denied('select public.admin_stats()', 'anon : statistiques');
select t.denied('select public.is_staff()', 'anon : fonctions d’aide');
select t.denied($$select public.create_request('d0000000-0000-4000-8000-000000000011', 'x', 'y')$$, 'anon : créer une demande');
select t.denied('select * from storage.objects', 'anon : fichiers');
reset role; select set_config('request.jwt.claims', '', false);

-- ---------- Propriétaire : Jean Martin ----------
select t.login(:'martin');
set role authenticated;

select t.ok((select count(*) = 1 and bool_and(id = :'semur') from public.properties), 'Martin ne voit que sa maison');
select t.ok((select count(*) = 1 from public.clients), 'Martin ne voit que sa fiche client');
select t.ok((select count(*) = 1 from public.users), 'Martin ne voit que son compte');
select t.ok((select count(*) > 0 and bool_and(property_id = :'semur') from public.visits), 'Martin : visites de sa maison uniquement');
select t.ok((select bool_and(v.property_id = :'semur') from public.visit_checklist_items i join public.visits v on v.id = i.visit_id),
  'Martin : checklists de sa maison uniquement');
select t.ok((select count(*) = 4 and bool_and(property_id = :'semur') from public.observations), 'Martin : ses 4 observations partagées');
select t.ok((select count(*) = 1 from public.interventions), 'Martin : son intervention uniquement');
select t.ok((select count(*) = 9 and bool_and(is_shared) from public.photos), 'Martin : 9 photos partagées, pas la photo interne');
select t.ok((select count(*) = 3 and bool_and(visibility = 'client') from public.documents), 'Martin : 3 documents, pas le document interne');
select t.ok((select count(*) = 1 and bool_and(visibility = 'client') from public.property_notes), 'Martin : pas les notes internes');
select t.ok((select count(*) = 0 from public.partners), 'Martin : aucune fiche partenaire');
select t.ok((select count(*) = 0 from public.client_internal_notes), 'Martin : aucune note interne client');
select t.ok((select count(*) = 0 from public.checklist_templates), 'Martin : aucun modèle de checklist');
select t.ok((select count(*) = 0 from public.internal_tasks), 'Martin : aucune tâche interne');
select t.ok((select count(*) = 0 from public.activity_logs), 'Martin : aucun journal d’activité');
select t.ok((select count(*) = 0 from public.notification_templates), 'Martin : aucun modèle de notification');
select t.ok((select count(*) = 2 and bool_and(user_id = :'martin') from public.notifications), 'Martin : ses notifications uniquement');
select t.ok((select count(*) = 1 from public.subscriptions), 'Martin : son abonnement uniquement');
select t.ok((select count(*) = 2 from public.client_requests), 'Martin : ses demandes uniquement');
select t.ok((select count(*) = 1 from public.stays), 'Martin : ses séjours uniquement');
select t.ok((select count(*) > 0 and bool_and(property_id = :'semur') from public.property_timeline), 'Martin : historique de sa maison uniquement');
select t.ok((select interventions.partner_name = 'Dupont Plomberie' from public.interventions), 'Martin voit le nom de l’artisan sans accès aux partenaires');

select t.denied('select * from public.property_secrets', 'Martin : clés et codes (table)');
select t.denied($$select public.get_property_secrets('d0000000-0000-4000-8000-000000000011')$$, 'Martin : clés et codes (fonction)');
select t.denied('select public.admin_stats()', 'Martin : statistiques');
select t.denied($$select public.seed_demo('00000000-0000-4000-8000-0000000000a1', null)$$, 'Martin : seed_demo');
select t.denied('select public.remove_demo()', 'Martin : remove_demo');
select t.denied($$select public.notify('00000000-0000-4000-8000-0000000000a1', 'visite_terminee')$$, 'Martin : fonction notify interne');

-- Écritures directes interdites
select t.denied($$update public.users set role = 'super_admin' where id = '00000000-0000-4000-8000-0000000000c1'$$, 'Martin : s’attribuer un rôle');
select t.denied($$update public.users set is_active = true where id = '00000000-0000-4000-8000-0000000000c9'$$, 'Martin : modifier un autre compte');
select t.denied($$update public.properties set name = 'piraté'$$, 'Martin : modifier une propriété');
select t.denied($$insert into public.properties (name) values ('x')$$, 'Martin : créer une propriété');
select t.denied($$insert into public.property_owners (property_id, client_id) values ('d0000000-0000-4000-8000-000000000012', 'd0000000-0000-4000-8000-000000000001')$$, 'Martin : se rattacher à une autre maison');
select t.denied($$update public.clients set user_id = '00000000-0000-4000-8000-0000000000c1' where true$$, 'Martin : modifier les fiches clients');
select t.denied($$update public.visits set intendant_comment = 'x'$$, 'Martin : modifier une visite');
select t.denied($$update public.observations set status = 'resolu'$$, 'Martin : modifier une observation directement');
select t.denied($$update public.interventions set status = 'annulee'$$, 'Martin : modifier une intervention');
select t.denied($$delete from public.documents$$, 'Martin : supprimer un document');
select t.denied($$update public.photos set is_shared = true$$, 'Martin : modifier une photo');
select t.denied($$insert into public.client_requests (property_id, subject) values ('d0000000-0000-4000-8000-000000000012', 'x')$$, 'Martin : demande directe sur une autre maison');
select t.denied($$update public.subscriptions set monthly_price_override = 0$$, 'Martin : modifier son abonnement');
select t.denied($$update public.settings set company_name = 'x'$$, 'Martin : modifier les paramètres');
select t.denied($$insert into public.notifications (user_id, title, body) values ('00000000-0000-4000-8000-0000000000a1', 'x', 'y')$$, 'Martin : forger une notification');
select t.denied($$update public.notifications set title = 'x'$$, 'Martin : réécrire une notification');
select t.denied($$insert into public.activity_logs (action, entity_type) values ('x', 'y')$$, 'Martin : écrire dans le journal');
select t.denied($$insert into public.consents (user_id, policy_version) values ('00000000-0000-4000-8000-0000000000c9', 'v')$$, 'Martin : consentement au nom d’un autre');

-- Écritures autorisées
update public.notifications set read_at = now() where template_key = 'visite_terminee';
select t.ok((select count(*) = 1 from public.notifications where read_at is not null), 'Martin marque sa notification comme lue');
update public.users set phone = '06 39 98 01 01' where id = :'martin';
select t.ok((select phone is not null from public.users), 'Martin met à jour son téléphone');
insert into public.consents (user_id, policy_version) values (:'martin', '2026-10');
select t.ok((select count(*) = 1 from public.consents), 'Martin enregistre son consentement');

-- Fichiers
select t.ok((select count(*) = 9 from storage.objects where bucket_id = 'photos'), 'Martin : fichiers photo partagés uniquement');
select t.ok((select count(*) = 3 from storage.objects where bucket_id = 'documents'), 'Martin : fichiers document « client » uniquement');
select t.ok((select count(*) = 0 from storage.objects where name like 'd0000000-0000-4000-8000-000000000012/%'), 'Martin : aucun fichier d’une autre maison');
select t.denied($$insert into storage.objects (bucket_id, name) values ('photos', 'd0000000-0000-4000-8000-000000000011/x.jpg')$$, 'Martin : déposer un fichier');
select t.denied($$delete from storage.objects$$, 'Martin : supprimer des fichiers');

-- Fonctions métier : périmètre
select t.denied($$select public.decide_observation('d0000000-0000-4000-8000-000000000204', 'autorise')$$, 'Martin : décider pour la maison d’un autre');
select t.denied($$select public.create_request('d0000000-0000-4000-8000-000000000012', 'x', null)$$, 'Martin : demande pour la maison d’un autre');
select t.denied($$select public.declare_stay('d0000000-0000-4000-8000-000000000012', current_date + 3, null, current_date + 5)$$, 'Martin : séjour dans la maison d’un autre');
select t.denied($$select public.visit_summary((select id from public.visits limit 0))$$, 'Martin : résumé sans visite');
select t.denied($$select public.start_visit('d0000000-0000-4000-8000-000000000101')$$, 'Martin : démarrer une visite');
select t.denied($$select public.send_debrief('d0000000-0000-4000-8000-000000000101')$$, 'Martin : envoyer un débrief');
select t.denied($$select public.declare_stay('d0000000-0000-4000-8000-000000000011', current_date - 3, null, current_date + 5)$$, 'Martin : séjour dans le passé');

-- Export RGPD limité à ses données
select t.ok((select jsonb_array_length(public.export_my_data() -> 'proprietes') = 1), 'export RGPD : sa seule propriété');
select t.ok((select public.export_my_data()::text not like '%Époisses%'), 'export RGPD : rien sur les autres maisons');
select t.ok((select public.export_my_data()::text not like '%DÉMO-%'), 'export RGPD : aucun code d’accès');

-- Martin autorise l’intervention
select public.decide_observation(:'o_wc', 'autorise') as intervention_id \gset
select t.ok((select status = 'autorise' and client_decision = 'autorise' from public.observations where id = :'o_wc'),
  'autorisation : observation passée à « autorisé »');
select t.ok((select count(*) = 1 from public.interventions where observation_id = :'o_wc' and status = 'a_planifier'),
  'autorisation : intervention créée');
select t.denied($$select public.decide_observation('d0000000-0000-4000-8000-000000000201', 'client_gere')$$, 'autorisation : pas de seconde décision');

-- Demande et séjour
select public.create_request(:'semur', 'Pouvez-vous préparer la maison vendredi ?', 'Merci !') as req_id \gset
select public.declare_stay(:'semur', current_date + 10, 'vers 17h', current_date + 14,
  array['Chauffer la maison', 'Faire les lits'], 'À bientôt') as stay_id \gset
select t.ok((select count(*) = 4 from public.client_requests), 'demande + séjour enregistrés');
reset role; select set_config('request.jwt.claims', '', false);

select t.ok((select count(*) = 6 from public.notifications where user_id in (:'admin', :'assistant')
             and template_key in ('autorisation_recue', 'nouvelle_demande', 'sejour_declare') and delivered_at is null),
  'l’équipe (2 personnes) est notifiée : autorisation, demande, séjour');

-- ---------- Compte sans rattachement ----------
select t.login(:'inconnu');
set role authenticated;
select t.ok((select count(*) = 0 from public.properties), 'inconnu : aucune propriété');
select t.ok((select count(*) = 0 from public.visits), 'inconnu : aucune visite');
select t.ok((select count(*) = 0 from public.photos), 'inconnu : aucune photo');
select t.ok((select count(*) = 0 from public.documents), 'inconnu : aucun document');
select t.ok((select count(*) = 0 from public.clients), 'inconnu : aucun client');
select t.ok((select count(*) = 0 from storage.objects where bucket_id <> 'branding'), 'inconnu : aucun fichier');
select t.ok((select jsonb_array_length(public.export_my_data() -> 'proprietes') = 0), 'inconnu : export vide');
reset role; select set_config('request.jwt.claims', '', false);

-- ---------- Copropriétaire : Claire Dupont ----------
select t.login(:'dupont');
set role authenticated;
select t.ok((select count(*) = 1 and bool_and(id = :'epoisses') from public.properties), 'Dupont ne voit que Le Clos d’Époisses');
select t.ok((select count(*) = 0 from public.observations where property_id = :'semur'), 'Dupont : rien sur la maison Martin');
select t.ok((select count(*) = 2 from public.property_owners), 'Dupont voit les deux copropriétaires de sa maison');
reset role; select set_config('request.jwt.claims', '', false);

-- ---------- Assistant administratif ----------
select t.login(:'assistant');
set role authenticated;
select t.ok((select count(*) = 3 from public.properties), 'assistant : toutes les propriétés');
select t.ok((select count(*) = 7 from public.partners), 'assistant : partenaires');
select t.denied($$select public.get_property_secrets('d0000000-0000-4000-8000-000000000012')$$, 'assistant : pas d’accès aux clés et codes');
select t.denied($$update public.users set role = 'super_admin' where id = '00000000-0000-4000-8000-0000000000a2'$$, 'assistant : ne peut pas se promouvoir');
select t.denied($$update public.settings set company_name = 'x'$$, 'assistant : paramètres généraux');
select t.denied($$update public.subscription_plans set monthly_price = 1$$, 'assistant : formules');
select t.ok((select count(*) = 0 from public.activity_logs), 'assistant : pas de journal d’activité');
reset role; select set_config('request.jwt.claims', '', false);

-- ---------- Administrateur : workflow complet d’une visite ----------
select t.login(:'admin');
set role authenticated;
select t.ok((select count(*) = 3 from public.properties), 'admin : toutes les propriétés');
select t.ok((select (public.get_property_secrets(:'epoisses')).alarm_code = 'DÉMO-4821'), 'admin : accès aux codes');
select t.ok((select count(*) = 1 from public.activity_logs where action = 'consultation' and entity_type = 'property_secrets'),
  'la consultation des codes est journalisée');
select t.ok((select (public.admin_stats() ->> 'proprietes_actives')::int = 3), 'admin : statistiques');
select t.ok((select (public.admin_stats() ->> 'revenu_mensuel_recurrent')::numeric = 427), 'statistiques : revenu récurrent 69 + 129 + 229');
select t.ok((select (public.admin_stats() ->> 'visites_aujourdhui')::int = 2), 'statistiques : 2 visites aujourd’hui');

-- Visite planifiée du jour à Époisses : checklist personnalisée (piscine)
select id as v_epoisses from public.visits
 where property_id = :'epoisses' and status = 'planifiee' order by scheduled_at limit 1 \gset
select public.start_visit(:'v_epoisses');
select t.ok((select status = 'en_cours' and started_at is not null and intendant_name = 'Steven Intendant'
             from public.visits where id = :'v_epoisses'), 'démarrage : date, heure et intendant enregistrés');
select t.ok((select count(*) = 29 and count(*) filter (where category = 'Piscine') = 4
             from public.visit_checklist_items where visit_id = :'v_epoisses'), 'checklist personnalisée avec la catégorie Piscine');
select public.start_visit(:'v_epoisses');
select t.ok((select count(*) = 29 from public.visit_checklist_items where visit_id = :'v_epoisses'), 'reprise de visite sans doublon');

-- Visite de contrôle imprévue chez Martin
select public.start_unplanned_visit(:'semur', 'controle') as v_new \gset
update public.visit_checklist_items set result = 'ok', checked_at = now() where visit_id = :'v_new' and label <> 'Chauffe-eau';
update public.visit_checklist_items set result = 'anomalie' where visit_id = :'v_new' and label = 'Chauffe-eau';
insert into public.observations (property_id, visit_id, title, description, level)
values (:'semur', :'v_new', 'Chauffe-eau : groupe de sécurité qui goutte', 'Léger goutte-à-goutte.', 'a_surveiller');
insert into public.photos (property_id, visit_id, category, storage_path, is_shared)
values (:'semur', :'v_new', 'Anomalie', :'semur' || '/test-partagee.jpg', true),
       (:'semur', :'v_new', 'Anomalie', :'semur' || '/test-interne.jpg', false);
reset role; select set_config('request.jwt.claims', '', false);

select t.login(:'martin');
set role authenticated;
select t.ok((select count(*) = 0 from public.visits where id = :'v_new'), 'brouillon : visite en cours invisible du propriétaire');
select t.ok((select count(*) = 0 from public.visit_checklist_items where visit_id = :'v_new'), 'brouillon : checklist invisible');
select t.ok((select count(*) = 0 from public.observations where visit_id = :'v_new'), 'brouillon : observation invisible');
select t.ok((select count(*) = 0 from public.photos where visit_id = :'v_new'), 'brouillon : photos invisibles');
reset role; select set_config('request.jwt.claims', '', false);

select t.login(:'admin');
set role authenticated;
select t.denied(format('select public.send_debrief(%L)', :'v_new'), 'débrief impossible avant la fin de visite');
select public.finish_visit(:'v_new', 'Rien d’alarmant, à suivre.', 'bon') as summary \gset
select t.ok((:'summary'::jsonb ->> 'points_controles')::int = 25 and (:'summary'::jsonb ->> 'ok')::int = 24
        and (:'summary'::jsonb ->> 'observations')::int = 1 and (:'summary'::jsonb ->> 'photos')::int = 2,
  'résumé de fin de visite exact');
reset role; select set_config('request.jwt.claims', '', false);

select t.login(:'martin');
set role authenticated;
select t.ok((select count(*) = 0 from public.visits where id = :'v_new'), 'visite terminée mais débrief non envoyé : toujours invisible');
reset role; select set_config('request.jwt.claims', '', false);

select t.login(:'admin');
set role authenticated;
select public.send_debrief(:'v_new');
select t.denied(format('select public.send_debrief(%L)', :'v_new'), 'le débrief ne part qu’une fois');
reset role; select set_config('request.jwt.claims', '', false);

select t.login(:'martin');
set role authenticated;
select t.ok((select count(*) = 1 from public.visits where id = :'v_new'), 'débrief envoyé : visite visible');
select t.ok((select count(*) = 1 from public.observations where visit_id = :'v_new'), 'débrief envoyé : observation visible');
select t.ok((select count(*) = 1 from public.photos where visit_id = :'v_new'), 'débrief envoyé : photo partagée visible, pas l’interne');
select t.ok(((public.visit_summary(:'v_new')) ->> 'photos')::int = 1, 'résumé côté propriétaire : photos partagées seulement');
select t.ok((select count(*) = 1 from public.notifications where template_key = 'visite_terminee' and read_at is null
             and body like '%1 observation a été signalée.%' and body like '%🟢 BON%'), 'notification « visite terminée »');
select t.ok((select count(*) = 1 from public.notifications where template_key = 'anomalie_creee'), 'notification « point à surveiller »');
reset role; select set_config('request.jwt.claims', '', false);

-- Intervention : rendez-vous puis fin
select t.login(:'admin');
set role authenticated;
update public.interventions
   set partner_id = 'd0000000-0000-4000-8000-000000000021', status = 'rdv_confirme',
       scheduled_at = now() + interval '4 days'
 where id = :'intervention_id';
select t.ok((select status = 'rdv_prevu' from public.observations where id = :'o_wc'), 'rendez-vous : observation « rendez-vous prévu »');
update public.interventions set status = 'terminee', report = 'Mécanisme remplacé.' where id = :'intervention_id';
select t.ok((select status = 'resolu' and resolved_at is not null from public.observations where id = :'o_wc'), 'fin d’intervention : observation résolue');

-- Demandes
update public.client_requests set status = 'planifiee' where id = :'req_id';
update public.client_requests set status = 'terminee', reply = 'C’est fait.' where id = :'req_id';
update public.client_requests set status = 'terminee' where stay_id = :'stay_id';
select t.ok((select status = 'pret' from public.stays where id = :'stay_id'), 'séjour : statut « prêt » quand la demande est terminée');

-- Urgence
insert into public.observations (property_id, title, description, level)
values (:'semur', 'Fuite importante sous l’évier', 'Eau coupée au compteur.', 'urgent') returning id as o_urgent \gset
select t.ok((select status = 'urgent' from public.properties where id = :'semur'), 'urgence : la maison passe en rouge');
update public.observations set status = 'resolu' where id = :'o_urgent';
select t.ok((select status = 'vigilance' from public.properties where id = :'semur'), 'urgence levée : la maison quitte le rouge');

-- Document partagé
insert into public.documents (property_id, title, storage_path, visibility)
values (:'semur', 'Devis toiture', :'semur' || '/devis.pdf', 'client');

-- Planification manuelle
insert into public.visits (property_id, scheduled_at) values (:'semur', now() + interval '20 days');

-- Décision « je m’en occupe » enregistrée par l’équipe pour Mme Rousseau
select public.decide_observation(:'o_goutt', 'client_gere');
select t.ok((select status = 'classe_sans_suite' from public.observations where id = :'o_goutt'), 'refus : observation classée sans suite');

-- Gestion des rôles
update public.users set role = 'intendant' where id = :'assistant';
select t.ok((select role = 'intendant' from public.users where id = :'assistant'), 'super_admin : peut changer un rôle');
select t.denied($$update public.users set role = 'client' where id = '00000000-0000-4000-8000-0000000000a1'$$, 'impossible de retirer le dernier super_admin');
reset role; select set_config('request.jwt.claims', '', false);

select t.login(:'martin');
set role authenticated;
select t.ok((select array_agg(template_key order by template_key) @> array[
    'rdv_artisan_confirme', 'intervention_terminee', 'demande_mise_a_jour', 'demande_traitee',
    'sejour_pret', 'alerte_urgente', 'nouveau_document', 'prochaine_visite']
  from public.notifications), 'Martin a reçu toutes les notifications attendues');
select t.ok((select count(*) = 1 from public.notifications where template_key = 'prochaine_visite'),
  'une seule notification « prochaine visite » (pas pour les planifications automatiques)');
select t.ok((select body like '%Dupont Plomberie interviendra le %' from public.notifications where template_key = 'rdv_artisan_confirme'),
  'notification de rendez-vous : artisan et date');
select t.ok((select bool_and(user_id = :'martin') from public.notifications), 'Martin ne voit toujours que ses notifications');
reset role; select set_config('request.jwt.claims', '', false);

-- Un compte désactivé perd tout accès
update public.users set is_active = false where id = :'martin';
select t.login(:'martin');
set role authenticated;
select t.ok((select count(*) = 0 from public.properties), 'compte désactivé : plus aucun accès');
reset role; select set_config('request.jwt.claims', '', false);
update public.users set is_active = true where id = :'martin';

-- Prochaine visite automatique après une visite régulière
select t.login(:'admin');
set role authenticated;
select public.finish_visit(:'v_epoisses', 'RAS', 'bon');
select t.ok((select count(*) = 1 from public.visits where property_id = :'epoisses' and status = 'planifiee'),
  'pas de doublon si une prochaine visite est déjà planifiée');
reset role; select set_config('request.jwt.claims', '', false);

-- Suppression de la démonstration
select public.remove_demo();
select t.ok((select count(*) = 0 from public.properties) and (select count(*) = 0 from public.clients)
        and (select count(*) = 0 from public.visits) and (select count(*) = 0 from public.partners)
        and (select count(*) = 0 from public.photos) and (select count(*) = 0 from public.observations),
  'remove_demo : base revenue à vide');

-- ---------- Bilan ----------
\echo
select case when ok then '  ok   ' else '  ÉCHEC' end as " ", label from t.results where not ok order by n;
select count(*) filter (where ok) as reussis, count(*) filter (where not ok) as echecs from t.results;
select t.results.label from t.results where not ok limit 1 \gset
\if :{?label}
  \echo 'DES TESTS ONT ÉCHOUÉ'
  \quit 1
\endif
\echo 'TOUS LES TESTS PASSENT'
