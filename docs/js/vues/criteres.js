/* Onglet Critères : domaines de recherche, localisation, contrats, exclusions.
   Ces critères servent aux filtres, à la répartition du tableau de bord,
   et (v3.2) au filtrage IA des résultats de recherche LinkedIn. */

import { el, boutonMini, signalerErreur } from "../ui.js";
import { sauverCriteres } from "../donnees.js";

let brouillon = null; // copie de travail, enregistrée seulement au clic sur 💾

export function afficherCriteres(etat) {
  brouillon = structuredClone({
    domaines: etat.criteres?.domaines || [],
    localisation: etat.criteres?.localisation || {},
    contrats: etat.criteres?.contrats || [],
    exclusions: etat.criteres?.exclusions || [],
  });
  rendre(etat);
}

function rendre(etat) {
  const cont = document.getElementById("zone-criteres");
  cont.innerHTML = "";

  // --- Domaines ---
  const carteDom = el("div", "card");
  carteDom.append(el("h2", null, "🧭 Mes domaines de recherche"));
  carteDom.append(el("p", "aide-fiches",
    "Un domaine = un type de poste que tu vises. Les mots-clés serviront aux recherches automatiques."));

  brouillon.domaines.forEach((d, i) => {
    const bloc = el("div", "bloc-domaine");
    const entete = el("div", "entete-ent");
    const champNom = champTexte("Nom du domaine (ex. Développement web)", d.nom, (v) => { d.nom = v; d.id = slug(v) || d.id; });
    entete.append(champNom);
    entete.append(boutonMini("🗑️", "Supprimer ce domaine", () => {
      brouillon.domaines.splice(i, 1);
      rendre(etat);
    }));
    bloc.append(entete);
    bloc.append(libelle("Postes visés (un par ligne)"));
    bloc.append(champListe(d.postes, (v) => { d.postes = v; }));
    bloc.append(libelle("Mots-clés de recherche (un par ligne)"));
    bloc.append(champListe(d.mots_cles, (v) => { d.mots_cles = v; }));
    carteDom.append(bloc);
  });

  carteDom.append(boutonMini("➕ Ajouter un domaine", "Ajouter un domaine de recherche", () => {
    brouillon.domaines.push({ id: "domaine-" + (brouillon.domaines.length + 1), nom: "", postes: [], mots_cles: [] });
    rendre(etat);
  }));
  cont.append(carteDom);

  // --- Localisation & contrats ---
  const carteLoc = el("div", "card");
  carteLoc.append(el("h2", null, "📍 Localisation & contrats"));
  carteLoc.append(libelle("Zone géographique (ex. Paris et région, France entière…)"));
  carteLoc.append(champTexte("Zone", brouillon.localisation.zone || "", (v) => { brouillon.localisation.zone = v; }));
  const modes = el("div", "ligne-cases");
  for (const [cle, texte] of [["teletravail", "Télétravail"], ["hybride", "Hybride"], ["presentiel", "Présentiel"]]) {
    const lab = el("label", "case-mode");
    const case_ = document.createElement("input");
    case_.type = "checkbox";
    case_.checked = brouillon.localisation[cle] !== false;
    case_.addEventListener("change", () => { brouillon.localisation[cle] = case_.checked; });
    lab.append(case_, document.createTextNode(" " + texte));
    modes.append(lab);
  }
  carteLoc.append(modes);
  carteLoc.append(libelle("Types de contrat acceptés (un par ligne)"));
  carteLoc.append(champListe(brouillon.contrats, (v) => { brouillon.contrats = v; }));
  cont.append(carteLoc);

  // --- Exclusions ---
  const carteExcl = el("div", "card");
  carteExcl.append(el("h2", null, "🚫 Exclusions"));
  carteExcl.append(el("p", "aide-fiches", "Entreprises ou mots à éviter (un par ligne) — l'IA écartera ces offres."));
  carteExcl.append(champListe(brouillon.exclusions, (v) => { brouillon.exclusions = v; }));
  cont.append(carteExcl);

  // --- Enregistrer ---
  const barre = el("div", "barre-enregistrer");
  const btn = el("button", "btn-principal", "💾 Enregistrer mes critères");
  btn.addEventListener("click", async () => {
    brouillon.domaines = brouillon.domaines.filter((d) => d.nom.trim());
    try {
      await sauverCriteres(etat.userId, brouillon);
      await etat.rafraichir();
    } catch (e) {
      signalerErreur(e, "Impossible d'enregistrer les critères.");
    }
  });
  barre.append(btn);
  cont.append(barre);
}

/* ---------- Petits champs ---------- */

function libelle(texte) {
  return el("div", "libelle-champ", texte);
}

function champTexte(placeholder, valeur, majuscule) {
  const input = document.createElement("input");
  input.type = "text";
  input.className = "champ-critere";
  input.placeholder = placeholder;
  input.value = valeur;
  input.addEventListener("input", () => majuscule(input.value.trim()));
  return input;
}

function champListe(valeurs, maj) {
  const ta = document.createElement("textarea");
  ta.className = "editeur-notes";
  ta.rows = Math.max(2, (valeurs || []).length + 1);
  ta.value = (valeurs || []).join("\n");
  ta.addEventListener("input", () => maj(ta.value.split("\n").map((l) => l.trim()).filter(Boolean)));
  return ta;
}

function slug(texte) {
  return texte.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
