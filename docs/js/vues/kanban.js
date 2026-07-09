/* Pipeline kanban : les OFFRES elles-mêmes glissent de colonne en colonne
   (plus de table candidatures séparée depuis la v3). */

import { el, boutonMini, formaterDate, editeurNotes, signalerErreur } from "../ui.js";
import { STATUTS, COLONNES_KANBAN, infosStatut, patchChangementStatut, patchRelanceFaite, aujourdhuiISO } from "../statuts.js";
import { majOffre } from "../donnees.js";

async function appliquer(etat, offreId, patch, contexte) {
  try {
    await majOffre(offreId, patch);
    await etat.rafraichir();
  } catch (e) {
    signalerErreur(e, contexte);
  }
}

export function afficherKanban(etat) {
  const kanban = document.getElementById("kanban");
  kanban.innerHTML = "";
  const cartes = etat.offres.filter((o) => COLONNES_KANBAN.includes(o.statut));
  document.getElementById("pipeline-vide").hidden = cartes.length > 0;

  for (const colonneId of COLONNES_KANBAN) {
    const s = infosStatut(colonneId);
    const offres = cartes.filter((o) => o.statut === colonneId);
    const col = el("div", "colonne");

    col.addEventListener("dragover", (ev) => { ev.preventDefault(); col.classList.add("survolee"); });
    col.addEventListener("dragleave", () => col.classList.remove("survolee"));
    col.addEventListener("drop", (ev) => {
      ev.preventDefault();
      col.classList.remove("survolee");
      const id = ev.dataTransfer.getData("text/plain");
      const offre = etat.offres.find((o) => o.id === id);
      if (offre && offre.statut !== colonneId) {
        appliquer(etat, id, patchChangementStatut(offre, colonneId), "Impossible de déplacer la carte.");
      }
    });

    const h = el("h3");
    h.append(el("span", null, `${s.icone} ${s.label}`), el("span", "compte", String(offres.length)));
    col.append(h);

    for (const o of offres) col.append(carteOffre(etat, o));
    kanban.append(col);
  }
}

function carteOffre(etat, o) {
  const carte = el("div", "carte-cand");
  carte.append(el("div", "entreprise", o.entreprise), el("div", "poste", o.titre || ""));

  if (o.statut === "envoyee" && o.date_relance_prevue) {
    const retard = o.date_relance_prevue <= aujourdhuiISO();
    carte.append(el("div", "badge-relance" + (retard ? " retard" : ""),
      "📬 relance " + (retard ? "à faire !" : "le " + formaterDate(o.date_relance_prevue))));
  }

  const zoneNote = el("div", "note");
  if (o.notes) zoneNote.textContent = o.notes;
  carte.append(zoneNote);

  carte.draggable = true;
  carte.addEventListener("dragstart", (ev) => {
    ev.dataTransfer.setData("text/plain", o.id);
    carte.classList.add("saisie");
  });
  carte.addEventListener("dragend", () => carte.classList.remove("saisie"));

  const actions = el("div", "actions-carte");
  const sel = document.createElement("select");
  sel.className = "select-statut";
  sel.title = "Changer de statut";
  for (const s of STATUTS) {
    const opt = document.createElement("option");
    opt.value = s.id;
    opt.textContent = `${s.icone} ${s.label}`;
    opt.selected = s.id === o.statut;
    sel.append(opt);
  }
  sel.addEventListener("change", () =>
    appliquer(etat, o.id, patchChangementStatut(o, sel.value), "Impossible de changer le statut."));
  actions.append(sel);

  if (o.statut === "envoyee") {
    actions.append(boutonMini("📬", "J'ai relancé l'entreprise — reprogrammer une relance dans 7 jours",
      () => appliquer(etat, o.id, patchRelanceFaite(o), "Impossible d'enregistrer la relance.")));
  }

  actions.append(
    boutonMini("✏️", "Modifier les notes", () =>
      editeurNotes(zoneNote, o.notes,
        (v) => appliquer(etat, o.id, { notes: v }, "Impossible d'enregistrer les notes."),
        () => etat.rafraichir()))
  );
  carte.append(actions);
  return carte;
}
