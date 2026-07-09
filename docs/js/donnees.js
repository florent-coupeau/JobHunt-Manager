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
  const [offres, entreprises, criteres] = await Promise.all([
    supabase.from("offres").select("*").order("date_ajout", { ascending: false }),
    supabase.from("entreprises").select("*").order("nom"),
    supabase.from("criteres").select("*").maybeSingle(),
  ]);
  let mesCriteres = verifier(criteres, "Chargement des critères");
  if (!mesCriteres) {
    // Premier lancement : on installe des critères de départ.
    mesCriteres = { user_id: userId, ...CRITERES_DEFAUT };
    verifier(await supabase.from("criteres").insert(mesCriteres), "Création des critères");
  }
  return {
    offres: verifier(offres, "Chargement des offres") || [],
    entreprises: verifier(entreprises, "Chargement des entreprises") || [],
    criteres: mesCriteres,
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
