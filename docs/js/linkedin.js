/* Recherche automatique d'offres LinkedIn — 100 % côté navigateur, en cascade :
   1. lecture de l'endpoint public « invité » de LinkedIn via un relais CORS public
      (lecture-web.js) + parseur maison — gratuit, sans IA ;
   2. en secours, le FOURNISSEUR IA de l'utilisateur (web_fetch / url_context) lit
      la page publique de recherche.
   Rien ne transite par notre backend. Avertissement obligatoire avant la première
   utilisation — méthode non officielle. */

import { supabase } from "./supabase.js";
import { el, signalerErreur } from "./ui.js";
import { creerOffre } from "./donnees.js";
import { appelIA, iaConfiguree } from "./ia.js";
import { lireUrlViaProxy } from "./lecture-web.js";

export function initRechercheLinkedin(etat) {
  document.getElementById("btn-recherche-linkedin").addEventListener("click", () => {
    if (etat.parametres?.avertissement_linkedin_accepte_le) lancerRecherche(etat);
    else afficherAvertissement(etat);
  });
}

export function afficherRecherche(etat) {
  // Domaines à jour dans le sélecteur de recherche
  const sel = document.getElementById("recherche-domaine");
  const valeur = sel.value;
  sel.innerHTML = "";
  for (const d of etat.criteres?.domaines || []) {
    const opt = document.createElement("option");
    opt.value = d.id;
    opt.textContent = d.nom;
    sel.append(opt);
  }
  sel.value = valeur || sel.options[0]?.value || "";
  const lieu = document.getElementById("recherche-lieu");
  if (!lieu.value) lieu.value = etat.criteres?.localisation?.zone || "France";
}

/* ---------- Avertissement obligatoire (exigence du projet) ---------- */

function afficherAvertissement(etat) {
  const fond = el("div", "voile-modale");
  const boite = el("div", "card boite-modale");
  boite.append(el("h2", null, "⚠️ Avant ta première recherche LinkedIn"));
  const texte = el("div", "texte-modale");
  texte.innerHTML = `
    <p>Cette fonction lit la <strong>page publique</strong> de recherche d'offres de LinkedIn, d'une façon
    <strong>non officielle</strong> (LinkedIn ne fournit pas d'accès gratuit officiel) : d'abord via un
    <strong>relais public gratuit</strong> (service tiers — seuls tes mots-clés de recherche y transitent),
    puis via <strong>ton fournisseur IA</strong> en secours. Rien ne passe par un serveur de l'application.</p>
    <ul>
      <li>⚖️ C'est une <strong>zone grise des conditions d'utilisation</strong> de LinkedIn ;</li>
      <li>🔌 LinkedIn peut <strong>bloquer</strong> ce genre de lecture automatique à tout moment, sans préavis ;</li>
      <li>🙅 Aucun compte LinkedIn n'est utilisé — <strong>ton compte personnel ne risque rien</strong> ;</li>
      <li>📉 Les résultats peuvent être incomplets — l'ajout par lien ou par texte collé reste la méthode la plus fiable ;</li>
      <li>🔢 Limite de <strong>5 recherches par jour</strong> pour rester discret.</li>
    </ul>`;
  boite.append(texte);
  const caseLigne = el("label", "case-mode");
  const caseOk = document.createElement("input");
  caseOk.type = "checkbox";
  caseLigne.append(caseOk, document.createTextNode(" J'ai compris et j'accepte ces limites"));
  boite.append(caseLigne);
  const barre = el("div", "editeur-boutons");
  const btnOk = el("button", "btn-principal", "Continuer");
  btnOk.disabled = true;
  const btnNon = el("button", "btn-mini", "Annuler");
  caseOk.addEventListener("change", () => { btnOk.disabled = !caseOk.checked; });
  btnNon.addEventListener("click", () => fond.remove());
  btnOk.addEventListener("click", async () => {
    try {
      const quand = new Date().toISOString();
      const { error } = await supabase.from("parametres")
        .upsert({ user_id: etat.userId, avertissement_linkedin_accepte_le: quand });
      if (error) throw new Error(error.message);
      etat.parametres = { ...(etat.parametres || {}), avertissement_linkedin_accepte_le: quand };
      fond.remove();
      lancerRecherche(etat);
    } catch (e) {
      signalerErreur(e, "Impossible d'enregistrer ton accord.");
    }
  });
  barre.append(btnOk, btnNon);
  boite.append(barre);
  fond.append(boite);
  document.body.append(fond);
}

/* ---------- Recherche ---------- */

function message(texte, ok = true) {
  const zone = document.getElementById("recherche-message");
  zone.textContent = texte;
  zone.className = "message-auth " + (ok ? "ok" : "erreur");
  zone.hidden = !texte;
}

const RECHERCHES_MAX_JOUR = 5;

/* Vérifie le quota du jour et l'incrémente. Renvoie le nombre de recherches restantes
   APRÈS celle-ci, ou -1 si la limite est atteinte. Compteur stocké dans `parametres`
   (le même que celui qu'utilisait l'ancienne version serveur). */
