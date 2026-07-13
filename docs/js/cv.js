/* Master CV + génération d'un CV ciblé par offre.
   Le CV maître (exhaustif) et chaque CV généré (adapté à une offre) partagent
   la même structure JSON — voir CV_VIDE ci-dessous. */

import { el } from "./ui.js";
import { appelIA } from "./ia.js";

export const CV_VIDE = {
  identite: { nom: "", titre_recherche: "", email: "", telephone: "", ville: "", linkedin: "", portfolio: "" },
  accroche: "",
  experiences: [],   // { poste, entreprise, lieu, debut, fin, bullets: [] }
  formations: [],    // { diplome, etablissement, lieu, debut, fin, details }
  competences: [],   // { categorie, items: [] }
  projets: [],       // { nom, description, bullets: [], lien }
  langues: [],       // { langue, niveau }
  certifications: [],
  interets: [],
};

/* Un CV maître compte comme « rempli » dès qu'il a une identité et au moins
   une expérience ou une formation à mettre en avant. */
export function masterCVRempli(contenu) {
  return Boolean(contenu?.identite?.nom && (contenu.experiences?.length || contenu.formations?.length));
}

/* Forme JSON partagée par l'extraction (texte collé → CV maître) et la
   génération ciblée (CV maître → CV pour une offre). */
const FORME_CV_JSON =
  '{"identite": {"nom": string, "titre_recherche": string, "email": string, "telephone": string, ' +
  '"ville": string, "linkedin": string, "portfolio": string}, ' +
  '"accroche": string, ' +
  '"experiences": [{"poste": string, "entreprise": string, "lieu": string, "debut": string, "fin": string, "bullets": [string]}], ' +
  '"formations": [{"diplome": string, "etablissement": string, "lieu": string, "debut": string, "fin": string, "details": string}], ' +
  '"competences": [{"categorie": string, "items": [string]}], ' +
  '"projets": [{"nom": string, "description": string, "bullets": [string], "lien": string}], ' +
  '"langues": [{"langue": string, "niveau": string}], ' +
  '"certifications": [string], "interets": [string]}';

/* ---------- Extraction depuis un CV existant collé (texte) ----------
   Si `cvActuel` contient déjà des informations, l'IA FUSIONNE (garde + complète)
   plutôt que de repartir de zéro — sinon un second collage écraserait le premier. */

export async function extraireCVDepuisTexte(etat, texte, cvActuel = null) {
  const aFusionner = Boolean(cvActuel?.identite?.nom || cvActuel?.experiences?.length || cvActuel?.formations?.length);

  const instructions = aFusionner
    ? "Tu mets à jour le CV structuré d'un candidat à partir d'un nouveau texte source qu'il vient de coller " +
      "(un CV en Word/PDF, un profil LinkedIn…). Tu reçois le CV ACTUEL du candidat et le NOUVEAU TEXTE. " +
      "Fusionne les deux : garde tout ce qui est déjà dans le CV actuel (tu peux compléter ou reformuler une " +
      "entrée existante si le nouveau texte apporte plus de détails sur la même expérience/formation), et " +
      "ajoute les éléments nouveaux trouvés dans le texte qui n'y sont pas déjà. Ne supprime jamais une " +
      "information du CV actuel, sauf si le nouveau texte la contredit clairement (ex. une date corrigée). " +
      "N'invente rien qui ne provienne ni du CV actuel ni du nouveau texte. " +
      "Réponds avec le CV COMPLET mis à jour (actuel + nouveautés fusionnées), UNIQUEMENT en JSON avec " +
      "exactement cette forme : " + FORME_CV_JSON
    : "Tu extrais un CV structuré à partir du texte collé par l'utilisateur (copié depuis un CV existant : " +
      "Word, PDF ou profil LinkedIn). Récupère TOUT ce qui est présent (toutes les expériences, formations, " +
      "compétences…), sans te limiter à une page. N'invente rien : si une information est absente du texte, " +
      "laisse-la vide ou omets l'élément. Réponds UNIQUEMENT en JSON avec exactement cette forme : " + FORME_CV_JSON;

  const contenu = aFusionner
    ? "CV ACTUEL du candidat :\n" + JSON.stringify(cvActuel) + "\n\nNOUVEAU TEXTE collé à fusionner :\n" + texte
    : texte;

  const infos = await appelIA(etat, { instructions, contenu, formatJSON: true });
  return { ...CV_VIDE, ...infos, identite: { ...CV_VIDE.identite, ...(infos.identite || {}) } };
}

/* ---------- Génération IA (CV ciblé pour une offre) ---------- */

