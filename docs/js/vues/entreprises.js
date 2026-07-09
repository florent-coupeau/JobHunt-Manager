/* Onglet Entreprises : fiches consultables et éditables.
   (v3.1 ajoutera la création de fiche assistée par IA à partir d'un texte collé.) */

import { el, boutonMini, editeurNotes, signalerErreur } from "../ui.js";
import { creerEntreprise, majEntreprise, supprimerEntreprise } from "../donnees.js";

export function afficherEntreprises(etat) {
  const cont = document.getElementById("liste-entreprises");
  cont.innerHTML = "";
  document.getElementById("entreprises-vide").hidden = etat.entreprises.length > 0;

  for (const e of etat.entreprises) {
    const carte = el("div", "card carte-ent");
    const entete = el("div", "entete-ent");
    entete.append(el("h3", null, e.nom));
    entete.append(boutonMini("🗑️", "Supprimer cette fiche", async () => {
      if (!confirm(`Supprimer la fiche « ${e.nom} » ?`)) return;
      try {
        await supprimerEntreprise(e.id);
        await etat.rafraichir();
      } catch (err) {
        signalerErreur(err, "Impossible de supprimer la fiche.");
      }
    }));
    carte.append(entete);
    carte.append(el("div", "meta", [e.secteur, e.taille].filter(Boolean).join(" · ")));
    if (e.description) carte.append(el("p", null, e.description));
    if (e.linkedin_url) {
      const a = el("a", "lien-offre", "Page LinkedIn ↗");
      a.href = e.linkedin_url;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      carte.append(a);
    }
    if (Array.isArray(e.posts_recents) && e.posts_recents.length) {
      carte.append(el("strong", null, "Posts récents :"));
      const ul = document.createElement("ul");
      for (const p of e.posts_recents) ul.append(el("li", null, p));
      carte.append(ul);
    }
    const zoneNote = el("div", "note-ent");
    if (e.notes) zoneNote.textContent = "📝 " + e.notes;
    carte.append(zoneNote);
    carte.append(boutonMini("✏️ Modifier les notes", "Modifier tes notes sur cette entreprise", () =>
      editeurNotes(zoneNote, e.notes, async (v) => {
        try {
          await majEntreprise(e.id, { notes: v });
          await etat.rafraichir();
        } catch (err) {
          signalerErreur(err, "Impossible d'enregistrer les notes.");
        }
      }, () => etat.rafraichir())));
    cont.append(carte);
  }

  suggererFichesManquantes(etat);
}

/* Entreprises présentes dans les offres actives mais sans fiche : proposer de les créer. */
function suggererFichesManquantes(etat) {
  const zone = document.getElementById("fiches-manquantes");
  zone.innerHTML = "";
  const connues = new Set(etat.entreprises.map((e) => e.nom.toLowerCase()));
  const manquantes = [...new Set(
    etat.offres.filter((o) => o.statut !== "ecartee").map((o) => o.entreprise).filter(Boolean)
  )].filter((nom) => !connues.has(nom.toLowerCase()));

  if (manquantes.length) {
    zone.append(el("h2", null, "➕ Fiches à créer"));
    zone.append(el("p", "aide-fiches",
      "Ces entreprises ont des offres dans ta liste mais pas encore de fiche — clique pour en créer une (tu la rempliras avec tes notes)."));
    const liste = el("div", "liste-manquantes");
    for (const nom of manquantes) {
      liste.append(boutonMini("➕ " + nom, "Créer la fiche " + nom, async () => {
        try {
          await creerEntreprise(etat.userId, { nom });
          await etat.rafraichir();
        } catch (err) {
          signalerErreur(err, "Impossible de créer la fiche.");
        }
      }));
    }
    zone.append(liste);
  }
  zone.hidden = zone.childElementCount === 0;
}