async function consommerQuota(etat) {
  const aujourdhui = new Date().toISOString().slice(0, 10);
  const memeJour = etat.parametres?.derniere_recherche === aujourdhui;
  const deja = memeJour ? etat.parametres?.recherches_jour || 0 : 0;
  if (deja >= RECHERCHES_MAX_JOUR) return -1;

  const { error } = await supabase.from("parametres")
    .upsert({ user_id: etat.userId, recherches_jour: deja + 1, derniere_recherche: aujourdhui });
  if (error) throw new Error("Enregistrement du compteur de recherches : " + error.message);
  etat.parametres = { ...(etat.parametres || {}), recherches_jour: deja + 1, derniere_recherche: aujourdhui };
  return RECHERCHES_MAX_JOUR - (deja + 1);
}

async function lancerRecherche(etat) {
  const bouton = document.getElementById("btn-recherche-linkedin");
  const domaineId = document.getElementById("recherche-domaine").value;
  const domaine = (etat.criteres?.domaines || []).find((d) => d.id === domaineId);
  if (!domaine || !(domaine.mots_cles || []).length) {
    message("Ajoute d'abord des mots-clés à ce domaine dans l'onglet 🧭 Critères.", false);
    return;
  }

  bouton.disabled = true;
  try {
    const restantes = await consommerQuota(etat);
    if (restantes < 0) {
      message(`Limite atteinte : ${RECHERCHES_MAX_JOUR} recherches par jour maximum — réessaie demain (ou utilise l'ajout par lien/texte, illimité).`, false);
      return;
    }

    const localisation = document.getElementById("recherche-lieu").value.trim() || "France";

    // Voie 1 (principale) : endpoint public « invité » via un relais CORS public,
    // parsé ici même — gratuit, aucune IA nécessaire pour la lecture.
    message("⏳ Lecture de LinkedIn via un relais public…");
    const parRef = new Map();
    for (const mots of domaine.mots_cles.slice(0, 3)) {
      const cible = "https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search" +
        `?keywords=${encodeURIComponent(mots)}&location=${encodeURIComponent(localisation)}` +
        "&f_TPR=r604800&start=0"; // offres des 7 derniers jours
      try {
        for (const o of parserCartes(await lireUrlViaProxy(cible))) parRef.set(o.source_ref, o);
      } catch { /* relais bloqués pour ce mot-clé : on tentera la voie IA */ }
    }
    let brutes = [...parRef.values()];

    // Voie 2 (secours) : ton IA lit la page publique de recherche.
    if (!brutes.length && iaConfiguree(etat)) {
      message("⏳ Relais publics bloqués — tentative via ton IA…");
      const url = "https://www.linkedin.com/jobs/search?" +
        `keywords=${encodeURIComponent(domaine.mots_cles.slice(0, 3).join(" "))}` +
        `&location=${encodeURIComponent(localisation)}&f_TPR=r604800`;
      const resultat = await appelIA(etat, {
        instructions:
          "Tu lis une page publique de résultats de recherche d'emploi LinkedIn et tu en extrais les offres. " +
          "Réponds UNIQUEMENT en JSON : " +
          '{"offres": [{"source_ref": string ("li-" suivi de l\'identifiant numérique présent dans l\'URL de l\'offre), ' +
          '"titre": string, "entreprise": string, "lieu": string, ' +
          '"lien": string (URL de l\'offre, format https://www.linkedin.com/jobs/view/<id>/), ' +
          '"date_publication": string (AAAA-MM-JJ si déductible, sinon "")}]}. ' +
          "N'invente aucune offre : uniquement celles réellement présentes sur la page. " +
          'Si la page est illisible, bloquée ou sans offres, réponds {"erreur": "raison courte en français"}.',
        contenu: "Voici la page de résultats à analyser : " + url,
        formatJSON: true,
        url: true,
      });
      if (resultat.erreur) throw new Error(resultat.erreur);
      brutes = resultat.offres || [];
    }

    if (!brutes.length) {
      throw new Error("LinkedIn bloque la lecture en ce moment (relais publics" +
        (iaConfiguree(etat) ? " et IA" : "") + ")");
    }

    await traiterResultats(etat, domaine, brutes, restantes);
  } catch (e) {
    message("❌ " + traduireErreurRecherche(e.message), false);
  } finally {
    bouton.disabled = false;
  }
}

function traduireErreurRecherche(texte) {
  // Les échecs arrivent en texte libre (relais ou IA). On garde le message
  // d'origine quand il est parlant, avec un rappel du repli fiable.
  const blocage = /bloq|robot|connexion|authwall|login|relais|lue/i.test(texte || "");
  if (blocage) {
    return "LinkedIn bloque la lecture automatique en ce moment — réessaie plus tard, ou utilise l'ajout par lien/texte (fiable et illimité).";
  }
  return (texte || "La recherche a échoué") + " — réessaie, ou utilise l'ajout par lien/texte.";
}