export async function genererContenuCV(etat, offre) {
  const masterCV = etat.masterCV?.contenu || CV_VIDE;
  const instructions =
    "Tu rédiges un CV ciblé pour une candidature, à partir du CV MAÎTRE (exhaustif) d'un candidat " +
    "et de l'offre visée. Sélectionne et reformule UNIQUEMENT ce qui est pertinent pour cette offre, " +
    "avec le vocabulaire de l'annonce. Le CV doit tenir sur UNE page : maximum 4 expériences, " +
    "4 puces par expérience, 6 compétences mises en avant, 2 projets. " +
    "RÈGLE ABSOLUE : n'invente rien — n'ajoute aucune expérience, diplôme, compétence ou projet " +
    "absent du CV maître ; tu peux seulement choisir, raccourcir et reformuler. " +
    "Réponds UNIQUEMENT en JSON avec exactement cette forme : " + FORME_CV_JSON;

  const contenu =
    "CV MAÎTRE (source de vérité, à sélectionner et reformuler) :\n" + JSON.stringify(masterCV) +
    "\n\nOFFRE VISÉE :\n" + JSON.stringify({
      titre: offre.titre,
      entreprise: offre.entreprise,
      lieu: offre.lieu,
      description_resume: offre.description_resume,
    });

  return appelIA(etat, { instructions, contenu, formatJSON: true });
}

/* ---------- Styles de CV personnalisés (gabarit importé d'un .docx) ---------- */

/* Convertit un fichier .docx en HTML sémantique (titres, gras, listes…), entièrement
   dans le navigateur — mammoth chargé à la demande, même pattern que le SDK Anthropic
   dans ia.js. Best effort : une mise en page Word très complexe (colonnes, tableaux
   positionnés) sera simplifiée, mammoth ne préserve que la structure sémantique. */
export async function convertirDocxEnHTML(fichier) {
  let mammoth;
  try {
    ({ default: mammoth } = await import("https://esm.sh/mammoth"));
  } catch {
    throw new Error("Impossible de charger l'outil de lecture Word — vérifie ta connexion internet.");
  }
  let resultat;
  try {
    const buffer = await fichier.arrayBuffer();
    resultat = await mammoth.convertToHtml({ arrayBuffer: buffer });
  } catch {
    throw new Error("Ce fichier n'a pas pu être lu — vérifie qu'il s'agit bien d'un .docx (Word récent). " +
      "Les .doc anciens ou les PDF ne sont pas pris en charge.");
  }
  if (!resultat.value.trim()) throw new Error("Aucun texte n'a été trouvé dans ce document.");
  return resultat.value;
}

/* Retire un éventuel bloc ```html … ``` autour de la réponse de l'IA (même logique
   défensive que parserJSON dans ia.js, pour du HTML au lieu du JSON). */
function extraireHTMLBrut(texte) {
  const m = texte.match(/```(?:html)?\s*([\s\S]*?)```/i);
  return (m ? m[1] : texte).trim();
}

/* Assainisseur maison : le HTML vient de l'IA (qui a pu être influencée par du texte
   d'offre non fiable, ex. une description d'offre piégée) et part directement en
   innerHTML pour l'aperçu — défense en profondeur contre l'injection de script. */
export function nettoyerHTML(html) {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const BALISES_INTERDITES = ["script", "style", "iframe", "object", "embed", "link", "meta"];
  for (const nom of BALISES_INTERDITES) {
    doc.querySelectorAll(nom).forEach((n) => n.remove());
  }
  for (const n of doc.body.querySelectorAll("*")) {
    for (const attr of [...n.attributes]) {
      const valeur = attr.value.trim().toLowerCase();
      if (attr.name.toLowerCase().startsWith("on") || /^(javascript|data):/.test(valeur)) {
        n.removeAttribute(attr.name);
      }
    }
  }
  return doc.body.innerHTML;
}

/* Génère un CV ciblé en réutilisant EXACTEMENT la mise en forme d'un gabarit personnalisé
   (issu d'un CV Word importé) — contrairement à genererContenuCV, l'IA répond en HTML
   brut, pas en JSON, puisque la structure de balises est libre (celle du gabarit). */
export async function genererContenuCVAvecGabarit(etat, offre, gabaritHtml) {
  const masterCV = etat.masterCV?.contenu || CV_VIDE;
  const instructions =
    "Voici un CV existant en HTML, avec sa mise en forme (titres, gras, listes…). " +
    "Réécris ce HTML pour une nouvelle candidature : garde EXACTEMENT la même structure de " +
    "balises et la même mise en forme (mêmes titres, même ordre de sections, même style de " +
    "listes), mais remplace tout le texte par un contenu adapté à l'offre visée. Base-toi " +
    "UNIQUEMENT sur le CV MAÎTRE ci-dessous comme source d'information : n'invente aucune " +
    "expérience, diplôme, compétence ou projet absent du CV maître. S'il y a moins d'éléments " +
    "disponibles que dans le gabarit, adapte-toi (par exemple moins de puces) sans jamais " +
    "inventer. Réponds UNIQUEMENT avec le code HTML final — pas de ```, pas de texte autour.";

  const contenu =
    "GABARIT HTML (mise en forme à conserver) :\n" + gabaritHtml +
    "\n\nCV MAÎTRE (source de vérité) :\n" + JSON.stringify(masterCV) +
    "\n\nOFFRE VISÉE :\n" + JSON.stringify({
      titre: offre.titre,
      entreprise: offre.entreprise,
      lieu: offre.lieu,
      description_resume: offre.description_resume,
    });

  const brut = await appelIA(etat, { instructions, contenu, formatJSON: false });
  return nettoyerHTML(extraireHTMLBrut(brut));
}

