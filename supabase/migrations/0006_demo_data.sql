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
