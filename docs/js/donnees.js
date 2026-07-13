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

/* ---------- Mode démo (données factices, lecture seule) ---------- */

let modeDemo = false;

export function activerModeDemo() {
  modeDemo = true;
}

/* Appelée en première ligne de toute fonction qui écrit en base : bloque
   net en mode démo, avec un message clair repris par signalerErreur() côté vue. */
function verifierEcriture() {
  if (modeDemo) throw new Error("Mode démo : lecture seule (données factices) — crée ton compte gratuit pour interagir pour de vrai.");
}

/* Charge les données FACTICES de démonstration (docs/data-demo/*.json), sans
   compte ni Supabase — même forme que chargerTout() pour que le reste de
   l'appli n'ait rien à savoir du mode démo. */
export async function chargerDemo() {
  const [offres, entreprises, criteres] = await Promise.all([
    fetch("data-demo/offres.json").then((r) => r.json()),
    fetch("data-demo/entreprises.json").then((r) => r.json()),
    fetch("data-demo/criteres.json").then((r) => r.json()),
  ]);
  return {
    offres: offres.offres || [],
    entreprises: entreprises.entreprises || [],
    criteres,
    parametres: null,
    etiquettes: [],
    masterCV: { contenu: {} },
    stylesCV: [],
  };
}

/* ---------- Chargement global ---------- */

export async function chargerTout(userId) {
  const [offres, entreprises, criteres, parametres, etiquettes, masterCV, stylesCV] = await Promise.all([
    supabase.from("offres").select("*").order("date_ajout", { ascending: false }),
    supabase.from("entreprises").select("*").order("nom"),
    supabase.from("criteres").select("*").maybeSingle(),
    supabase.from("parametres").select("*").maybeSingle(),
    supabase.from("etiquettes").select("*").order("ordre").order("nom"),
    supabase.from("master_cv").select("*").maybeSingle(),
    supabase.from("styles_cv").select("*").order("cree_le"),
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
  if (stylesCV.error && /styles_cv/.test(stylesCV.error.message)) {
    throw new Error(
      "La table des styles de CV n'existe pas encore : exécute la migration " +
      "supabase/migrations/003_styles_cv.sql dans Supabase (SQL Editor → New query → Run)."
    );
  }
  let monCV = verifier(masterCV, "Chargement du CV");
  if (!monCV) {
    // Premier lancement : on installe une ligne vide, remplie dans l'onglet Mon CV.
    monCV = { user_id: userId, contenu: {} };
    verifier(await supabase.from("master_cv").insert(monCV), "Création du CV");
  }
  return {
    offres: verifier(offres, "Chargement des offres") || [],
    entreprises: verifier(entreprises, "Chargement des entreprises") || [],
    criteres: mesCriteres,
    parametres: verifier(parametres, "Chargement des paramètres") || null,
    etiquettes: verifier(etiquettes, "Chargement des étiquettes") || [],
    masterCV: monCV,
    stylesCV: verifier(stylesCV, "Chargement des styles de CV") || [],
  };
}

/* ---------- Offres ---------- */

export async function creerOffre(userId, champs) {
  verifierEcriture();
  verifier(await supabase.from("offres").insert({ user_id: userId, ...champs }), "Ajout de l'offre");
}

export async function majOffre(id, patch) {
  verifierEcriture();
  verifier(await supabase.from("offres").update(patch).eq("id", id), "Mise à jour de l'offre");
}

export async function supprimerOffre(id) {
  verifierEcriture();
  verifier(await supabase.from("offres").delete().eq("id", id), "Suppression de l'offre");
}

/* ---------- Étiquettes (tri personnel) ---------- */

/* Couleurs proposées aux nouvelles étiquettes, à tour de rôle. */
export const PALETTE_ETIQUETTES = ["#e05d5d", "#e0965d", "#d9c04a", "#5db56b", "#4aa8d9", "#7c6ff0", "#c96fd9"];

export async function creerEtiquette(userId, champs) {
  verifierEcriture();
  // .select().single() : on récupère la ligne créée (son id sert à l'affecter aussitôt)
  return verifier(
    await supabase.from("etiquettes").insert({ user_id: userId, ...champs }).select().single(),
    "Création de l'étiquette"
  );
}

export async function majEtiquette(id, patch) {
  verifierEcriture();
  verifier(await supabase.from("etiquettes").update(patch).eq("id", id), "Mise à jour de l'étiquette");
}

export async function supprimerEtiquette(id) {
  verifierEcriture();
  verifier(await supabase.from("etiquettes").delete().eq("id", id), "Suppression de l'étiquette");
}

/* ---------- Entreprises ---------- */

export async function creerEntreprise(userId, champs) {
  verifierEcriture();
  verifier(await supabase.from("entreprises").insert({ user_id: userId, ...champs }), "Ajout de la fiche");
}

export async function majEntreprise(id, patch) {
  verifierEcriture();
  verifier(await supabase.from("entreprises").update(patch).eq("id", id), "Mise à jour de la fiche");
}

export async function supprimerEntreprise(id) {
  verifierEcriture();
  verifier(await supabase.from("entreprises").delete().eq("id", id), "Suppression de la fiche");
}

/* ---------- Critères ---------- */

export async function sauverCriteres(userId, criteres) {
  verifierEcriture();
  verifier(
    await supabase.from("criteres").upsert({ ...criteres, user_id: userId, derniere_maj: new Date().toISOString() }),
    "Enregistrement des critères"
  );
}

/* ---------- Master CV + CV générés ---------- */

export async function sauverMasterCV(userId, contenu) {
  verifierEcriture();
  verifier(
    await supabase.from("master_cv").upsert({ user_id: userId, contenu, maj_le: new Date().toISOString() }),
    "Enregistrement du CV"
  );
}

/* Dernier CV généré pour une offre AVEC ce style précis (ou null si aucun n'existe encore).
   `style` = "json" pour les 3 styles intégrés (contenu identique, CSS différent),
   ou l'id d'un style personnalisé (contenu propre à son gabarit). */
export async function dernierCVGenere(offreId, style) {
  return verifier(
    await supabase.from("cv_generes").select("*").eq("offre_id", offreId).eq("style", style)
      .order("cree_le", { ascending: false }).limit(1).maybeSingle(),
    "Chargement du CV généré"
  );
}

export async function creerCVGenere(userId, offreId, style, contenu) {
  verifierEcriture();
  return verifier(
    await supabase.from("cv_generes").insert({ user_id: userId, offre_id: offreId, style, contenu }).select().single(),
    "Enregistrement du CV généré"
  );
}

/* ---------- Styles de CV personnalisés (gabarit HTML importé d'un .docx) ---------- */

export async function creerStyleCV(userId, nom, gabaritHtml) {
  verifierEcriture();
  return verifier(
    await supabase.from("styles_cv").insert({ user_id: userId, nom, gabarit_html: gabaritHtml }).select().single(),
    "Enregistrement du style de CV"
  );
}

export async function supprimerStyleCV(id) {
  verifierEcriture();
  verifier(await supabase.from("styles_cv").delete().eq("id", id), "Suppression du style de CV");
}

/* ---------- Suppression de compte (RGPD) ---------- */

/* Supprime définitivement le compte ET toutes ses données (cascade en base,
   voir supabase/migrations/004_suppression_compte.sql). Irréversible. */
export async function supprimerMonCompte() {
  verifierEcriture();
  const { error } = await supabase.rpc("supprimer_mon_compte");
  if (error) throw new Error("Suppression du compte : " + error.message);
}