/* ---------- Parseur du HTML « invité » de LinkedIn ----------
   (repris tel quel de l'ancienne Edge Function, validé sur du vrai HTML ;
   si LinkedIn change sa structure, la cascade passe à la voie IA — jamais de crash) */

function parserCartes(html) {
  const resultats = [];
  const cartes = html.split(/<li[^>]*>/).slice(1);
  for (const carte of cartes) {
    const lien = attraper(carte, /class="base-card__full-link[^"]*"[^>]*href="([^"]+)"/) ||
                 attraper(carte, /href="(https:\/\/[a-z.]*linkedin\.com\/jobs\/view\/[^"]+)"/);
    const titre = nettoyer(attraper(carte, /class="base-search-card__title[^"]*"[^>]*>([\s\S]*?)<\//));
    const entreprise = nettoyer(attraper(carte, /class="base-search-card__subtitle[^"]*"[^>]*>[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/)) ||
                       nettoyer(attraper(carte, /class="base-search-card__subtitle[^"]*"[^>]*>([\s\S]*?)<\//));
    const lieu = nettoyer(attraper(carte, /class="job-search-card__location[^"]*"[^>]*>([\s\S]*?)<\//));
    const date = attraper(carte, /datetime="(\d{4}-\d{2}-\d{2})"/);
    const jobId = lien ? attraper(lien, /-(\d{6,})(?:\?|$)/) || attraper(lien, /\/view\/(\d{6,})/) : "";
    if (!titre || !jobId) continue;
    resultats.push({
      source_ref: "li-" + jobId,
      titre,
      entreprise: entreprise || "",
      lieu: lieu || "",
      lien: "https://www.linkedin.com/jobs/view/" + jobId + "/",
      date_publication: date || "",
    });
  }
  return resultats;
}

function attraper(texte, regex) {
  const m = texte.match(regex);
  return m ? m[1] : "";
}

function nettoyer(texte) {
  return texte.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/\s+/g, " ").trim();
}

/* ---------- Tri IA + insertion ---------- */

async function traiterResultats(etat, domaine, brutes, restantes) {
  const dejaLa = new Set(etat.offres.map((o) => o.source_ref).filter(Boolean));
  let candidates = brutes.filter((o) => !dejaLa.has(o.source_ref));
  const doublons = brutes.length - candidates.length;
  let ecartees = 0;

  if (candidates.length && iaConfiguree(etat)) {
    message(`⏳ ${brutes.length} offres reçues — ton IA trie les plus pertinentes…`);
    try {
      const exclusions = (etat.criteres?.exclusions || []).join(", ") || "aucune";
      const verdicts = await appelIA(etat, {
        instructions:
          `Tu tries des offres d'emploi pour une recherche d'alternance dans le domaine « ${domaine.nom} » ` +
          `(postes visés : ${(domaine.postes || []).join(", ")}). Exclusions à écarter : ${exclusions}. ` +
          "Pour chaque offre de la liste JSON fournie, décide si elle est pertinente (alternance/apprentissage " +
          "dans le domaine, hors exclusions). Réponds UNIQUEMENT en JSON : " +
          '{"verdicts": [{"source_ref": string, "garder": boolean, "resume": string (1 phrase en français si gardée, "" sinon)}]}',
        contenu: JSON.stringify(candidates.map(({ source_ref, titre, entreprise, lieu }) => ({ source_ref, titre, entreprise, lieu }))),
        formatJSON: true,
      });
      const parRef = new Map((verdicts.verdicts || []).map((v) => [v.source_ref, v]));
      const gardees = [];
      for (const o of candidates) {
        const v = parRef.get(o.source_ref);
        if (v && v.garder === false) { ecartees++; continue; }
        if (v?.resume) o.description_resume = v.resume;
        gardees.push(o);
      }
      candidates = gardees;
    } catch { /* IA indisponible : on garde tout, l'utilisateur triera à la main */ }
  }

  for (const o of candidates) {
    await creerOffre(etat.userId, {
      source: "linkedin",
      source_ref: o.source_ref,
      titre: o.titre,
      entreprise: o.entreprise || "",
      lieu: o.lieu || "",
      lien: o.lien || "",
      description_resume: o.description_resume || "",
      domaine: domaine.id,
      // On ne garde la date que si elle est bien au format AAAA-MM-JJ (l'IA peut se tromper)
      date_publication: /^\d{4}-\d{2}-\d{2}$/.test(o.date_publication || "") ? o.date_publication : null,
    });
  }
  await etat.rafraichir();
  message(`✅ ${candidates.length} offre(s) ajoutée(s) en 🆕 Nouvelle` +
    (doublons ? ` · ${doublons} déjà connue(s)` : "") +
    (ecartees ? ` · ${ecartees} écartée(s) par ton IA` : "") +
    (restantes !== undefined ? ` · ${restantes} recherche(s) restante(s) aujourd'hui` : ""));
}
