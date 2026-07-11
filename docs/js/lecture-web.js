/* Lecture d'une page web DEPUIS LE NAVIGATEUR, via des relais CORS publics.

   Pourquoi : un site comme LinkedIn n'autorise pas un site tiers (le nôtre) à lire
   ses pages directement depuis le navigateur (règle CORS). Des services publics
   gratuits servent de relais : le navigateur leur demande la page, ils la
   rapportent. Rien ne passe par un serveur à nous — seule l'URL demandée
   transite par le relais (pas de donnée personnelle, pas de clé, pas de compte).

   Ces relais sont fragiles (gratuit = sans garantie) : on en essaie plusieurs
   dans l'ordre, et l'appelant garde toujours une solution de repli. */

/* Chaque relais : comment construire l'URL, et comment extraire le HTML de sa réponse.
   (validés le 10/07/2026 : cors.lol ~0,7 s, allorigins ~3-6 s) */
const RELAIS = [
  { nom: "cors.lol", construire: (url) => "https://api.cors.lol/?url=" + encodeURIComponent(url) },
  { nom: "allorigins", construire: (url) => "https://api.allorigins.win/raw?url=" + encodeURIComponent(url) },
  {
    nom: "allorigins-json",
    construire: (url) => "https://api.allorigins.win/get?url=" + encodeURIComponent(url),
    extraire: (texte) => { try { return JSON.parse(texte).contents || ""; } catch { return ""; } },
  },
];

const TIMEOUT_RELAIS_MS = 20000;
const NOMBRE_DE_PASSES = 2; // les relais gratuits ratent parfois un coup : on refait un tour
const pause = (ms) => new Promise((r) => setTimeout(r, ms));

/* La page reçue est-elle en fait un mur de connexion LinkedIn ? (même détection
   que l'ancienne version serveur : page de login servie parfois avec un statut 200) */
export function estAuthwall(html) {
  return /authwall|uas\/login|sign-in|inscription pour voir/i.test(html.slice(0, 4000)) &&
    !html.includes("base-search-card");
}

/* Lit une URL via les relais, dans l'ordre (2 passes). Renvoie le HTML, ou lève une erreur claire. */
export async function lireUrlViaProxy(url) {
  let bloque = false;
  for (let passe = 0; passe < NOMBRE_DE_PASSES; passe++) {
    if (passe) await pause(1200);
    for (const relais of RELAIS) {
      try {
        const rep = await fetch(relais.construire(url), { signal: AbortSignal.timeout(TIMEOUT_RELAIS_MS) });
        if (!rep.ok) continue;
        let html = await rep.text();
        if (relais.extraire) html = relais.extraire(html);
        if (!html || html.length < 200) continue; // réponse vide ou message d'erreur du relais
        if (estAuthwall(html)) { bloque = true; continue; } // ce relais est mal vu du site : suivant
        return html;
      } catch { /* timeout ou relais injoignable : on passe au suivant */ }
    }
  }
  throw new Error(bloque
    ? "Le site refuse la lecture automatique (mur de connexion) — même via les relais publics."
    : "Aucun relais public n'a réussi à lire la page — réessaie dans quelques minutes.");
}

/* ---------- Lecture orientée TEXTE (pour donner une page à lire à l'IA) ---------- */

/* r.jina.ai : lecteur de pages public et gratuit (sans clé) qui renvoie le TEXTE
   d'une page en markdown — il lit même les pages que LinkedIn cache derrière son
   mur de connexion. Plus fiable que les relais HTML ci-dessus, mais comme il
   renvoie du texte, il ne sert à rien pour parser du HTML (recherche LinkedIn) :
   on l'utilise quand la page est destinée à être LUE par l'IA. */
const TIMEOUT_JINA_MS = 45000; // ce lecteur visite vraiment la page : il peut prendre 15-20 s

export async function lireUrlTexte(url, maxCaracteres = 20000) {
  try {
    const rep = await fetch("https://r.jina.ai/" + url, { signal: AbortSignal.timeout(TIMEOUT_JINA_MS) });
    if (rep.ok) {
      const texte = (await rep.text()).replace(/\s+/g, " ").trim();
      // Pas de détection de mur de connexion ici : le markdown d'une page valide
      // contient souvent des liens « sign-in » (faux positif garanti). Si la page
      // est vraiment bloquée, l'IA le verra dans le texte et répondra { erreur }.
      if (texte.length >= 200) return texte.slice(0, maxCaracteres);
    }
  } catch { /* lecteur indisponible ou trop lent : on tente les relais HTML */ }
  return htmlEnTexte(await lireUrlViaProxy(url), maxCaracteres);
}

/* HTML → texte brut lisible par l'IA (balises retirées, entités décodées, longueur bornée). */
export function htmlEnTexte(html, maxCaracteres = 20000) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&").replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxCaracteres);
}
