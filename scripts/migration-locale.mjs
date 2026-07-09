/* Migration one-shot : les JSON locaux (../../data/) → le compte Supabase de l'utilisateur.
   Fusionne offres + candidatures dans le nouveau cycle de statuts unique (v3).

   Usage (PowerShell, depuis le dossier candidatures-app) :
     $env:SUPABASE_URL = "https://xxxx.supabase.co"
     $env:SUPABASE_SERVICE_ROLE = "<clé service_role — onglet Settings → API Keys>"
     $env:COMPTE_EMAIL = "florent.coupeau@gmail.com"   # le compte doit déjà exister
     node scripts/migration-locale.mjs

   La clé service_role contourne la sécurité RLS : ne JAMAIS la mettre dans un fichier
   du projet ni la committer. Réexécutable sans risque : les doublons sont ignorés. */

import { readFileSync } from "node:fs";

const URL_PROJET = process.env.SUPABASE_URL;
const CLE = process.env.SUPABASE_SERVICE_ROLE;
const EMAIL = process.env.COMPTE_EMAIL;
if (!URL_PROJET || !CLE || !EMAIL) {
  console.error("Il manque une variable d'environnement : SUPABASE_URL, SUPABASE_SERVICE_ROLE ou COMPTE_EMAIL.");
  process.exit(1);
}

const DATA = new URL("../../data/", import.meta.url);
const lire = (fichier) => JSON.parse(readFileSync(new URL(fichier, DATA), "utf8"));

async function api(chemin, options = {}) {
  const rep = await fetch(`${URL_PROJET}${chemin}`, {
    ...options,
    headers: {
      apikey: CLE,
      Authorization: `Bearer ${CLE}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
  if (!rep.ok) throw new Error(`${chemin} → HTTP ${rep.status} : ${await rep.text()}`);
  return rep.status === 204 ? null : rep.json();
}

/* ---------- 1. Retrouver l'utilisateur par email ---------- */

async function trouverUtilisateur() {
  const { users } = await api(`/auth/v1/admin/users?page=1&per_page=200`);
  const u = (users || []).find((x) => x.email?.toLowerCase() === EMAIL.toLowerCase());
  if (!u) {
    console.error(`Aucun compte ${EMAIL} : crée d'abord le compte via la page de connexion du site.`);
    process.exit(1);
  }
  return u.id;
}

/* ---------- 2. Fusion offres + candidatures → nouveau statut unique ---------- */

const MAPPING_CANDIDATURE = {
  a_postuler: "a_postuler",
  postule: "envoyee",
  relance: "envoyee",
  entretien: "entretien",
  reponse_positive: "acceptee",
  refus: "refusee",
};

function fusionner(offres, candidatures) {
  const parOffre = new Map(candidatures.map((c) => [c.offre_id, c]));
  return offres.map((o) => {
    const cand = parOffre.get(o.id);
    let statut;
    if (cand) statut = MAPPING_CANDIDATURE[cand.statut] || "a_postuler";
    else if (o.statut === "interessante") statut = "a_postuler";
    else statut = o.statut; // nouvelle | ecartee
    return {
      source: o.id?.startsWith("li-") ? "linkedin" : "manuel",
      source_ref: o.id || null,
      titre: o.titre || "",
      entreprise: o.entreprise || "",
      lieu: o.lieu || "",
      lien: o.lien || "",
      description_resume: o.description_resume || "",
      domaine: o.domaine || "",
      date_publication: o.date_publication || null,
      date_ajout: o.date_ajout || null,
      statut,
      date_candidature: cand?.date_candidature || null,
      date_relance_prevue: cand?.date_relance_prevue || null,
      notes: cand?.notes || "",
      historique: cand?.historique || [],
    };
  });
}

/* ---------- 3. Exécution ---------- */

const userId = await trouverUtilisateur();
console.log(`Compte trouvé : ${EMAIL} (${userId})`);

const offres = lire("offres.json").offres || [];
const candidatures = lire("candidatures.json").candidatures || [];
const entreprises = lire("entreprises.json").entreprises || [];
const criteres = lire("criteres.json");

// Offres (doublons ignorés grâce à source_ref)
const dejaLa = new Set(
  (await api(`/rest/v1/offres?user_id=eq.${userId}&select=source_ref`)).map((x) => x.source_ref)
);
const nouvelles = fusionner(offres, candidatures)
  .filter((o) => !dejaLa.has(o.source_ref))
  .map((o) => ({ ...o, user_id: userId }));
if (nouvelles.length) await api(`/rest/v1/offres`, { method: "POST", body: JSON.stringify(nouvelles) });
console.log(`Offres : ${nouvelles.length} migrées, ${offres.length - nouvelles.length} déjà présentes.`);

// Fiches entreprises (doublons ignorés par nom)
const nomsConnus = new Set(
  (await api(`/rest/v1/entreprises?user_id=eq.${userId}&select=nom`)).map((x) => x.nom.toLowerCase())
);
const fiches = entreprises
  .filter((e) => !nomsConnus.has(e.nom.toLowerCase()))
  .map((e) => ({
    user_id: userId,
    nom: e.nom,
    linkedin_url: e.linkedin_url || "",
    secteur: e.secteur || "",
    taille: e.taille || "",
    description: e.description || "",
    posts_recents: e.posts_recents || [],
    contacts: e.contacts || [],
    notes: e.notes || "",
  }));
if (fiches.length) await api(`/rest/v1/entreprises`, { method: "POST", body: JSON.stringify(fiches) });
console.log(`Entreprises : ${fiches.length} migrées, ${entreprises.length - fiches.length} déjà présentes.`);

// Critères (la rotation de domaines n'existe plus en v3)
await api(`/rest/v1/criteres`, {
  method: "POST",
  headers: { Prefer: "resolution=merge-duplicates" },
  body: JSON.stringify({
    user_id: userId,
    domaines: criteres.domaines || [],
    localisation: criteres.localisation || {},
    contrats: criteres.contrats || [],
    exclusions: criteres.exclusions || [],
  }),
});
console.log("Critères : migrés.");

// Bilan par statut pour vérification
const bilan = {};
for (const o of fusionner(offres, candidatures)) bilan[o.statut] = (bilan[o.statut] || 0) + 1;
console.log("Répartition attendue des statuts :", bilan);
console.log("✅ Migration terminée — ouvre le site et vérifie tes onglets.");
