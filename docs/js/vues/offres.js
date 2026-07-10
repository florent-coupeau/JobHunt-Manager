/* Onglet Offres : table filtrable + formulaire d'ajout manuel.
   C'est ici qu'on trie : Nouvelle → À postuler (part au kanban) ou Écartée. */

import { el, boutonMini, formaterDate, pointDomaine, nomDomaine, signalerErreur } from "../ui.js";
import { STATUTS, patchChangementStatut } from "../statuts.js";
import { creerOffre, majOffre, supprimerOffre } from "../donnees.js";
import { appelIA, iaConfiguree } from "../ia.js";

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

  initImportIA(etat);

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

/* ---------- Import assisté par IA : coller le texte de l'annonce ---------- */

function initImportIA(etat) {
  const champTexte = document.getElementById("import-texte");
  const bouton = document.getElementById("btn-analyser-ia");
  const messageZone = document.getElementById("import-message");

  function message(texte, ok = true) {
    messageZone.textContent = texte;
    messageZone.className = "message-auth " + (ok ? "ok" : "erreur");
    messageZone.hidden = !texte;
  }

  bouton.addEventListener("click", async () => {
    if (!iaConfiguree(etat)) {
      message("Configure d'abord ton IA dans l'onglet ⚙️ Paramètres (clé gratuite en 1 minute).", false);
      return;
    }
    const texte = champTexte.value.trim();
    if (texte.length < 40) {
      message("Colle le texte complet de l'annonce (sélectionne tout sur la page de l'offre, copie, colle ici).", false);
      return;
    }

    bouton.disabled = true;
    message("⏳ Analyse de l'annonce en cours…");
    try {
      const domaines = (etat.criteres?.domaines || []).map((d) => `"${d.id}" (${d.nom})`).join(", ");
      const infos = await appelIA(etat, {
        instructions:
          "Tu extrais les informations d'une offre d'emploi collée par l'utilisateur. " +
          "Réponds UNIQUEMENT en JSON avec exactement ces clés : " +
          '{"titre": string, "entreprise": string, "lieu": string (ville + présentiel/hybride/télétravail si mentionné), ' +
          '"lien": string (URL de l\'annonce si présente dans le texte, sinon ""), ' +
          '"description_resume": string (2 phrases max, en français : missions et stack/compétences clés), ' +
          `"domaine": le plus pertinent parmi [${domaines || "aucun"}] ou "" si aucun ne convient}. ` +
          "N'invente rien : si une information est absente, mets une chaîne vide.",
        contenu: texte,
        formatJSON: true,
      });

      document.getElementById("ajout-titre").value = infos.titre || "";
      document.getElementById("ajout-entreprise").value = infos.entreprise || "";
      document.getElementById("ajout-lieu").value = infos.lieu || "";
      if (infos.lien && !document.getElementById("ajout-lien").value) {
        document.getElementById("ajout-lien").value = infos.lien;
      }
      document.getElementById("ajout-resume").value = infos.description_resume || "";
      const selDomaine = document.getElementById("ajout-domaine");
      if (infos.domaine && [...selDomaine.options].some((o) => o.value === infos.domaine)) {
        selDomaine.value = infos.domaine;
      }
      message("✅ Formulaire rempli — vérifie les champs puis clique 💾 Ajouter.");
    } catch (e) {
      message("❌ " + (e.message || "L'analyse a échoué — réessaie."), false);
    } finally {
      bouton.disabled = false;
    }
  });
}
