/* Onglet Offres : table filtrable + formulaire d'ajout manuel.
   C'est ici qu'on trie : Nouvelle → À postuler (part au kanban) ou Écartée. */

import { el, boutonMini, formaterDate, pointDomaine, nomDomaine, signalerErreur } from "../ui.js";
import { STATUTS, patchChangementStatut } from "../statuts.js";
import { creerOffre, majOffre, supprimerOffre, creerEtiquette, PALETTE_ETIQUETTES } from "../donnees.js";
import { appelIA, iaConfiguree } from "../ia.js";
import { lireUrlViaProxy, htmlEnTexte } from "../lecture-web.js";

export function afficherOffres(etat) {
  remplirFiltreDomaines(etat);
  remplirFiltreEtiquettes(etat);
  remplirTable(etat);
}

export function initOffres(etat) {
  for (const id of ["filtre-texte", "filtre-domaine", "filtre-statut", "filtre-etiquette"]) {
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

function remplirFiltreEtiquettes(etat) {
  const sel = document.getElementById("filtre-etiquette");
  const valeur = sel.value;
  sel.innerHTML = '<option value="">Toutes les étiquettes</option><option value="aucune">Sans étiquette</option>';
  for (const e of etat.etiquettes || []) {
    const opt = document.createElement("option");
    opt.value = e.id;
    opt.textContent = e.nom;
    sel.append(opt);
  }
  sel.value = valeur;
  if (sel.selectedIndex === -1) sel.value = ""; // l'étiquette filtrée a été supprimée
}

/* Crée une étiquette après un prompt(), et renvoie sa ligne (ou null si annulé). */
async function nouvelleEtiquette(etat) {
  const nom = (prompt("Nom de la nouvelle étiquette (ex. Urgent, À étudier, Backup) :") || "").trim();
  if (!nom) return null;
  const deja = (etat.etiquettes || []).find((e) => e.nom.toLowerCase() === nom.toLowerCase());
  if (deja) return deja; // déjà existante : on la réutilise simplement
  const couleur = PALETTE_ETIQUETTES[(etat.etiquettes || []).length % PALETTE_ETIQUETTES.length];
  return creerEtiquette(etat.userId, { nom, couleur, ordre: (etat.etiquettes || []).length });
}

async function changerEtiquette(etat, offre, valeur) {
  try {
    let etiquetteId = valeur || null;
    if (valeur === "__nouvelle__") {
      const etiquette = await nouvelleEtiquette(etat);
      if (!etiquette) { remplirTable(etat); return; } // annulé : on remet l'affichage
      etiquetteId = etiquette.id;
    }
    await majOffre(offre.id, { etiquette_id: etiquetteId });
    await etat.rafraichir();
  } catch (e) {
    signalerErreur(e, "Impossible de changer l'étiquette.");
  }
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
  const etiquette = document.getElementById("filtre-etiquette").value;

  const visibles = etat.offres.filter((o) => {
    if (dom && o.domaine !== dom) return false;
    if (statut && o.statut !== statut) return false;
    if (etiquette === "aucune" && o.etiquette_id) return false;
    if (etiquette && etiquette !== "aucune" && o.etiquette_id !== etiquette) return false;
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

    const tdEtiquette = document.createElement("td");
    const selEtiq = document.createElement("select");
    selEtiq.className = "select-etiquette";
    selEtiq.title = "Étiquette personnelle (tri libre)";
    const optAucune = document.createElement("option");
    optAucune.value = "";
    optAucune.textContent = "—";
    selEtiq.append(optAucune);
    for (const e of etat.etiquettes || []) {
      const opt = document.createElement("option");
      opt.value = e.id;
      opt.textContent = "🏷️ " + e.nom;
      opt.selected = e.id === o.etiquette_id;
      selEtiq.append(opt);
    }
    const optNouvelle = document.createElement("option");
    optNouvelle.value = "__nouvelle__";
    optNouvelle.textContent = "➕ Nouvelle étiquette…";
    selEtiq.append(optNouvelle);
    const etiqActuelle = (etat.etiquettes || []).find((e) => e.id === o.etiquette_id);
    if (etiqActuelle) {
      selEtiq.style.borderColor = etiqActuelle.couleur;
      selEtiq.style.color = etiqActuelle.couleur;
    }
    selEtiq.addEventListener("change", () => changerEtiquette(etat, o, selEtiq.value));
    tdEtiquette.append(selEtiq);

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
      tdEtiquette,
      el("td", null, formaterDate(o.date_publication)),
      tdStatut,
      tdActions
    );
    corps.append(tr);
  }
}

/* ---------- Formulaire d'ajout manuel ---------- */

/* Source enregistrée au submit : "manuel" par défaut, "import_ia" quand
   le formulaire a été pré-rempli par l'IA (lien ou texte collé). */
let sourceImport = "manuel";

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
    sourceImport = "manuel";
    zone.hidden = true;
  });

  initImportLien(etat);
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
      source: sourceImport,
    };
    if (!champs.titre || !champs.entreprise) return;
    try {
      await creerOffre(etat.userId, champs);
      form.reset();
      sourceImport = "manuel";
      zone.hidden = true;
      await etat.rafraichir();
    } catch (e) {
      signalerErreur(e, "Impossible d'ajouter l'offre.");
    }
  });
}

