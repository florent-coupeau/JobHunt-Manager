/* Cycle de vie UNIQUE d'une offre (fusion offres + candidatures, v3) :
   nouvelle → a_postuler → envoyee → entretien → acceptee | refusee
   + ecartee, accessible depuis n'importe quel état. */

export const STATUTS = [
  { id: "nouvelle",   label: "Nouvelle",   icone: "🆕" },
  { id: "a_postuler", label: "À postuler", icone: "📝" },
  { id: "envoyee",    label: "Envoyée",    icone: "📤" },
  { id: "entretien",  label: "Entretien",  icone: "🗣️" },
  { id: "acceptee",   label: "Acceptée",   icone: "✅" },
  { id: "refusee",    label: "Refusée",    icone: "❌" },
  { id: "ecartee",    label: "Écartée",    icone: "✖" },
];

/* Colonnes du kanban : les offres "en cours de candidature".
   `nouvelle` (à trier) et `ecartee` restent dans l'onglet Offres. */
export const COLONNES_KANBAN = ["a_postuler", "envoyee", "entretien", "acceptee", "refusee"];

/* Statuts considérés comme "candidature active" pour les compteurs. */
export const STATUTS_ACTIFS = ["a_postuler", "envoyee", "entretien"];

export function infosStatut(id) {
  return STATUTS.find((s) => s.id === id) || { id, label: id, icone: "" };
}

export function aujourdhuiISO() {
  return new Date().toISOString().slice(0, 10);
}

function dansSeptJours() {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return d.toISOString().slice(0, 10);
}

/* Modifications à appliquer à une offre quand son statut change.
   Reprend les règles de relance J+7 de l'ancien serveur :
   - passage à "envoyée" : date de candidature posée + relance programmée à J+7 ;
   - tout autre statut : plus de relance en attente. */
export function patchChangementStatut(offre, nouveauStatut) {
  const s = infosStatut(nouveauStatut);
  const patch = {
    statut: nouveauStatut,
    historique: [...(offre.historique || []), { date: aujourdhuiISO(), evenement: `${s.icone} ${s.label}` }],
  };
  if (nouveauStatut === "envoyee") {
    if (!offre.date_candidature) patch.date_candidature = aujourdhuiISO();
    patch.date_relance_prevue = dansSeptJours();
  } else {
    patch.date_relance_prevue = null;
  }
  return patch;
}

/* Bouton « J'ai relancé » : trace la relance et en programme une nouvelle à J+7. */
export function patchRelanceFaite(offre) {
  return {
    historique: [...(offre.historique || []), { date: aujourdhuiISO(), evenement: "📬 Relance envoyée" }],
    date_relance_prevue: dansSeptJours(),
  };
}

export function relanceDue(offre) {
  return offre.statut === "envoyee" &&
    offre.date_relance_prevue && offre.date_relance_prevue <= aujourdhuiISO();
}
