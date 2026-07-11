# 🎯 Suivi Alternance

**➡️ Utiliser l'application : https://florent-coupeau.github.io/JobHunt-Manager/connexion.html**

Webapp **gratuite et open-source** pour gérer sa recherche d'alternance (ou d'emploi) de bout en bout :
offres, candidatures, relances, fiches entreprises — le tout depuis n'importe quel appareil.
Crée ton compte et c'est parti — ou installe ta propre copie en suivant [INSTALLATION.md](INSTALLATION.md).

## Fonctionnalités (v3.0)

- **Compte personnel** : tes données te suivent sur PC, téléphone, tablette. Personne d'autre ne peut les voir (sécurité par Row Level Security).
- **Cycle de candidature simple** : une offre est `🆕 Nouvelle` → `📝 À postuler` → `📤 Envoyée` → `🗣️ Entretien` → `✅ Acceptée` / `❌ Refusée`, ou `✖ Écartée` à tout moment.
- **Kanban** : fais glisser tes candidatures d'étape en étape.
- **Relances automatiques J+7** : dès qu'une candidature est envoyée, une relance est programmée 7 jours plus tard et apparaît sur ton tableau de bord.
- **Fiches entreprises** avec notes personnelles.
- **Critères de recherche** : tes domaines, postes visés, mots-clés, exclusions.
- **Thème clair / sombre**, interface en français, pensée pour les non-techniciens.

## Feuille de route

| Version | Contenu |
|---|---|
| v3.0 ✅ | Comptes + suivi complet des candidatures |
| v3.1 ✅ | Connexion de TON assistant IA (clé API Gemini gratuite ou Anthropic Claude) : ajout d'offres et fiches entreprises en collant un texte — la clé reste dans ton navigateur |
| v3.2 ✅ | Recherche automatique d'offres LinkedIn (page publique, sans compte — avec avertissement sur les limites, tri par ton IA, 5 recherches/jour) |
| v3.5 ✅ | Étiquettes personnalisées (tri libre des offres), ajout d'offre en collant juste le lien (ton IA lit la page, relais public en secours), recherche LinkedIn 100 % côté navigateur (relais public + ton IA en secours) — plus aucune Edge Function |
| v3.3 | Master CV + génération d'un CV sur-mesure par offre (PDF) |
| v3.4 | Statistiques avancées, démo publique, export de données, suppression de compte |

## Stack (100 % gratuite)

- **Frontend** : HTML/CSS/JavaScript sans framework ni build — hébergé sur GitHub Pages.
- **Backend** : [Supabase](https://supabase.com) free tier (Postgres + Auth + RLS) — uniquement la base de données : les lectures de pages web (offres, LinkedIn) passent par ton fournisseur IA, jamais par un serveur à nous.
- **IA** (à partir de v3.1) : ta propre clé API (Gemini a un palier gratuit) — elle ne quitte jamais ton navigateur.

## Installation

Voir [INSTALLATION.md](INSTALLATION.md) : ~20 minutes, aucune compétence technique requise.

## 🚀 Mode turbo (optionnel, pour utilisateurs techniques)

La recherche LinkedIn du site lit la page publique — correcte mais limitée. Le
[compagnon local](compagnon/README.md) tourne sur ton PC avec Claude Code + ton compte
LinkedIn (serveur MCP) : résultats complets, triés par IA, insérés directement dans ta
base — visibles sur le site partout, même sur téléphone. Voir [compagnon/README.md](compagnon/README.md).

## Structure du projet

```
docs/            → le site (racine GitHub Pages)
  js/            → modules de l'application
  data-demo/     → jeu de données factices (mode démo)
supabase/
  migrations/    → schéma SQL à coller dans Supabase
compagnon/       → mode turbo optionnel : recherche LinkedIn via Claude Code + MCP (sur ton PC)
scripts/         → outils ponctuels (migration de données locales)
serveur-dev.js   → serveur de test local (lancer-app.bat)
```

---

Projet étudiant, budget 0 €, construit avec [Claude Code](https://claude.com/claude-code).