/* ---------- Import assisté par IA : par lien ou par texte collé ---------- */

function messageImport(texte, ok = true) {
  const zone = document.getElementById("import-message");
  zone.textContent = texte;
  zone.className = "message-auth " + (ok ? "ok" : "erreur");
  zone.hidden = !texte;
}

/* Le prompt d'extraction, commun au lien et au texte collé. */
function instructionsExtraction(etat, origine) {
  const domaines = (etat.criteres?.domaines || []).map((d) => `"${d.id}" (${d.nom})`).join(", ");
  return (
    `Tu extrais les informations d'une offre d'emploi ${origine}. ` +
    "Réponds UNIQUEMENT en JSON avec exactement ces clés : " +
    '{"titre": string, "entreprise": string, "lieu": string (ville + présentiel/hybride/télétravail si mentionné), ' +
    '"lien": string (URL de l\'annonce si présente, sinon ""), ' +
    '"description_resume": string (2 phrases max, en français : missions et stack/compétences clés), ' +
    `"domaine": le plus pertinent parmi [${domaines || "aucun"}] ou "" si aucun ne convient}. ` +
    "N'invente rien : si une information est absente, mets une chaîne vide."
  );
}

/* Reporte les infos extraites par l'IA dans le formulaire d'ajout. */
function remplirFormulaire(infos) {
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
  sourceImport = "import_ia";
  messageImport("✅ Formulaire rempli — vérifie les champs puis clique 💾 Ajouter.");
}

/* Import par LIEN : l'IA va lire la page elle-même (rien ne passe par un backend). */
function initImportLien(etat) {
  const champLien = document.getElementById("import-lien");
  const bouton = document.getElementById("btn-analyser-lien");

  bouton.addEventListener("click", async () => {
    if (!iaConfiguree(etat)) {
      messageImport("Configure d'abord ton IA dans l'onglet ⚙️ Paramètres (clé gratuite en 1 minute).", false);
      return;
    }
    let url;
    try {
      url = new URL(champLien.value.trim()).href;
    } catch {
      messageImport("Colle une adresse complète (elle commence par https://…).", false);
      return;
    }

    bouton.disabled = true;
    messageImport("⏳ Ton IA lit la page de l'offre… (jusqu'à ~30 secondes)");
    try {
      let infos;
      try {
        // Voie 1 : l'IA va lire la page elle-même.
        infos = await appelIA(etat, {
          instructions:
            instructionsExtraction(etat, "à partir de sa page web, que tu dois aller lire") +
            ' Si la page est illisible ou ne contient pas d\'offre, réponds {"erreur": "raison courte en français"}.',
          contenu: "Voici l'offre d'emploi à analyser : " + url,
          formatJSON: true,
          url: true,
        });
        if (infos.erreur) throw new Error(infos.erreur);
      } catch {
        // Voie 2 (secours) : le navigateur récupère la page via un relais CORS
        // public (LinkedIn & co bloquent les lecteurs des IA), puis l'IA analyse le texte.
        messageImport("⏳ Lecture directe impossible — nouvel essai via un relais public…");
        const texte = htmlEnTexte(await lireUrlViaProxy(url));
        if (texte.length < 200) throw new Error("La page récupérée est vide ou illisible");
        infos = await appelIA(etat, {
          instructions: instructionsExtraction(etat, "à partir du texte extrait de sa page web"),
          contenu: texte,
          formatJSON: true,
        });
      }

      infos.lien = url; // le lien enregistré est toujours celui que l'utilisateur a collé
      document.getElementById("ajout-lien").value = "";
      remplirFormulaire(infos);
      champLien.value = "";
    } catch (e) {
      messageImport("❌ " + (e.message || "La lecture a échoué") +
        " (astuce : le collage de texte ci-dessous marche avec tous les sites)", false);
    } finally {
      bouton.disabled = false;
    }
  });
}

/* Import par TEXTE COLLÉ : le repli fiable qui marche avec tous les sites. */
function initImportIA(etat) {
  const champTexte = document.getElementById("import-texte");
  const bouton = document.getElementById("btn-analyser-ia");

  bouton.addEventListener("click", async () => {
    if (!iaConfiguree(etat)) {
      messageImport("Configure d'abord ton IA dans l'onglet ⚙️ Paramètres (clé gratuite en 1 minute).", false);
      return;
    }
    const texte = champTexte.value.trim();
    if (texte.length < 40) {
      messageImport("Colle le texte complet de l'annonce (sélectionne tout sur la page de l'offre, copie, colle ici).", false);
      return;
    }

    bouton.disabled = true;
    messageImport("⏳ Analyse de l'annonce en cours…");
    try {
      const infos = await appelIA(etat, {
        instructions: instructionsExtraction(etat, "collée par l'utilisateur"),
        contenu: texte,
        formatJSON: true,
      });
      remplirFormulaire(infos);
    } catch (e) {
      messageImport("❌ " + (e.message || "L'analyse a échoué — réessaie."), false);
    } finally {
      bouton.disabled = false;
    }
  });
}
