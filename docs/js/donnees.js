/* Couche d'accès aux données : tout passe par Supabase (RLS = données perso). */

import { supabase } from "./supabase.js";

/* Critères proposés au premier lancement — l'utilisateur les adapte dans l'onglet Critères. */
export const CRITERES_DEFAUT = {
  domaines: [
    {
      id: "domaine-1",
      nom: "Mon domaine principal",
      postes: ["Intitulé de poste recherché"],
      mots_cles: ["alternance + ton métier"],
    },
  ],
  localisation: { zone: "France entière", teletravail: true, presentiel: true, hybride: true },
  contrats: ["Alternance", "Contrat d'apprentissage", "Contrat de professionnalisation"],
  exclusions: [],
};

function verifier(reponse, contexte) {
  if (reponse.error) throw new Error(`${contexte} : ${reponse.error.message}`);
  return reponse.data;
}

/* ---------- Chargement global ---------- */

export async function chargerTout(userId) {
  const [offres, entreprises, criteres, parametres, etiquettes] = await Promise.all([
    supabase.from("offres").select("*").order("date_ajout", { ascending: false }),
    supabase.from("entreprises").select("*").order("nom"),
    supabase.from("criteres").select("*").maybeSingle(),
    supabase.from("parametres").select("*").maybeSingle(),
    supabase.from("etiquettes").select("*").order("ordre").order("nom"),
  ]);
  let mesCriteres = verifier(criteres, "Chargement des critères");
  if (!mesCriteres) {
    // Premier lancement : on installe des critères de départ.
    mesCriteres = { user_id: userId, ...CRITERES_DEFAUT };
    verifier(await supabase.from("criteres").insert(mesCriteres), "Création des critères");
  }
  if (etiquettes.error && /etiquettes/.test(etiquettes.error.message)) {
    throw new Error(
      "La table des étiquettes n'existe pas encore : exécute la migration " +
      "supabase/migrations/002_etiquettes.sql dans Supabase (SQL Editor → New query → Run)."
    );
  }
  return {
    offres: verifier(offres, "Chargement des offres") || [],
    entreprises: verifier(entreprises, "Chargement des entreprises") || [],
    criteres: mesCriteres,
    parametres: verifier(parametres, "Chargement des paramètres") || null,
    etiquettes: verifier(etiquettes, "Chargement des étiquettes") || [],
  };
}

/* ---------- Offres ---------- */

export async function creerOffre(userId, champs) {
  verifier(await supabase.from("offres").insert({ user_id: userId, ...champs }), "Ajout de l'offre");
}

export async function majOffre(id, patch) {
  verifier(await supabase.from("offres").update(patch).eq("id", id), "Mise à jour de l'offre");
}

export async function supprimerOffre(id) {
  verifier(await supabase.from("offres").delete().eq("id", id), "Suppression de l'offre");
}

/* ---------- Étiquettes (tri personnel) ---------- */

/* Couleurs proposées aux nouvelles étiquettes, à tour de rôle. */
export const PALETTE_ETIQUETTES = ["#e05d5d", "#e0965d", "#d9c04a", "#5db56b", "#4aa8d9", "#7c6ff0", "#c96fd9"];

export async function creerEtiquette(userId, champs) {
  // .select().single() : on récupère la ligne créée (son id sert à l'affecter aussitôt)
  return verifier(
    await supabase.from("etiquettes").insert({ user_id: userId, ...champs }).select().single(),
    "Création de l'étiquette"
  );
}

export async function majEtiquette(id, patch) {
  verifier(await supabase.from("etiquettes").update(patch).eq("id", id), "Mise à jour de l'étiquette");
}

export async function supprimerEtiquette(id) {
  verifier(await supabase.from("etiquettes").delete().eq("id", id), "Suppression de l'étiquette");
}

/* ---------- Entreprises ---------- */

export async function creerEntreprise(userId, champs) {
  verifier(await supabase.from("entreprises").insert({ user_id: userId, ...champs }), "Ajout de la fiche");
}

export async function majEntreprise(id, patch) {
  verifier(await supabase.from("entreprises").update(patch).eq("id", id), "Mise à jour de la fiche");
}

export async function supprimerEntreprise(id) {
  verifier(await supabase.from("entreprises").delete().eq("id", id), "Suppression de la fiche");
}

/* ---------- Critères ---------- */

export async function sauverCriteres(userId, criteres) {
  verifier(
    await supabase.from("criteres").upsert({ ...criteres, user_id: userId, derniere_maj: new Date().toISOString() }),
    "Enregistrement des critères"
  );
}
