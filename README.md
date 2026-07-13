# 🎯 Suivi Alternance

**Pilote ta recherche d'alternance de bout en bout, avec ton assistant IA intégré.**

➡️ **[Utiliser l'application](https://florent-coupeau.github.io/JobHunt-Manager/connexion.html)** · 🔍 **[Essayer la démo](https://florent-coupeau.github.io/JobHunt-Manager/index.html?demo=1)** (sans compte, données factices)

Webapp **gratuite et open-source** : offres, candidatures, relances, CV sur-mesure,
fiches entreprises — le tout depuis n'importe quel appareil, en français, pensée
pour les non-techniciens.

## Ce que l'application sait faire

### Suivre tes candidatures
- **Tableau de bord** avec les actions du jour et les **relances automatiques J+7** : dès qu'une candidature est envoyée, la relance est programmée.
- **Kanban** en glisser-déposer : `🆕 Nouvelle` → `📝 À postuler` → `📤 Envoyée` → `🗣️ Entretien` → `✅ Acceptée`.
- **Étiquettes personnalisées**, notes libres, **statistiques** sur toute ta recherche.

### Trouver et capturer les offres
- **Recherche LinkedIn intégrée**, 100 % depuis ton navigateur — ton compte LinkedIn n'est jamais utilisé.
- **Ajout d'une offre en collant son lien** (ou le texte de l'annonce) : ton IA lit la page et remplit la fiche toute seule.
- **Fiches entreprises** rédigées par l'IA, enrichies de tes notes personnelles.

### Postuler mieux
- **Master CV** : ton parcours complet, saisi une seule fois.
- **Génération d'un CV sur-mesure par offre** (PDF), avec des styles personnalisables.

### Tes données restent à toi
- **Compte personnel multi-appareils** : PC, téléphone, tablette — et personne d'autre ne voit tes données (Row Level Security).
- **Ta clé IA** (Gemini, palier gratuit, ou Anthropic Claude) **ne quitte jamais ton navigateur**.
- **Export complet** de tes données et **suppression de compte** en un clic.
- Thème clair / sombre, interface entièrement en français.

## Comment c'est construit

Architecture **100 % côté client** — il n'existe aucun serveur applicatif :

- **Frontend** : HTML / CSS / JavaScript vanilla (modules ES), sans framework ni build, hébergé sur **GitHub Pages**.
- **Base de données** : **Supabase** free tier (Postgres + Auth + Row Level Security).
- **IA** : la clé API de chaque utilisateur, stockée dans son navigateur. Les lectures de pages web (offres, LinkedIn) passent par son fournisseur IA ou un relais public — jamais par un serveur à nous.

Budget de fonctionnement : **0 €**.

## 🚀 Mode turbo (optionnel, pour utilisateurs techniques)

La recherche LinkedIn du site lit la page publique — correcte mais limitée. Le
[compagnon local](compagnon/README.md) tourne sur ton PC avec Claude Code + ton compte
LinkedIn (serveur MCP) : résultats complets, triés par IA, insérés directement dans ta
base — visibles sur le site partout, même sur téléphone.

## Héberger ta propre instance

Créer un compte sur [l'application](https://florent-coupeau.github.io/JobHunt-Manager/connexion.html) suffit pour l'utiliser.
Si tu préfères ta propre copie (ton Supabase, ton GitHub Pages), suis [INSTALLATION.md](INSTALLATION.md).

## Structure du projet

```
docs/            → le site (racine GitHub Pages)
  js/            → modules de l'application
  data-demo/     → jeu de données factices (mode démo)
supabase/
  migrations/    → schéma SQL à coller dans Supabase
compagnon/       → mode turbo optionnel : recherche LinkedIn via Claude Code + MCP (sur ton PC)
serveur-dev.js   → serveur de test local (lancer-app.bat)
```

---

Projet étudiant, budget 0 €, conçu et développé avec [Claude Code](https://claude.com/claude-code).
