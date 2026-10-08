# Auxois Intendance — Guide d’installation pas à pas

Ce guide vous accompagne de A à Z pour mettre l’application en ligne, **sans rien connaître à l’informatique**. Comptez environ **1 heure**, en suivant les étapes dans l’ordre. Vous n’avez besoin que d’un ordinateur, d’un navigateur et d’une adresse email.

> Vocabulaire utile
> - **Supabase** : le service qui héberge la base de données (toutes les informations) et les fichiers (photos, documents). Gratuit pour démarrer.
> - **Vercel** : le service qui héberge l’application elle-même (les écrans). Gratuit pour démarrer.
> - **GitHub** : un « coffre » en ligne où l’on dépose les fichiers de l’application pour que Vercel puisse les lire. Gratuit.
> - **Variable de configuration** : une ligne du type `NOM=valeur` que l’on recopie dans Vercel pour relier les services entre eux.

Gardez un fichier texte ouvert pour **noter les clés et adresses** que vous obtiendrez au fil des étapes.

---

## Étape 1 — Créer la base de données (Supabase)

1. Allez sur **https://supabase.com** et cliquez sur **Start your project**. Créez un compte (avec votre email ou GitHub).
2. Cliquez sur **New project**.
   - *Name* : `auxois-intendance`
   - *Database Password* : choisissez un mot de passe long et **notez-le** (vous n’en aurez normalement plus besoin, mais gardez-le précieusement).
   - *Region* : choisissez **West EU (Paris)** ou **Central EU (Frankfurt)**.
   - Cliquez sur **Create new project** et attendez 1 à 2 minutes.
3. Dans le menu de gauche, ouvrez **SQL Editor** (icône de terminal), puis **New query**.
4. Sur votre ordinateur, ouvrez le fichier **`supabase/install.sql`** de l’archive avec le Bloc-notes (ou TextEdit sur Mac). Faites **Tout sélectionner** puis **Copier**.
5. Revenez dans Supabase, **collez** le contenu dans la grande zone de texte et cliquez sur **Run** (en bas à droite). Attendez quelques secondes : le message doit dire **Success** (ou « no rows returned », ce qui est normal).
   - Si un message rouge apparaît, vérifiez que vous avez bien copié *tout* le fichier, puis réessayez sur un projet neuf.
6. Vérification : dans le menu de gauche, ouvrez **Table Editor** : vous devez voir des tables comme `clients`, `properties`, `visits`… Ouvrez aussi **Storage** : trois dossiers (« buckets ») `photos`, `documents` et `branding` doivent exister.

### Récupérer les trois clés Supabase

7. Menu de gauche → **Project Settings** (roue dentée). Deux pages vous intéressent :
   - **Data API** : notez la **Project URL** (commence par `https://` et finit par `.supabase.co`) → c’est `NEXT_PUBLIC_SUPABASE_URL`.
   - **API Keys** → onglet **Legacy API keys** : notez
     - **anon** (longue clé) → c’est `NEXT_PUBLIC_SUPABASE_ANON_KEY`
     - **service_role** (cliquez sur *Reveal* pour l’afficher) → c’est `SUPABASE_SERVICE_ROLE_KEY`. **Cette clé est secrète** : ne la partagez jamais, ne la mettez jamais dans un email.

> Vous préférez les nouvelles clés (onglet **Publishable and secret keys**) ? Elles fonctionnent aussi : la clé `sb_publishable_…` remplace `anon`, et une clé `sb_secret_…` (bouton *Create new API key*) remplace `service_role`. Utilisez une seule famille de clés, pas un mélange des deux.
> Sur une ancienne version de Supabase, tout se trouve sur une seule page nommée **API**.

### Réglages de connexion

8. Menu de gauche → **Authentication** → **Providers** → **Email** : laissez *Enable Email provider* activé. Désactivez **Confirm email** (bouton sur *off*) puis **Save**. Ainsi, les propriétaires que vous créez depuis l’application peuvent se connecter immédiatement.
9. Nous reviendrons dans **Authentication → URL Configuration** à l’étape 4, une fois l’adresse de l’application connue.

---

## Étape 2 — Déposer les fichiers de l’application (GitHub)

1. Allez sur **https://github.com** et créez un compte si besoin.
2. Cliquez sur le **+** en haut à droite → **New repository**.
   - *Repository name* : `auxois-intendance`
   - Cochez **Private** (privé).
   - Cliquez sur **Create repository**.
3. Sur la page qui s’ouvre, cliquez sur le lien **uploading an existing file**.
4. GitHub n’accepte que **100 fichiers par envoi** ; l’application en compte environ 170. Vous allez donc faire **trois envois** depuis le dossier `auxois-intendance` de l’archive, en glissant-déposant les **dossiers entiers** (pas leur contenu ouvert) dans la page GitHub, puis en cliquant sur **Commit changes** en bas de page :
   - **Envoi 1** : tous les **fichiers seuls** à la racine (`package.json`, `next.config.ts`, `tsconfig.json`, `.gitignore`, `.env.example`, `README.md`…) + les dossiers **`supabase`**, **`tests`**, **`scripts`**, **`lib`** et **`public`**.
   - **Envoi 2** (page du dépôt → **Add file → Upload files**) : le dossier **`components`**.
   - **Envoi 3** (même chemin) : le dossier **`app`**.
   - Ne déposez **jamais** de dossier `node_modules` ni `.next` s’ils existent sur votre ordinateur (ils sont inutiles et énormes).
