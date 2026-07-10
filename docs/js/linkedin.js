/* Recherche automatique d'offres LinkedIn (via l'Edge Function Supabase).
   Avertissement obligatoire avant la première utilisation — méthode non officielle. */

import { supabase } from "./supabase.js";
import { el, signalerErreur } from "./ui.js";
import { creerOffre } from "./donnees.js";
import { appelIA, iaConfiguree } from "./ia.js";

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
    <p>Cette fonction interroge la <strong>page publique</strong> de recherche d'offres de LinkedIn,
    d'une façon <strong>non officielle</strong> (LinkedIn ne fournit pas d'accès gratuit officiel).</p>
    <ul>
      <li>⚖️ C'est une <strong>zone grise des conditions d'utilisation</strong> de LinkedIn ;</li>
      <li>🔌 LinkedIn peut <strong>bloquer ou casser</strong> cette fonction à tout moment, sans préavis ;</li>
      <li>🙅 Aucun compte LinkedIn n'est utilisé — <strong>ton compte personnel ne risque rien</strong> ;</li>
      <li>📉 Les résultats peuvent être incomplets — l'import manuel (coller le texte d'une annonce) reste la méthode la plus fiable ;</li>
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

async function lancerRecherche(etat) {
  const bouton = document.getElementById("btn-recherche-linkedin");
  const domaineId = document.getElementById("recherche-domaine").value;
  const domaine = (etat.criteres?.domaines || []).find((d) => d.id === domaineId);
  if (!domaine || !(domaine.mots_cles || []).length) {
    message("Ajoute d'abord des mots-clés à ce domaine dans l'onglet 🧭 Critères.", false);
    return;
  }

  bouton.disabled = true;
  message("⏳ Interrogation de LinkedIn… (méthode non officielle — peut échouer, l'import manuel reste dispo)");
  try {
    const { data, error } = await supabase.functions.invoke("recherche-linkedin", {
      body: {
        motsCles: domaine.mots_cles.slice(0, 3),
        localisation: document.getElementById("recherche-lieu").value.trim() || "France",
      },
    });
    if (error) {
      const detail = await error.context?.json?.().catch(() => null);
      throw new Error(traduireErreurRecherche(detail?.erreur, error));
    }
    if (data?.erreur) throw new Error(traduireErreurRecherche(data.erreur));

    await traiterResultats(etat, domaine, data.offres || [], data.recherches_restantes);
  } catch (e) {
    message("❌ " + e.message, false);
  } finally {
    bouton.disabled = false;
  }
}

function traduireErreurRecherche(code, erreurBrute) {
  const messages = {
    limite_jour: "Limite atteinte : 5 recherches par jour maximum — réessaie demain (ou utilise l'import manuel, illimité).",
    linkedin_bloque: "LinkedIn bloque les requêtes en ce moment — réessaie plus tard, ou colle une annonce à la main.",
    linkedin_injoignable: "LinkedIn est injoignable — réessaie dans quelques minutes.",
    format_change: "LinkedIn a changé le format de ses pages : la recherche automatique est cassée pour l'instant. Utilise l'import manuel (coller le texte d'une annonce).",
    non_connecte: "Ta session a expiré — recharge la page et reconnecte-toi.",
    mots_cles_manquants: "Aucun mot-clé pour ce domaine — complète-le dans l'onglet 🧭 Critères.",
  };
  if (code && messages[code]) return messages[code];
  if (erreurBrute?.message?.includes("Failed to send a request")) {
    return "La fonction de recherche n'est pas encore installée sur ton projet Supabase (voir INSTALLATION.md, étape 8).";
  }
  return "La recherche a échoué — réessaie, ou utilise l'import manuel.";
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
      date_publication: o.date_publication || null,
    });
  }
  await etat.rafraichir();
  message(`✅ ${candidates.length} offre(s) ajoutée(s) en 🆕 Nouvelle` +
    (doublons ? ` · ${doublons} déjà connue(s)` : "") +
    (ecartees ? ` · ${ecartees} écartée(s) par ton IA` : "") +
    (restantes !== undefined ? ` · ${restantes} recherche(s) restante(s) aujourd'hui` : ""));
}
