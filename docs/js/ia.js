/* Connexion IA : l'utilisateur branche SA clé API (Gemini gratuit ou Anthropic).
   La clé reste dans CE navigateur (localStorage) — elle ne va jamais dans la base. */

import { supabase } from "./supabase.js";

export const FOURNISSEURS = {
  gemini: {
    nom: "Google Gemini",
    modele: "gemini-3.5-flash",
    lienCle: "https://aistudio.google.com/apikey",
    infoCle: "Clé gratuite en 1 minute avec un compte Google (bouton « Créer une clé API »).",
  },
  anthropic: {
    nom: "Anthropic (Claude)",
    modele: "claude-opus-4-8",
    lienCle: "https://console.claude.com/settings/keys",
    infoCle: "Nécessite un compte Claude API avec du crédit (payant à l'usage).",
  },
};

export function cleIA(fournisseur) {
  return localStorage.getItem("cle-ia-" + fournisseur) || "";
}

export function definirCleIA(fournisseur, cle) {
  if (cle) localStorage.setItem("cle-ia-" + fournisseur, cle);
  else localStorage.removeItem("cle-ia-" + fournisseur);
}

export function fournisseurActuel(etat) {
  return etat.parametres?.fournisseur_ia || "gemini";
}

export async function definirFournisseur(etat, fournisseur) {
  const { error } = await supabase.from("parametres")
    .upsert({ user_id: etat.userId, fournisseur_ia: fournisseur });
  if (error) throw new Error("Enregistrement du fournisseur : " + error.message);
}

/* L'IA est-elle prête à l'emploi ? (fournisseur choisi ET clé présente) */
export function iaConfiguree(etat) {
  return Boolean(cleIA(fournisseurActuel(etat)));
}

/* ---------- Appel générique ----------
   instructions : le rôle et le format attendus (système)
   contenu      : le texte à traiter
   formatJSON   : true → force du JSON et renvoie l'objet parsé
   url          : true → autorise l'IA à ALLER LIRE les pages web citées dans `contenu`
                  (outil web_fetch d'Anthropic / url_context de Gemini — l'appel part
                  du navigateur vers le fournisseur IA, jamais par notre backend) */
export async function appelIA(etat, { instructions, contenu, formatJSON = false, url = false }) {
  const fournisseur = fournisseurActuel(etat);
  const cle = cleIA(fournisseur);
  if (!cle) throw new Error("Aucune clé API — configure ton IA dans l'onglet ⚙️ Paramètres.");

  const texte = fournisseur === "anthropic"
    ? await appelAnthropic(cle, instructions, contenu, formatJSON, url)
    : await appelGemini(cle, instructions, contenu, formatJSON, url);

  return formatJSON ? parserJSON(texte) : texte;
}

/* Test rapide d'une clé : renvoie null si OK, un message d'erreur sinon. */
export async function testerCle(fournisseur, cle) {
  try {
    if (fournisseur === "anthropic") await appelAnthropic(cle, "Réponds uniquement : ok", "ping", false);
    else await appelGemini(cle, "Réponds uniquement : ok", "ping", false);
    return null;
  } catch (e) {
    return e.message;
  }
}

/* ---------- Gemini (REST, CORS natif) ---------- */

/* Modèles essayés dans l'ordre quand le précédent est indisponible ou surchargé. */
const MODELES_GEMINI = ["gemini-3.5-flash", "gemini-2.5-flash", "gemini-3.5-flash-lite", "gemini-2.5-flash-lite", "gemini-flash-latest"];
const pause = (ms) => new Promise((r) => setTimeout(r, ms));

async function appelGemini(cle, instructions, contenu, formatJSON, url = false) {
  const memorise = localStorage.getItem("modele-gemini");
  const candidats = [...new Set([memorise, ...MODELES_GEMINI].filter(Boolean))];
  let derniereErreur = 503;

  for (const modele of candidats) {
    // Surcharge passagère (500/503/529) : on réessaie 2 fois avant de changer de modèle.
    for (const attente of [0, 1500, 4000]) {
      if (attente) await pause(attente);
      const rep = await requeteGemini(cle, modele, instructions, contenu, formatJSON, url);

      if (rep.ok) {
        localStorage.setItem("modele-gemini", modele);
        const donnees = await rep.json();
        const texte = donnees.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("") || "";
        if (!texte) throw new Error("Gemini a renvoyé une réponse vide — réessaie.");
        return texte;
      }

      derniereErreur = rep.status;
      if (rep.status === 404) break; // modèle inconnu pour cette clé : candidat suivant
      if (![500, 503, 529].includes(rep.status)) throw new Error(traduireErreur(rep.status, "Gemini"));
    }
  }

  // Tous les candidats connus ont échoué : dernier recours, demander la liste à Google.
  if (derniereErreur === 404) {
    const autre = await decouvrirModeleGemini(cle);
    if (autre && !candidats.includes(autre)) {
      const rep = await requeteGemini(cle, autre, instructions, contenu, formatJSON, url);
      if (rep.ok) {
        localStorage.setItem("modele-gemini", autre);
        const donnees = await rep.json();
        const texte = donnees.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("") || "";
        if (texte) return texte;
      }
      derniereErreur = rep.status;
    }
  }
  throw new Error(traduireErreur(derniereErreur, "Gemini"));
}