5. À la fin, la page du dépôt doit montrer les dossiers `app`, `components`, `lib`, `public`, `scripts`, `supabase`, `tests` et les fichiers de racine.

> **Autre méthode, tout d’un coup** : installez **GitHub Desktop** (https://desktop.github.com) et connectez-vous. **File → Add local repository** → choisissez le dossier `auxois-intendance` (acceptez « create a repository here » si proposé) → en bas à gauche, écrivez « Première version » → **Commit to main** → **Publish repository** en cochant **Keep this code private**. C’est aussi la méthode la plus simple pour les mises à jour futures.

---

## Étape 3 — Mettre l’application en ligne (Vercel)

1. Allez sur **https://vercel.com** → **Sign up** → **Continue with GitHub** (autorisez Vercel à accéder à votre compte GitHub).
2. Cliquez sur **Add New… → Project**, puis **Import** à côté de `auxois-intendance`.
3. Laissez *Framework Preset* sur **Next.js**. Ne changez rien d’autre pour l’instant.
4. Dépliez **Environment Variables** et ajoutez, une par une, les lignes suivantes (nom à gauche, valeur à droite, puis **Add**) :

   | Nom | Valeur |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | l’adresse *Project URL* notée à l’étape 1 |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | la clé *anon public* |
   | `SUPABASE_SERVICE_ROLE_KEY` | la clé *service_role* |
   | `CRON_SECRET` | une phrase secrète au hasard, par ex. `auxois-2026-notif-xK9p` |
   | `SETUP_SECRET` | un code de votre choix, par ex. `installation-auxois-2026` (il vous sera demandé une seule fois, à l’étape 5) |

   Les autres variables (notifications push, emails) seront ajoutées à l’étape 6 ; l’application fonctionne sans.

5. Cliquez sur **Deploy**. Attendez 2 à 3 minutes. Vercel affiche des confettis et l’adresse de votre application, du type **`https://auxois-intendance-xxxx.vercel.app`**. **Notez cette adresse.**
6. Retournez dans **Settings → Environment Variables** du projet Vercel et ajoutez :
   - `NEXT_PUBLIC_APP_URL` = l’adresse notée juste au-dessus (sans `/` à la fin).
   Puis **Deployments → ⋯ (sur le dernier déploiement) → Redeploy** pour prendre en compte la nouvelle variable.

> **Vous voulez votre propre nom de domaine** (ex. `app.auxois-intendance.fr`) ? Dans Vercel : **Settings → Domains**, ajoutez le domaine et suivez les instructions. Mettez ensuite à jour `NEXT_PUBLIC_APP_URL` et les adresses de l’étape 4.

---

## Étape 4 — Relier Supabase à l’adresse de l’application

1. Dans Supabase : **Authentication → URL Configuration**.
2. *Site URL* : collez l’adresse de l’application (ex. `https://auxois-intendance-xxxx.vercel.app`).
3. *Redirect URLs* : cliquez sur **Add URL** et ajoutez `https://auxois-intendance-xxxx.vercel.app/auth/callback` (même adresse suivie de `/auth/callback`).
4. **Save**.

---

## Étape 5 — Premier démarrage : l’assistant d’installation

1. Ouvrez l’adresse de l’application dans votre navigateur. L’**assistant d’installation** s’affiche automatiquement (tant qu’aucun administrateur n’existe).
2. Saisissez le **code d’installation** (`SETUP_SECRET`), votre **nom**, votre **email** et un **mot de passe** (8 caractères minimum). Ce compte devient le **super administrateur**.
3. L’assistant vous propose d’installer la **démonstration** : trois maisons, quatre clients, un an de visites, photos et documents. Nous vous le conseillons pour découvrir l’application. Notez l’email et le mot de passe du client de démonstration (« Jean Martin ») pour visiter l’espace propriétaire.
   - Vous pourrez tout retirer plus tard dans **Paramètres → Données de démonstration**, avant d’enregistrer vos vrais clients.
4. Vous arrivez sur votre **tableau de bord**. Ouvrez **Paramètres** pour renseigner les coordonnées d’Auxois Intendance et déposer votre logo.

> Si vous avez fait une erreur à cette étape : dans Supabase, **Authentication → Users**, supprimez le compte créé, puis **Table Editor → users**, supprimez la ligne correspondante. Rechargez l’application : l’assistant réapparaît.

---

## Étape 6 — Notifications (push et email)

L’application crée toutes les notifications dans l’espace de chaque personne (cloche en haut à droite). Pour qu’elles arrivent **aussi** sur le téléphone (push) et par email, deux réglages facultatifs :

### 6a. Notifications push (téléphone)

1. Il faut une paire de clés dites « VAPID ». Rendez-vous sur **https://vapidkeys.com** (ou, si vous avez Node.js : `npx web-push generate-vapid-keys`). Vous obtenez une *Public Key* et une *Private Key*.
2. Dans Vercel → **Settings → Environment Variables**, ajoutez :
   - `NEXT_PUBLIC_VAPID_PUBLIC_KEY` = la clé publique
   - `VAPID_PRIVATE_KEY` = la clé privée
   - `VAPID_SUBJECT` = `mailto:votre-email@exemple.fr`
3. **Redeploy** (Deployments → ⋯ → Redeploy).
4. Chaque personne active ensuite les notifications depuis **Profil** (côté propriétaire) ou **Paramètres** (côté équipe), sur chaque appareil. Sur iPhone, il faut d’abord **ajouter l’application à l’écran d’accueil** (voir étape 7).

### 6b. Emails

1. Créez un compte sur **https://resend.com** (gratuit jusqu’à 3 000 emails par mois).
2. **Domains → Add domain** : ajoutez votre nom de domaine et suivez les instructions (quelques lignes à ajouter chez votre fournisseur de nom de domaine). Sans domaine, Resend ne permet d’envoyer qu’à votre propre adresse : c’est suffisant pour tester.
3. **API Keys → Create API Key** : copiez la clé.
4. Dans Vercel → Environment Variables :
   - `RESEND_API_KEY` = la clé
   - `EMAIL_FROM` = `Auxois Intendance <notifications@votre-domaine.fr>`
5. **Redeploy**.

### 6c. Emails de Supabase (mot de passe oublié)

Par défaut, Supabase n’envoie les emails de « mot de passe oublié » qu’aux membres de votre équipe Supabase, et en quantité limitée. Deux solutions :
- **Simple** : depuis une fiche client, le bouton **« Nouveau mot de passe provisoire »** vous donne un mot de passe à communiquer au propriétaire. Aucun réglage nécessaire.
- **Complète** : dans Supabase, **Project Settings → Authentication → SMTP Settings**, activez *Custom SMTP* avec les identifiants fournis par Resend (**Settings → SMTP** dans Resend : serveur `smtp.resend.com`, port `465`, utilisateur `resend`, mot de passe = votre clé API).

### 6d. Tâche planifiée

Les notifications partent immédiatement après chaque action. Par sécurité, Vercel relance aussi l’expédition une fois par jour (fichier `vercel.json`). Rien à faire : Vercel utilise automatiquement `CRON_SECRET`.

---

## Étape 7 — Installer l’application sur un téléphone

L’application est une **PWA** : elle s’installe comme une vraie application, sans App Store.

- **iPhone / iPad (Safari)** : ouvrez l’adresse de l’application → bouton **Partager** (carré avec une flèche) → **Sur l’écran d’accueil** → **Ajouter**.
- **Android (Chrome)** : ouvrez l’adresse → menu **⋮** → **Installer l’application** (ou **Ajouter à l’écran d’accueil**).

Conseillez cette installation à vos propriétaires : l’icône verte « A » apparaît sur leur écran d’accueil, et ils reçoivent les notifications.

---

## Étape 8 — Créer vos vrais clients et propriétés

1. **Clients → Nouveau client** : remplissez la fiche (l’email servira d’identifiant).
2. Sur la fiche du client, **Créer l’accès** : un mot de passe provisoire s’affiche. Communiquez-le au propriétaire (il pourra le changer dans son profil).
   - Si le propriétaire s’est déjà inscrit lui-même sur la page « Créer mon compte » avec la même adresse email, son compte est simplement relié à la fiche.
3. **Propriétés → Nouvelle propriété** : nom, adresse, propriétaire, formule, Carnet Maison.
4. Sur la fiche propriété : **Clés, codes et accès** (visible uniquement par le super administrateur et les intendants, chaque consultation est enregistrée), **Planifier** la première visite, personnaliser la **checklist** si la maison a une piscine, etc.
5. **Paramètres → Utilisateurs** pour inviter d’autres membres de l’équipe (intendant, assistant administratif).

---

## En cas de problème

| Symptôme | Que faire |
|---|---|
| La page affiche « La base de données ne répond pas comme prévu » | Vérifiez l’étape 1 (fichier `install.sql` bien exécuté) et les deux variables `NEXT_PUBLIC_SUPABASE_*` dans Vercel. |
| « La clé de service Supabase n’est pas configurée » | Ajoutez `SUPABASE_SERVICE_ROLE_KEY` dans Vercel puis Redeploy. |
| Les photos ne s’affichent pas | Vérifiez dans Supabase → Storage que les buckets `photos`, `documents`, `branding` existent. Sinon, ré-exécutez le fichier `supabase/migrations/0004_storage.sql` dans le SQL Editor. |
| Un propriétaire ne voit rien dans son espace | Sa fiche client n’est pas reliée à son compte, ou aucune propriété ne lui est rattachée : fiche client → *Créer l’accès*, puis fiche propriété → *Ajouter un propriétaire*. |
| Le lien « mot de passe oublié » n’arrive pas | Voir l’étape 6c. |
| Vous voulez repartir de zéro | Supprimez le projet Supabase et recréez-le (étape 1), puis **Redeploy** sur Vercel. |

Bonne installation !
