/* Onglet Offres : table filtrable + formulaire d'ajout manuel.
   C'est ici qu'on trie : Nouvelle → À postuler (part au kanban) ou Écartée. */

import { el, boutonMini, formaterDate, pointDomaine, nomDomaine, signalerErreur } from "../ui.js";
import { STATUTS, patchChangementStatut } from "../statuts.js";
import { creerOffre, majOffre, supprimerOffre, creerEtiquette, PALETTE_ETIQUETTES, dernierCVGenere, creerCVGenere } from "../donnees.js";
import { appelIA, iaConfiguree } from "../ia.js";
import { lireUrlTexte } from "../lecture-web.js";
import {
  genererContenuCV, rendreApercuCV, masterCVRempli, STYLES_CV, styleCVPrefere, definirStyleCVPrefere,
  genererContenuCVAvecGabarit, nettoyerHTML,
} from "../cv.js";

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
    const cvIndisponible = !iaConfiguree(etat) || !masterCVRempli(etat.masterCV?.contenu);
    tdActions.append(
      boutonMini("🎯 CV", cvIndisponible
        ? "Configure ton IA (⚙️ Paramètres) et remplis ton CV (📄 Mon CV) pour l'utiliser"
        : "Générer / voir le CV ciblé pour cette offre",
        () => ouvrirApercuCV(etat, o), cvIndisponible)
    );
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
    messageImport("⏳ Lecture de la page de l'offre… (jusqu'à ~45 secondes)");
    try {
      let infos = null;

      // Voie 1 : l'IA va lire la page elle-même. On saute cette voie pour LinkedIn,
      // qui cache ses pages derrière un mur de connexion : l'IA y échoue toujours.
      if (!/linkedin\.com/i.test(url)) {
        try {
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
          infos = null; // lecture directe impossible : on passera par un lecteur public
          messageImport("⏳ Lecture directe impossible — nouvel essai via un lecteur public…");
        }
      }

      // Voie 2 : un lecteur public rapporte le TEXTE de la page (r.jina.ai, puis
      // relais CORS en secours — voir lecture-web.js), et l'IA analyse ce texte.
      if (!infos) {
        const texte = await lireUrlTexte(url);
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

/* ---------- Aperçu / génération du CV ciblé (bouton 🎯 CV) ---------- */

/* Les 3 styles intégrés partagent un seul contenu JSON (stocké sous style="json") : changer
   entre eux est gratuit. Un style personnalisé a son propre contenu HTML par offre (stocké
   sous style=<id du style perso>), puisque l'IA réécrit le gabarit importé. */
function estStyleIntegre(valeur) {
  return STYLES_CV.some(([v]) => v === valeur);
}

async function ouvrirApercuCV(etat, offre) {
  const fond = el("div", "voile-modale");
  const boite = el("div", "card boite-modale boite-cv");
  boite.append(el("h2", null, "📄 CV pour « " + offre.titre + " »"));

  const ligneStyle = el("div", "ligne-recherche");
  ligneStyle.append(document.createTextNode("🎨 Style : "));
  const selStyle = document.createElement("select");
  selStyle.className = "champ-critere";
  selStyle.title = "Style visuel du CV (n'affecte que la présentation, pas le contenu)";
  for (const [valeur, nom] of STYLES_CV) {
    const opt = document.createElement("option");
    opt.value = valeur;
    opt.textContent = nom;
    selStyle.append(opt);
  }
  if ((etat.stylesCV || []).length) {
    const groupe = document.createElement("optgroup");
    groupe.label = "Mes styles";
    for (const style of etat.stylesCV) {
      const opt = document.createElement("option");
      opt.value = style.id;
      opt.textContent = style.nom;
      groupe.append(opt);
    }
    selStyle.append(groupe);
  }
  selStyle.value = styleCVPrefere();
  if (selStyle.selectedIndex === -1) selStyle.value = STYLES_CV[0][0]; // style mémorisé supprimé depuis
  ligneStyle.append(selStyle);
  boite.append(ligneStyle);

  const zoneApercu = document.createElement("div");
  zoneApercu.id = "cv-impression";
  boite.append(zoneApercu);
  const message = el("p", "message-auth");
  message.hidden = true;
  boite.append(message);

  const barre = el("div", "editeur-boutons");
  const btnImprimer = el("button", "btn-mini btn-ok", "🖨️ Imprimer / Enregistrer en PDF");
  btnImprimer.addEventListener("click", () => window.print());
  const btnRegenerer = el("button", "btn-mini", "🔄 Régénérer");
  const btnFermer = el("button", "btn-mini", "Fermer");
  btnFermer.addEventListener("click", () => fond.remove());
  barre.append(btnImprimer, btnRegenerer, btnFermer);
  boite.append(barre);
  fond.append(boite);
  document.body.append(fond);

  let contenuActuel = null;
  let kindActuel = null; // "json" (styles intégrés) ou "html" (style personnalisé)
  selStyle.addEventListener("change", () => {
    definirStyleCVPrefere(selStyle.value);
    const changementGratuit = estStyleIntegre(selStyle.value) && kindActuel === "json";
    if (changementGratuit && contenuActuel) {
      zoneApercu.innerHTML = "";
      zoneApercu.append(rendreApercuCV(contenuActuel, selStyle.value));
    } else {
      charger(false);
    }
  });

  async function charger(regenerer) {
    zoneApercu.innerHTML = "";
    message.textContent = "⏳ " + (regenerer ? "Génération d'un nouveau CV…" : "Chargement…");
    message.className = "message-auth";
    message.hidden = false;
    btnRegenerer.disabled = true;
    try {
      const valeurStyle = selStyle.value;
      if (estStyleIntegre(valeurStyle)) {
        let ligne = regenerer ? null : await dernierCVGenere(offre.id, "json");
        if (!ligne) {
          const contenu = await genererContenuCV(etat, offre);
          ligne = await creerCVGenere(etat.userId, offre.id, "json", contenu);
        }
        contenuActuel = ligne.contenu;
        kindActuel = "json";
        zoneApercu.append(rendreApercuCV(contenuActuel, valeurStyle));
      } else {
        const styleCV = (etat.stylesCV || []).find((s) => s.id === valeurStyle);
        if (!styleCV) throw new Error("Ce style personnalisé n'existe plus.");
        let ligne = regenerer ? null : await dernierCVGenere(offre.id, valeurStyle);
        if (!ligne) {
          const html = await genererContenuCVAvecGabarit(etat, offre, styleCV.gabarit_html);
          ligne = await creerCVGenere(etat.userId, offre.id, valeurStyle, { html });
        }
        contenuActuel = ligne.contenu;
        kindActuel = "html";
        const page = document.createElement("div");
        page.className = "cv-page";
        page.contentEditable = "true";
        page.innerHTML = nettoyerHTML(contenuActuel.html);
        zoneApercu.append(page);
      }
      message.hidden = true;
    } catch (e) {
      message.textContent = "❌ " + (e.message || "La génération a échoué.");
      message.className = "message-auth erreur";
    } finally {
      btnRegenerer.disabled = false;
    }
  }
  btnRegenerer.addEventListener("click", () => charger(true));
  await charger(false);
}
