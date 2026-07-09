# Installation pas à pas (~20 minutes, tout est gratuit)

Ce guide met TON site en ligne. À la fin tu auras :
- une adresse web accessible depuis n'importe quel appareil ;
- ta base de données personnelle et sécurisée ;
- ton compte utilisateur.

> 💡 Aucune carte bancaire n'est demandée, ni par Supabase, ni par GitHub.

---

## Étape 1 — Créer le projet Supabase (la base de données)

1. Va sur **https://supabase.com** → *Start your project* → crée un compte (le plus simple : *Continue with GitHub*).
2. Clique **New project** :
   - *Name* : `suivi-alternance` (ou ce que tu veux) ;
   - *Database Password* : clique *Generate a password* et **garde-la** dans un gestionnaire de mots de passe (on ne s'en ressert presque jamais) ;
   - *Region* : `West EU (Paris)` ou `Central EU (Frankfurt)`.
3. Attends ~2 minutes que le projet soit prêt.

## Étape 2 — Créer les tables (copier-coller)

1. Dans le menu de gauche de Supabase : **SQL Editor** → *New query*.
2. Ouvre le fichier [`supabase/migrations/001_schema.sql`](supabase/migrations/001_schema.sql) de ce projet, copie **tout** son contenu, colle-le dans l'éditeur.
3. Clique **Run** (en bas à droite). Tu dois voir `Success. No rows returned`.

## Étape 3 — Relier le site à ta base

1. Dans Supabase : **Project Settings** (roue dentée) → **API** (ou *Data API*).
2. Copie deux valeurs :
   - **Project URL** (ex. `https://abcdefghij.supabase.co`) ;
   - la clé **anon / public** (une longue chaîne de caractères).
3. Ouvre le fichier [`docs/js/config.js`](docs/js/config.js) et colle-les entre les guillemets :

```js
export const SUPABASE_URL = "https://abcdefghij.supabase.co";
export const SUPABASE_ANON_KEY = "eyJhbGciOi…";
```

> Cette clé « anon » est prévue pour être publique : la sécurité vient des règles
> installées à l'étape 2 (chaque compte ne voit que ses propres données).

## Étape 4 — Tester en local

1. Double-clique sur **`lancer-app.bat`** (à la racine du projet).
2. Ton navigateur s'ouvre sur la page de connexion → clique *Pas encore de compte ? En créer un*.
3. Crée ton compte. Si un mail de confirmation t'est envoyé, clique le lien qu'il contient puis reconnecte-toi.
4. Tu dois arriver sur ton tableau de bord (vide pour l'instant). Ajoute une offre de test dans l'onglet 📋 Offres pour vérifier que tout marche.

> 🔧 Facultatif : pour ne pas avoir de mail de confirmation à chaque inscription,
> dans Supabase → **Authentication** → **Sign In / Providers** → *Email* → décoche *Confirm email*.

## Étape 5 — (Florent uniquement) Récupérer les données de l'ancien site

Tes 59 offres, candidatures et fiches entreprises de la v2 migrent en une commande.

1. Dans Supabase : **Project Settings** → **API Keys** → copie la clé **`service_role`** (⚠️ celle-ci est SECRÈTE : ne la colle jamais dans un fichier du projet).
2. Ouvre PowerShell dans le dossier `candidatures-app` et lance :

```powershell
$env:SUPABASE_URL = "https://abcdefghij.supabase.co"
$env:SUPABASE_SERVICE_ROLE = "<la clé service_role>"
$env:COMPTE_EMAIL = "florent.coupeau@gmail.com"
node scripts/migration-locale.mjs
```

3. Le script affiche le bilan (offres migrées, répartition des statuts). Recharge le site : tout est là.
4. Ferme PowerShell (les clés en mémoire disparaissent avec).

## Étape 6 — Mettre le site en ligne (GitHub Pages)

1. Sur **https://github.com** : *New repository* → nom `suivi-alternance-app`, visibilité **Public**, ne rien cocher d'autre → *Create repository*.
2. Dans PowerShell, depuis le dossier `candidatures-app` :

```powershell
git add -A
git commit -m "v3.0 — webapp publique"
git remote add origin https://github.com/TON-PSEUDO/suivi-alternance-app.git
git push -u origin main
```

3. Sur la page GitHub du dépôt : **Settings** → **Pages** →
   - *Source* : `Deploy from a branch` ;
   - *Branch* : `main`, dossier **`/docs`** → *Save*.
4. Après 1-2 minutes, ton site est en ligne sur `https://TON-PSEUDO.github.io/suivi-alternance-app/connexion.html` 🎉
5. Ajoute cette adresse aux favoris de ton téléphone et de ton PC.

## Étape 7 — Dernier réglage de sécurité

Dans Supabase : **Authentication** → **URL Configuration** →
- *Site URL* : `https://TON-PSEUDO.github.io/suivi-alternance-app/`

(Ça garantit que les liens des emails — confirmation, mot de passe oublié — ramènent vers TON site.)

---

## En cas de problème

| Symptôme | Cause probable | Solution |
|---|---|---|
| « Configuration manquante » | `config.js` pas rempli | Refais l'étape 3 |
| Page blanche en double-cliquant `index.html` | Les modules JS exigent `http://` | Utilise `lancer-app.bat` ou l'adresse GitHub Pages |
| « Email ou mot de passe incorrect » | — | Bouton *Mot de passe oublié* sur la page de connexion |
| « Confirme d'abord ton email » | Confirmation activée | Ouvre le mail reçu, ou désactive-la (fin de l'étape 4) |
| Le site marche mais plus rien après 1 semaine sans l'ouvrir | Pause du projet Supabase (offre gratuite) | Dashboard Supabase → bouton *Restore* (1 clic) — un garde-fou automatique arrive en v3.4 |
