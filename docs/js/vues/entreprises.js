/* Onglet Entreprises : fiches consultables et éditables.
   (v3.1 ajoutera la création de fiche assistée par IA à partir d'un texte collé.) */

import { el, boutonMini, editeurNotes, signalerErreur } from "../ui.js";
import { creerEntreprise, majEntreprise, supprimerEntreprise } from "../donnees.js";
import { appelIA, iaConfiguree } from "../ia.js";

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
    const zoneIA = el("div");
    const actions = el("div", "editeur-boutons");
    actions.append(
      boutonMini("✏️ Modifier les notes", "Modifier tes notes sur cette entreprise", () =>
        editeurNotes(zoneNote, e.notes, async (v) => {
          try {
            await majEntreprise(e.id, { notes: v });
            await etat.rafraichir();
          } catch (err) {
            signalerErreur(err, "Impossible d'enregistrer les notes.");
          }
        }, () => etat.rafraichir())),
      boutonMini("✨ Remplir avec l'IA", "Colle un texte sur l'entreprise (page LinkedIn, site, article) — l'IA remplit la fiche",
        () => editeurFicheIA(etat, e, zoneIA))
    );
    carte.append(actions, zoneIA);
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

/* Remplissage d'une fiche par IA : l'utilisateur colle un texte librement
   (page LinkedIn de l'entreprise, page « à propos », article de presse…). */
function editeurFicheIA(etat, entreprise, zone) {
  if (!iaConfiguree(etat)) {
    alert("Configure d'abord ton IA dans l'onglet ⚙️ Paramètres (clé gratuite en 1 minute).");
    return;
  }
  zone.innerHTML = "";
  zone.append(el("p", "aide-fiches",
    `Colle ci-dessous un texte sur ${entreprise.nom} (sa page LinkedIn, son site, un article) :`));
  const champ = document.createElement("textarea");
  champ.className = "editeur-notes";
  champ.rows = 5;
  const ligne = el("div", "editeur-boutons");
  const ok = el("button", "btn-mini btn-ok", "✨ Analyser");
  const annuler = el("button", "btn-mini", "Annuler");
  annuler.addEventListener("click", () => { zone.innerHTML = ""; });
  ligne.append(ok, annuler);
  zone.append(champ, ligne);
  champ.focus();

  ok.addEventListener("click", async () => {
    const texte = champ.value.trim();
    if (texte.length < 40) {
      alert("Colle un texte plus complet (au moins quelques phrases).");
      return;
    }
    ok.disabled = true;
    ok.textContent = "⏳ Analyse…";
    try {
      const infos = await appelIA(etat, {
        instructions:
          `Tu remplis la fiche de l'entreprise « ${entreprise.nom} » à partir du texte collé. ` +
          "Réponds UNIQUEMENT en JSON avec exactement ces clés : " +
          '{"secteur": string (secteur d\'activité, court), "taille": string (effectifs si mentionnés, sinon ""), ' +
          '"description": string (2 phrases max, en français), ' +
          '"posts_recents": array de strings (max 3 actualités/posts mentionnés, [] sinon), ' +
          '"conseil": string (1 phrase : un conseil pour candidater chez eux d\'après le texte, "" si rien d\'utile)}. ' +
          "N'invente rien : si une information est absente du texte, mets une chaîne vide.",
        contenu: texte,
        formatJSON: true,
      });
      const patch = {
        secteur: infos.secteur || entreprise.secteur || "",
        taille: infos.taille || entreprise.taille || "",
        description: infos.description || entreprise.description || "",
        posts_recents: Array.isArray(infos.posts_recents) && infos.posts_recents.length
          ? infos.posts_recents : (entreprise.posts_recents || []),
      };
      if (infos.conseil && !entreprise.notes) patch.notes = "💡 " + infos.conseil;
      await majEntreprise(entreprise.id, patch);
      await etat.rafraichir();
    } catch (e) {
      ok.disabled = false;
      ok.textContent = "✨ Analyser";
      signalerErreur(e, "L'analyse de la fiche a échoué.");
    }
  });
}
