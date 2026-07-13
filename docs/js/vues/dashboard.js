/* Tableau de bord : compteurs, relances dues, répartition, dernières offres. */

import { el, formaterDate, pointDomaine, nomDomaine, couleurDomaine } from "../ui.js";
import { STATUTS_ACTIFS, infosStatut, relanceDue } from "../statuts.js";

export function afficherDashboard(etat) {
  afficherKPI(etat);
  afficherRelances(etat);
  afficherRepartition(etat);
  afficherPertinence(etat);
  afficherEntonnoir(etat);
  afficherDernieresOffres(etat);
}

function afficherKPI(etat) {
  const o = etat.offres;
  const kpis = [
    { valeur: o.filter((x) => x.statut === "nouvelle").length, libelle: "nouvelles offres à trier" },
    { valeur: o.filter((x) => STATUTS_ACTIFS.includes(x.statut)).length, libelle: "candidatures en cours" },
    { valeur: o.filter((x) => x.statut === "entretien").length, libelle: "entretiens" },
    { valeur: o.filter(relanceDue).length, libelle: "relances à faire" },
  ];
  const cont = document.getElementById("kpi-tiles");
  cont.innerHTML = "";
  for (const k of kpis) {
    const t = el("div", "tile");
    t.append(el("div", "valeur", String(k.valeur)), el("div", "libelle", k.libelle));
    cont.append(t);
  }
}

function afficherRelances(etat) {
  const cont = document.getElementById("relances-jour");
  cont.innerHTML = "";
  const dues = etat.offres.filter(relanceDue);
  if (!dues.length) {
    cont.append(el("p", "vide", "Aucune relance à faire aujourd'hui. 👌"));
    return;
  }
  for (const o of dues) {
    const ligne = el("div", "ligne-relance");
    ligne.append(
      el("strong", null, o.entreprise),
      el("span", null, o.titre || ""),
      el("span", "quand", "prévue le " + formaterDate(o.date_relance_prevue))
    );
    cont.append(ligne);
  }
}

function afficherRepartition(etat) {
  const cont = document.getElementById("repartition-domaines");
  cont.innerHTML = "";
  const domaines = etat.criteres?.domaines || [];
  if (!domaines.length) {
    cont.append(el("p", "vide", "Définis tes domaines dans l'onglet ⚙️ Critères."));
    return;
  }
  const max = Math.max(1, ...domaines.map((d) => etat.offres.filter((o) => o.domaine === d.id).length));
  for (const d of domaines) {
    const n = etat.offres.filter((o) => o.domaine === d.id).length;
    const ligne = el("div", "ligne-domaine");
    const jauge = el("div", "jauge");
    const rempli = el("div");
    rempli.style.width = (n / max) * 100 + "%";
    rempli.style.background = couleurDomaine(etat, d.id);
    jauge.append(rempli);
    ligne.append(pointDomaine(etat, d.id), el("span", null, nomDomaine(etat, d.id)), jauge, el("span", "compte", String(n)));
    cont.append(ligne);
  }
}

/* % de pertinence : parmi les offres déjà triées (tout sauf "nouvelle", pas encore vues),
   quelle proportion a été gardée (a_postuler et au-delà) plutôt qu'écartée. Mesure si la
   recherche/les critères ciblent bien. */
function afficherPertinence(etat) {
  const cont = document.getElementById("pertinence");
  cont.innerHTML = "";
  const gardees = etat.offres.filter((o) => !["nouvelle", "ecartee"].includes(o.statut)).length;
  const ecartees = etat.offres.filter((o) => o.statut === "ecartee").length;
  const total = gardees + ecartees;
  if (!total) {
    cont.append(el("p", "vide", "Trie quelques offres (📝 À postuler ou ✖ Écarter) pour voir apparaître ta pertinence."));
    return;
  }
  const pourcentage = Math.round((gardees / total) * 100);
  cont.append(el("div", "gros-chiffre", pourcentage + "%"));
  cont.append(el("p", "aide-fiches", `${gardees} gardée(s) sur ${total} triée(s) (${ecartees} écartée(s)).`));
}

/* Entonnoir : pour chaque étape du cycle, combien d'offres l'ont atteinte au moins une fois
   (via l'historique, pas juste le statut actuel — une offre entretien→refusée reste comptée
   dans "Entretien"). */
const ETAPES_ENTONNOIR = ["a_postuler", "envoyee", "entretien", "acceptee"];

function afficherEntonnoir(etat) {
  const cont = document.getElementById("entonnoir");
  cont.innerHTML = "";
  const compteurs = ETAPES_ENTONNOIR.map((id) => {
    const s = infosStatut(id);
    const evenement = `${s.icone} ${s.label}`;
    const n = etat.offres.filter((o) => (o.historique || []).some((h) => h.evenement === evenement)).length;
    return { s, n };
  });
  const max = Math.max(1, ...compteurs.map((c) => c.n));
  if (!compteurs.some((c) => c.n)) {
    cont.append(el("p", "vide", "Aucune candidature envoyée pour l'instant."));
    return;
  }
  for (const { s, n } of compteurs) {
    const ligne = el("div", "ligne-domaine");
    const jauge = el("div", "jauge");
    const rempli = el("div");
    rempli.style.width = (n / max) * 100 + "%";
    rempli.style.background = "var(--dom-1)";
    jauge.append(rempli);
    ligne.append(el("span", null, `${s.icone} ${s.label}`), jauge, el("span", "compte", String(n)));
    cont.append(ligne);
  }
}

function afficherDernieresOffres(etat) {
  const cont = document.getElementById("dernieres-offres");
  cont.innerHTML = "";
  const recentes = [...etat.offres]
    .sort((a, b) => (b.date_ajout || "").localeCompare(a.date_ajout || ""))
    .slice(0, 5);
  if (!recentes.length) {
    cont.append(el("p", "vide", "Aucune offre pour l'instant — ajoute ta première offre dans l'onglet 📋 Offres."));
    return;
  }
  for (const o of recentes) {
    const ligne = el("div", "ligne-offre");
    ligne.append(
      pointDomaine(etat, o.domaine),
      el("strong", null, o.titre),
      el("span", null, "· " + o.entreprise),
      el("span", "quand", "ajoutée le " + formaterDate(o.date_ajout))
    );
    cont.append(ligne);
  }
}
