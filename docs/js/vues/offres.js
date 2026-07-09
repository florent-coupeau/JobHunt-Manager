/* Onglet Offres : table filtrable + formulaire d'ajout manuel.
   C'est ici qu'on trie : Nouvelle → À postuler (part au kanban) ou Écartée. */

import { el, boutonMini, formaterDate, pointDomaine, nomDomaine, signalerErreur } from "../ui.js";
import { STATUTS, patchChangementStatut } from "../statuts.js";
import { creerOffre, majOffre, supprimerOffre } from "../donnees.js";

export function afficherOffres(etat) {
  remplirFiltreDomaines(etat);
  remplirTable(etat);
}

export function initOffres(etat) {
  for (const id of ["filtre-texte", "filtre-domaine", "filtre-statut"]) {
    document.getElementById(id).addEventListener("input", () => remplirTable(etat));
  }
  initFormulaireAjout(etat);
}

function remplirFiltreDomaines(etat) {
  const sel = document.getElementById("filtre-domaine");
  const valeur = sel.value;
  sel.innerHTML = '<option value="">Tous les domaines</option>';
  for (const d of etat.criteres?.domaines || []) {
    const opt = document.createElement("option");
    opt.value = d.id;
    opt.textContent = d.nom;
    sel.append(opt);
  }
  sel.value = valeur;
}

async function changerStatut(etat, offre, statut) {
  try {
    await majOffre(offre.id, patchChangementStatut(offre, statut));
    await etat.rafraichir();
  } catch (e) {
    signalerErreur(e, "Impossible de changer le statut.");
  }
}

function remplirTable(etat) {
  const texte = document.getElementById("filtre-texte").value.toLowerCase();
  const dom = document.getElementById("filtre-domaine").value;
  const statut = document.getElementById("filtre-statut").value;

  const visibles = etat.offres.filter((o) => {
    if (dom && o.domaine !== dom) return false;
    if (statut && o.statut !== statut) return false;
    if (texte) {
      const meule = `${o.titre} ${o.entreprise} ${o.lieu}`.toLowerCase();
      if (!meule.includes(texte)) return false;
    }
    return true;
  });

  const corps = document.querySelector("#table-offres tbody");
  corps.innerHTML = "";
  document.getElementById("offres-vide").hidden = visibles.length > 0;
  document.getElementById("table-offres").hidden = visibles.length === 0;

  for (const o of visibles) {
    const tr = document.createElement("tr");

    const tdTitre = document.createElement("td");
    tdTitre.append(el("div", "titre-offre", o.titre));
    if (o.description_resume) tdTitre.append(el("div", "resume", o.description_resume));

    const tdDomaine = document.createElement("td");
    const cell = el("span", "cellule-domaine");
    cell.append(pointDomaine(etat, o.domaine), el("span", null, nomDomaine(etat, o.domaine)));
    tdDomaine.append(cell);

    const tdStatut = document.createElement("td");
    const sel = document.createElement("select");
    sel.className = "select-statut statut-" + o.statut;
    for (const s of STATUTS) {
      const opt = document.createElement("option");
      opt.value = s.id;
      opt.textContent = `${s.icone} ${s.label}`;
      opt.selected = s.id === o.statut;
      sel.append(opt);
    }
    sel.addEventListener("change", () => changerStatut(etat, o, sel.value));
    tdStatut.append(sel);

    const tdActions = document.createElement("td");
    tdActions.className = "cellule-actions";
    if (o.lien) {
      const a = el("a", "lien-offre", "Voir ↗");
      a.href = o.lien;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      tdActions.append(a);
    }
    if (o.statut === "nouvelle") {
      tdActions.append(
        boutonMini("📝 À postuler", "Garder cette offre : elle part dans le pipeline", () => changerStatut(etat, o, "a_postuler")),
        boutonMini("✖ Écarter", "Écarter cette offre", () => changerStatut(etat, o, "ecartee"))
      );
    }
    tdActions.append(
      boutonMini("🗑️", "Supprimer définitivement cette offre", async () => {
        if (!confirm(`Supprimer définitivement l'offre « ${o.titre} » (${o.entreprise}) ?`)) return;
        try {
          await supprimerOffre(o.id);
          await etat.rafraichir();
        } catch (e) {
          signalerErreur(e, "Impossible de supprimer l'offre.");
        }
      })
    );

    tr.append(
      tdTitre,
      el("td", null, o.entreprise),
      el("td", null, o.lieu || ""),
      tdDomaine,
      el("td", null, formaterDate(o.date_publication)),
      tdStatut,
      tdActions
    );
    corps.append(tr);
  }
}

/* ---------- Formulaire d'ajout manuel ---------- */

function initFormulaireAjout(etat) {
  const zone = document.getElementById("zone-ajout-offre");
  const form = document.getElementById("form-ajout-offre");

  document.getElementById("btn-ajouter-offre").addEventListener("click", () => {
    zone.hidden = !zone.hidden;
    if (!zone.hidden) {
      // Domaines à jour dans le select du formulaire
      const sel = document.getElementById("ajout-domaine");
      sel.innerHTML = '<option value="">— Domaine —</option>';
      for (const d of etat.criteres?.domaines || []) {
        const opt = document.createElement("option");
        opt.value = d.id;
        opt.textContent = d.nom;
        sel.append(opt);
      }
      document.getElementById("ajout-titre").focus();
    }
  });

  document.getElementById("btn-annuler-ajout").addEventListener("click", () => {
    form.reset();
    zone.hidden = true;
  });

  form.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const champs = {
      titre: document.getElementById("ajout-titre").value.trim(),
      entreprise: document.getElementById("ajout-entreprise").value.trim(),
      lieu: document.getElementById("ajout-lieu").value.trim(),
      lien: document.getElementById("ajout-lien").value.trim(),
      domaine: document.getElementById("ajout-domaine").value,
      description_resume: document.getElementById("ajout-resume").value.trim(),
      source: "manuel",
    };
    if (!champs.titre || !champs.entreprise) return;
    try {
      await creerOffre(etat.userId, champs);
      form.reset();
      zone.hidden = true;
      await etat.rafraichir();
    } catch (e) {
      signalerErreur(e, "Impossible d'ajouter l'offre.");
    }
  });
}
