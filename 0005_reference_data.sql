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
