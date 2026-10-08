# Auxois Intendance — état du projet

**Application complète** (base de données + application Next.js). Livrable : cette archive.

## Fait
- Base de données : `supabase/migrations/0001…0007`, `supabase/install.sql` (concaténé). 137 tests de permissions/workflow (`tests/db/`) — tous passent.
- Application Next.js 15 (App Router) : authentification et rôles, assistant d’installation (premier admin + démonstration + téléversement des fichiers `demo-*`), espace administrateur complet (tableau de bord, planning liste/calendrier, propriétés + Carnet Maison + clés/codes journalisés + checklist par maison, clients + création d’accès, visites avec workflow complet — démarrer, checklist, photos depuis le téléphone, observations, terminer, débrief —, observations, interventions avant/après, demandes et séjours, partenaires, documents, statistiques, paramètres : utilisateurs, formules, checklists, modèles de notifications, catégories, RGPD/journal, démo), espace client (accueil avec pastille, « Je viens dans ma maison », décisions d’intervention, historique/carnet de santé, interventions, demandes, documents, profil + export/suppression RGPD), notifications in-app + push (VAPID) + email (Resend), rapport PDF de visite, PWA (manifest, service worker, icônes, page hors ligne).
- Guide d’installation sans jargon : `GUIDE_INSTALLATION.md`. Documentation technique : `README.md`.

## Vérifications effectuées
- `npm run typecheck`, `npm run lint`, `npm run build` : OK.
- `tests/db/run.sh` sur PostgreSQL 16 local : 137 réussis, 0 échec.
- Cohérence des requêtes de l’application avec le schéma SQL (tables, colonnes, relations, fonctions RPC) vérifiée par script.
- Génération du rapport PDF testée (`scripts/test-pdf.ts`).

## Non testé en conditions réelles
L’environnement de construction n’avait pas accès à un projet Supabase : les parcours complets (connexion, téléversements, notifications) sont à valider sur le projet réel lors de l’installation (étape 5 du guide, avec la démonstration).

## Pistes suivantes
Paiement Stripe (`subscriptions.billing_*`), permissions fines par rôle (assistant), messagerie interne, capteurs « Auxois Connect », traductions (champ `language` déjà présent).