async function requeteGemini(cle, modele, instructions, contenu, formatJSON, url = false) {
  try {
    return await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${modele}:generateContent?key=${encodeURIComponent(cle)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: instructions }] },
          contents: [{ role: "user", parts: [{ text: contenu }] }],
          // url_context : Gemini va lire lui-même les URLs citées dans le message.
          ...(url ? { tools: [{ url_context: {} }] } : {}),
          // responseMimeType JSON + outils : combinaison non garantie → quand on lit le web,
          // le JSON est demandé par le prompt et parserJSON() fait le tri.
          generationConfig: formatJSON && !url ? { responseMimeType: "application/json" } : {},
        }),
      }
    );
  } catch {
    throw new Error("Impossible de joindre Gemini — vérifie ta connexion internet.");
  }
}

/* Interroge la liste des modèles accessibles avec la clé et choisit le
   meilleur « flash » (rapide et couvert par le palier gratuit). */
async function decouvrirModeleGemini(cle) {
  try {
    const rep = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(cle)}&pageSize=200`);
    if (!rep.ok) return null;
    const { models } = await rep.json();
    const noms = (models || [])
      .filter((m) => (m.supportedGenerationMethods || []).includes("generateContent"))
      .map((m) => m.name.replace(/^models\//, ""));
    const preferes = ["gemini-3.5-flash", "gemini-flash-latest", "gemini-2.5-flash"];
    return preferes.find((p) => noms.includes(p))
      || noms.find((n) => n.includes("flash") && !n.includes("lite") && !n.includes("preview"))
      || noms.find((n) => n.includes("flash"))
      || noms[0] || null;
  } catch {
    return null;
  }
}

/* ---------- Anthropic (SDK officiel, chargé à la demande) ---------- */

async function appelAnthropic(cle, instructions, contenu, formatJSON, url = false) {
  const { default: Anthropic } = await import("https://esm.sh/@anthropic-ai/sdk");
  const client = new Anthropic({ apiKey: cle, dangerouslyAllowBrowser: true });

  const requete = {
    model: FOURNISSEURS.anthropic.modele,
    max_tokens: url ? 8192 : 4096, // lire une page demande plus de place que nos extractions courtes
    system: instructions + (formatJSON ? "\nRéponds UNIQUEMENT avec un objet JSON valide, sans texte autour ni bloc de code." : ""),
    messages: [{ role: "user", content: contenu }],
  };
  if (url) {
    // web_fetch : Claude va lire lui-même les URLs citées dans le message.
    // max_content_tokens borne le coût si la page est très longue.
    requete.tools = [{ type: "web_fetch_20260209", name: "web_fetch", max_uses: 3, max_content_tokens: 30000 }];
  }

  let message;
  try {
    message = await client.messages.create(requete);
    if (message.stop_reason === "pause_turn") {
      // La lecture web a été mise en pause côté serveur : on relance UNE fois pour la terminer.
      message = await client.messages.create({
        ...requete,
        messages: [...requete.messages, { role: "assistant", content: message.content }],
      });
    }
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) throw new Error("Clé Anthropic invalide ou révoquée.");
    if (e instanceof Anthropic.RateLimitError) throw new Error("Limite de requêtes Anthropic atteinte — attends une minute.");
    if (e instanceof Anthropic.APIConnectionError) throw new Error("Impossible de joindre Anthropic — vérifie ta connexion internet.");
    if (e instanceof Anthropic.APIError) throw new Error(traduireErreur(e.status, "Anthropic"));
    throw e;
  }
  if (message.stop_reason === "refusal") throw new Error("La demande a été refusée par l'IA — reformule le texte.");

  // Lecture web : si TOUTES les tentatives de lecture ont échoué (pas d'exception HTTP :
  // l'échec arrive dans un bloc résultat avec un error_code), on le dit clairement.
  const lectures = message.content.filter((b) => b.type === "web_fetch_tool_result");
  if (lectures.length && lectures.every((b) => Boolean(b.content?.error_code))) {
    throw new Error("La page n'a pas pu être lue (site qui bloque les robots ou page derrière une connexion) — utilise le collage de texte.");
  }

  return message.content.filter((b) => b.type === "text").map((b) => b.text).join("");
}

/* ---------- Utilitaires ---------- */

function traduireErreur(status, nom) {
  const messages = {
    400: `${nom} a refusé la requête (contenu trop long ou invalide).`,
    401: `Clé ${nom} invalide — vérifie-la dans ⚙️ Paramètres.`,
    403: `Clé ${nom} sans autorisation — vérifie-la dans ⚙️ Paramètres.`,
    404: `Modèle ${nom} introuvable — l'application a peut-être besoin d'une mise à jour.`,
    429: `Quota ${nom} atteint — attends un peu (ou vérifie ton palier gratuit).`,
    500: `${nom} rencontre un problème — réessaie dans quelques minutes.`,
    503: `Les serveurs ${nom} sont saturés en ce moment — réessaie dans quelques minutes.`,
    529: `${nom} est surchargé — réessaie dans quelques minutes.`,
  };
  return messages[status] || `Erreur ${nom} (HTTP ${status}) — réessaie.`;
}

/* Parse défensif : accepte du JSON nu ou entouré de texte / bloc de code. */
function parserJSON(texte) {
  try {
    return JSON.parse(texte);
  } catch { /* on tente d'extraire le premier objet { ... } */ }
  const debut = texte.indexOf("{");
  const fin = texte.lastIndexOf("}");
  if (debut !== -1 && fin > debut) {
    try {
      return JSON.parse(texte.slice(debut, fin + 1));
    } catch { /* échec aussi */ }
  }
  throw new Error("L'IA n'a pas renvoyé un format exploitable — réessaie.");
}