/* ---------- Aperçu HTML (A4, blocs retouchables avant impression) ----------
   Le même HTML sert aux 3 styles visuels — seule une classe CSS change (voir style.css). */

export const STYLES_CV = [
  ["classique", "Classique"],
  ["moderne", "Moderne"],
  ["minimal", "Minimaliste"],
];

export function styleCVPrefere() {
  return localStorage.getItem("style-cv") || "classique";
}

export function definirStyleCVPrefere(style) {
  localStorage.setItem("style-cv", style);
}

function ligneEditable(tag, classe, texte) {
  const n = el(tag, classe, texte || "");
  n.contentEditable = "true";
  return n;
}

export function rendreApercuCV(contenu, style = styleCVPrefere()) {
  const page = el("div", "cv-page style-" + style);
  const id = contenu.identite || {};

  const entete = el("div", "cv-entete");
  entete.append(ligneEditable("h1", "cv-nom", id.nom || "Ton nom"));
  if (id.titre_recherche) entete.append(ligneEditable("p", "cv-titre-recherche", id.titre_recherche));
  const contacts = [id.email, id.telephone, id.ville, id.linkedin, id.portfolio].filter(Boolean).join(" · ");
  if (contacts) entete.append(ligneEditable("p", "cv-contacts", contacts));
  page.append(entete);

  if (contenu.accroche) page.append(ligneEditable("p", "cv-accroche", contenu.accroche));

  if (contenu.experiences?.length) {
    page.append(sectionCV("Expérience", contenu.experiences.map((x) => {
      const bloc = el("div", "cv-item");
      bloc.append(entreteItem(x.poste, `${x.entreprise || ""}${x.lieu ? " — " + x.lieu : ""}`, periode(x.debut, x.fin)));
      if (x.bullets?.length) bloc.append(listePuces(x.bullets));
      return bloc;
    })));
  }

  if (contenu.formations?.length) {
    page.append(sectionCV("Formation", contenu.formations.map((x) => {
      const bloc = el("div", "cv-item");
      bloc.append(entreteItem(x.diplome, `${x.etablissement || ""}${x.lieu ? " — " + x.lieu : ""}`, periode(x.debut, x.fin)));
      if (x.details) bloc.append(ligneEditable("p", "cv-details", x.details));
      return bloc;
    })));
  }

  if (contenu.competences?.length) {
    page.append(sectionCV("Compétences", contenu.competences.map((c) => {
      const ligne = el("p", "cv-competence");
      ligne.append(el("strong", null, (c.categorie || "") + " : "), document.createTextNode((c.items || []).join(", ")));
      ligne.contentEditable = "true";
      return ligne;
    })));
  }

  if (contenu.projets?.length) {
    page.append(sectionCV("Projets", contenu.projets.map((x) => {
      const bloc = el("div", "cv-item");
      bloc.append(entreteItem(x.nom, x.lien || "", ""));
      if (x.description) bloc.append(ligneEditable("p", "cv-details", x.description));
      if (x.bullets?.length) bloc.append(listePuces(x.bullets));
      return bloc;
    })));
  }

  if (contenu.langues?.length) {
    const texte = contenu.langues.map((l) => `${l.langue} (${l.niveau})`).join(" · ");
    page.append(sectionCV("Langues", [ligneEditable("p", "cv-details", texte)]));
  }

  if (contenu.certifications?.length) {
    page.append(sectionCV("Certifications", [ligneEditable("p", "cv-details", contenu.certifications.join(" · "))]));
  }

  if (contenu.interets?.length) {
    page.append(sectionCV("Centres d'intérêt", [ligneEditable("p", "cv-details", contenu.interets.join(" · "))]));
  }

  return page;
}

function sectionCV(titre, blocs) {
  const section = el("div", "cv-section");
  section.append(el("h2", "cv-titre-section", titre));
  for (const b of blocs) section.append(b);
  return section;
}

function entreteItem(gauche, droite, periode) {
  const ligne = el("div", "cv-item-entete");
  ligne.append(ligneEditable("span", "cv-item-titre", gauche || ""));
  if (droite) ligne.append(ligneEditable("span", "cv-item-lieu", droite));
  if (periode) ligne.append(el("span", "cv-item-periode", periode));
  return ligne;
}

function periode(debut, fin) {
  if (!debut && !fin) return "";
  return `${debut || "?"} – ${fin || "présent"}`;
}

function listePuces(bullets) {
  const ul = el("ul", "cv-puces");
  ul.contentEditable = "true";
  for (const b of bullets) ul.append(el("li", null, b));
  return ul;
}
