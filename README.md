# 🎯 Suivi Alternance

Webapp **gratuite et open-source** pour gérer sa recherche d'alternance (ou d'emploi) de bout en bout :
offres, candidatures, relances, fiches entreprises — le tout depuis n'importe quel appareil.

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
| v3.0 ✅ | Comptes + suivi complet des candidatures (cette version) |
| v3.1 | Connexion de TON assistant IA (clé API Gemini gratuite ou Anthropic) : ajout d'offres en collant un lien ou un texte |
| v3.2 | Recherche automatique d'offres LinkedIn (avec avertissement sur les limites) |
| v3.3 | Master CV + génération d'un CV sur-mesure par offre (PDF) |
| v3.4 | Statistiques avancées, démo publique, export de données, suppression de compte |

## Stack (100 % gratuite)

- **Frontend** : HTML/CSS/JavaScript sans framework ni build — hébergé sur GitHub Pages.
- **Backend** : [Supabase](https://supabase.com) free tier (Postgres + Auth + RLS + Edge Functions).
- **IA** (à partir de v3.1) : ta propre clé API (Gemini a un palier gratuit) — elle ne quitte jamais ton navigateur.

## Installation

Voir [INSTALLATION.md](INSTALLATION.md) : ~20 minutes, aucune compétence technique requise.

## Structure du projet

```
docs/            → le site (racine GitHub Pages)
  js/            → modules de l'application
  data-demo/     → jeu de données factices (mode démo)
supabase/
  migrations/    → schéma SQL à coller dans Supabase
scripts/         → outils ponctuels (migration de données locales)
serveur-dev.js   → serveur de test local (lancer-app.bat)
```

---

Projet étudiant, budget 0 €, construit avec [Claude Code](https://claude.com/claude-code).
