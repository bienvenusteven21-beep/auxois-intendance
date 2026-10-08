# Auxois Intendance

*Votre maison, suivie toute l’année.* — Application web/mobile (PWA) d’intendance de résidences secondaires : espace **administrateur / intendant** et espace **client / propriétaire**.

- Installation sans connaissance technique : voir **[GUIDE_INSTALLATION.md](./GUIDE_INSTALLATION.md)**.
- Cahier des charges d’origine : `CAHIER_DES_CHARGES.txt`.

## Pile technique

| Couche | Choix |
|---|---|
| Application | Next.js 15 (App Router, Server Components, Server Actions), React 19, TypeScript |
| Interface | Tailwind CSS 4, design mobile-first, PWA installable (manifest + service worker) |
| Données | Supabase : PostgreSQL + Row Level Security, Auth, Storage (buckets privés, URL signées) |
| Notifications | Créées en base par les fonctions SQL ; expédiées par l’application en push (Web Push / VAPID) et email (Resend) |
| PDF | Rapport de visite généré côté serveur (pdfkit) |
| Hébergement | Vercel (cron quotidien d’expédition des notifications) — ou tout hébergeur Node.js |

## Organisation du code

```
app/
  (auth)/            connexion, inscription, mot de passe oublié / réinitialisation
  installation/      assistant de première installation (premier admin + démonstration)
  admin/             espace équipe : tableau de bord, planning, propriétés, clients, visites,
                     observations, interventions, demandes, partenaires, documents,
                     statistiques, paramètres (utilisateurs, formules, checklists,
                     modèles de notifications, catégories, RGPD, démo), notifications
  client/            espace propriétaire : accueil, ma maison, historique, interventions,
                     demandes (+ « Je viens dans ma maison »), documents, profil, notifications
  api/               fichiers privés (URL signées), rapport PDF, export RGPD, expédition des notifications
  actions/           Server Actions (toutes les écritures, avec contrôle de rôle)
components/          composants d’interface (UI, visite, uploads, client…)
lib/                 clients Supabase, auth, formats FR, libellés, notifications, PDF
supabase/            migrations SQL (0001…0007) et install.sql (le tout concaténé)
tests/db/            137 vérifications de permissions et de workflow (PostgreSQL local)
public/              icônes PWA, service worker, page hors ligne, fichiers de démonstration
```

## Principes d’architecture

- **Sécurité par la base** : chaque table est protégée par RLS. Un propriétaire ne voit que ses propriétés, et uniquement ce qui lui a été partagé (débrief envoyé, photo partageable, document « client »). Il n’écrit jamais directement dans les tables : ses actions passent par des fonctions SQL contrôlées (`create_request`, `declare_stay`, `decide_observation`, `export_my_data`…).
- **Rôles** : `super_admin`, `intendant`, `assistant` (équipe) et `client`. Le premier compte créé devient super administrateur ; les suivants sont des clients sans accès tant qu’une fiche client ne leur est pas reliée.
- **Informations sensibles** (clés, codes) : table dédiée sans accès direct ; lecture/écriture via `get_property_secrets` / `set_property_secrets`, réservées au super administrateur et aux intendants, chaque accès étant journalisé.
- **Workflow de visite** : `start_visit` (copie la checklist de la maison), saisie en direct (checklist, photos, observations), `finish_visit` (état général → pastille de la maison, planification automatique de la prochaine visite), `send_debrief` (partage + notifications).
- **Fichiers** : buckets privés `photos`, `documents`, `branding` ; chemin `<id propriété>/<fichier>` ; servis par `/api/fichiers/...` en URL signées temporaires, selon les droits de la personne connectée.
- **Notifications** : les fonctions et déclencheurs SQL créent les lignes ; `lib/notifications/deliver.ts` expédie celles dont `delivered_at` est nul (appelé après chaque action et par `/api/notifications/expedier`).

## Développement local

```bash
cp .env.example .env.local      # renseigner les clés Supabase
npm install
npm run dev                     # http://localhost:3000
npm run typecheck && npm run lint && npm run build
```

Tests de la base sur un PostgreSQL local (rôles et schémas Supabase simulés) :

```bash
PSQL="psql" npm run test:db     # ou PSQL="runuser -u postgres -- psql"
```

Régénérer les fichiers de démonstration : `npm run demo:files`.

## Variables de configuration

Voir `.env.example` : Supabase (URL, clé anon, clé service), `NEXT_PUBLIC_APP_URL`, clés VAPID (push), Resend (email), `CRON_SECRET`, `SETUP_SECRET` (facultatif).

## Évolutions prévues par l’architecture

Paiement Stripe (colonnes `billing_*` sur `subscriptions`), plusieurs intendants avec permissions (rôles déjà distingués), messagerie, capteurs connectés (« Auxois Connect »), applications natives.
