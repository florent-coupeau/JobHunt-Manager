/* Petits utilitaires d'interface partagés par toutes les vues. */

import { infosStatut } from "./statuts.js";

export function el(tag, classe, contenu) {
  const n = document.createElement(tag);
  if (classe) n.className = classe;
  if (contenu !== undefined) n.textContent = contenu;
  return n;
}

export function boutonMini(texte, titre, action, desactive = false) {
  const b = el("button", "btn-mini", texte);
  b.title = titre;
  b.disabled = desactive;
  b.addEventListener("click", action);
  return b;
}

export function formaterDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

export function badgeStatut(statut) {
  const s = infosStatut(statut);
  const b = el("span", "badge " + statut);
  b.textContent = `${s.icone} ${s.label}`;
  return b;
}

/* Couleur d'un domaine : attribuée dans l'ordre des critères de l'utilisateur. */
export function couleurDomaine(etat, domaineId) {
  const ids = (etat.criteres?.domaines || []).map((d) => d.id);
  const i = ids.indexOf(domaineId);
  return i === -1 ? "var(--muted)" : `var(--dom-${(i % 4) + 1})`;
}

export function nomDomaine(etat, domaineId) {
  const dom = (etat.criteres?.domaines || []).find((d) => d.id === domaineId);
  return dom ? dom.nom : (domaineId || "Sans domaine");
}

export function pointDomaine(etat, domaineId) {
  const dot = el("span", "dot");
  dot.style.background = couleurDomaine(etat, domaineId);
  return dot;
}

/* Éditeur de notes réutilisable : remplace `zone` par un textarea + Enregistrer/Annuler. */
export function editeurNotes(zone, valeurActuelle, enregistrer, annuler) {
  zone.innerHTML = "";
  const champ = document.createElement("textarea");
  champ.className = "editeur-notes";
  champ.value = valeurActuelle || "";
  champ.rows = 3;
  const ligne = el("div", "editeur-boutons");
  const ok = el("button", "btn-mini btn-ok", "💾 Enregistrer");
  ok.addEventListener("click", () => enregistrer(champ.value.trim()));
  const btnAnnuler = el("button", "btn-mini", "Annuler");
  btnAnnuler.addEventListener("click", annuler);
  ligne.append(ok, btnAnnuler);
  zone.append(champ, ligne);
  champ.focus();
}

/* Affiche une erreur d'action (réseau, droits…) sans casser la page. */
export function signalerErreur(error, contexte) {
  console.error(contexte, error);
  alert(`${contexte}\n${error?.message || "Erreur inconnue — vérifie ta connexion internet."}`);
}
