/* Connexion IA : l'utilisateur branche SA clé API (Gemini gratuit ou Anthropic).
   La clé reste dans CE navigateur (localStorage) — elle ne va jamais dans la base. */

import { supabase } from "./supabase.js";

export const FOURNISSEURS = {
  gemini: {
    nom: "Google Gemini",
    modele: "gemini-2.5-flash",
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
   formatJSON   : true → force du JSON et renvoie l'objet parsé */
export async function appelIA(etat, { instructions, contenu, formatJSON = false }) {
  const fournisseur = fournisseurActuel(etat);
  const cle = cleIA(fournisseur);
  if (!cle) throw new Error("Aucune clé API — configure ton IA dans l'onglet ⚙️ Paramètres.");

  const texte = fournisseur === "anthropic"
    ? await appelAnthropic(cle, instructions, contenu, formatJSON)
    : await appelGemini(cle, instructions, contenu, formatJSON);

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

async function appelGemini(cle, instructions, contenu, formatJSON) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${FOURNISSEURS.gemini.modele}:generateContent?key=${encodeURIComponent(cle)}`;
  let rep;
  try {
    rep = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: instructions }] },
        contents: [{ role: "user", parts: [{ text: contenu }] }],
        generationConfig: formatJSON ? { responseMimeType: "application/json" } : {},
      }),
    });
  } catch {
    throw new Error("Impossible de joindre Gemini — vérifie ta connexion internet.");
  }
  if (!rep.ok) throw new Error(traduireErreur(rep.status, "Gemini"));
  const donnees = await rep.json();
  const texte = donnees.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("") || "";
  if (!texte) throw new Error("Gemini a renvoyé une réponse vide — réessaie.");
  return texte;
}

/* ---------- Anthropic (SDK officiel, chargé à la demande) ---------- */

async function appelAnthropic(cle, instructions, contenu, formatJSON) {
  const { default: Anthropic } = await import("https://esm.sh/@anthropic-ai/sdk");
  const client = new Anthropic({ apiKey: cle, dangerouslyAllowBrowser: true });
  let message;
  try {
    message = await client.messages.create({
      model: FOURNISSEURS.anthropic.modele,
      max_tokens: 4096, // les extractions demandées sont volontairement courtes
      system: instructions + (formatJSON ? "\nRéponds UNIQUEMENT avec un objet JSON valide, sans texte autour ni bloc de code." : ""),
      messages: [{ role: "user", content: contenu }],
    });
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) throw new Error("Clé Anthropic invalide ou révoquée.");
    if (e instanceof Anthropic.RateLimitError) throw new Error("Limite de requêtes Anthropic atteinte — attends une minute.");
    if (e instanceof Anthropic.APIConnectionError) throw new Error("Impossible de joindre Anthropic — vérifie ta connexion internet.");
    if (e instanceof Anthropic.APIError) throw new Error(traduireErreur(e.status, "Anthropic"));
    throw e;
  }
  if (message.stop_reason === "refusal") throw new Error("La demande a été refusée par l'IA — reformule le texte.");
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
