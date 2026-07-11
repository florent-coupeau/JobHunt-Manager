# 🚀 Compagnon local — recherche LinkedIn « turbo » (optionnel)

Le site cherche les offres LinkedIn via la page publique — correct, mais limité et
parfois bloqué. Ce compagnon est le **mode turbo optionnel** : il tourne sur **ton PC**,
utilise **ton compte LinkedIn** (via Claude Code et un serveur MCP) pour obtenir les
vrais résultats de recherche, les trie selon tes critères, et les insère directement
dans ta base — les offres apparaissent sur le site, y compris sur ton téléphone.

**Rien ne passe par un serveur de l'application** : tout se joue entre ton PC, ton
compte LinkedIn, ton compte Claude et ta base Supabase.

## Prérequis (une seule fois)

1. **Node.js ≥ 18** — https://nodejs.org (déjà nécessaire pour `lancer-app.bat`).
2. **Claude Code** — l'extension VS Code ou la CLI (`claude`), avec un compte actif.
3. **uv** (qui fournit `uvx`, pour lancer le serveur MCP LinkedIn) — https://docs.astral.sh/uv/
4. Copie `.env.exemple` vers `.env` (dans ce dossier) et remplis **ton email et ton
   mot de passe du site**. Ce fichier reste sur ton PC (ignoré par git).

## Utilisation

- **Double-clic sur `rechercher.bat`** → cherche le premier domaine de tes critères.
- Ou en ligne de commande, pour viser un domaine précis :
  ```
  node rechercher.mjs data
  ```
  (le premier domaine dont le nom contient « data »)

Le script affiche sa progression, puis un résumé : `✅ 6 nouvelle(s) offre(s) ajoutée(s)`.
Ouvre le site → onglet 📋 Offres : elles sont là, en 🆕 Nouvelle.

## ⚠️ À savoir

- Le serveur MCP interroge LinkedIn **avec ton compte** : reste modéré (le script se
  limite à 2 recherches et ~15 offres par lancement). Un usage intensif pourrait
  attirer l'attention de LinkedIn sur ton compte.
- Chaque lancement consomme un peu de crédit / d'usage Claude Code.
- Le tri (alternance uniquement, exclusions, pertinence) est fait par Claude à partir
  de l'onglet 🧭 Critères du site — garde-le à jour.

## Comment ça marche

```
rechercher.bat
  └─ rechercher.mjs (Node, zéro dépendance)
       1. se connecte à Supabase avec TES identifiants (compagnon/.env)
       2. lit tes critères + les offres déjà connues (dédoublonnage)
       3. lance « claude -p » avec le serveur MCP LinkedIn (compagnon/mcp.json)
       4. récupère le JSON d'offres triées par Claude
       5. insère les nouvelles dans Supabase → visibles sur le site partout
```
