/* Edge Function « recherche-linkedin » — interroge la page PUBLIQUE de recherche
   d'offres LinkedIn (endpoint invité, sans compte) et renvoie les offres brutes.

   ⚠️ Méthode non officielle (zone grise des CGU LinkedIn) : peut être bloquée ou
   casser à tout moment. Le site affiche un avertissement obligatoire à l'utilisateur
   et propose toujours l'import manuel en solution de repli.

   Garde-fous : utilisateur connecté obligatoire (JWT), maximum 5 recherches par
   jour et par compte, aucune écriture d'offres ici (le navigateur s'en charge).

   Déploiement : dashboard Supabase → Edge Functions (voir INSTALLATION.md). */

import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MAX_RECHERCHES_JOUR = 5;
const MAX_MOTS_CLES = 3;

function reponse(corps: unknown, status = 200): Response {
  return new Response(JSON.stringify(corps), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return reponse({ erreur: "methode" }, 405);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // --- Utilisateur connecté uniquement ---
  const jwt = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  const { data: { user } } = await supabase.auth.getUser(jwt);
  if (!user) return reponse({ erreur: "non_connecte" }, 401);

  // --- Rate limit : 5 recherches / jour / compte ---
  const aujourdhui = new Date().toISOString().slice(0, 10);
  const { data: params } = await supabase.from("parametres")
    .select("recherches_jour, derniere_recherche").eq("user_id", user.id).maybeSingle();
  const dejaFaites = params?.derniere_recherche === aujourdhui ? (params.recherches_jour || 0) : 0;
  if (dejaFaites >= MAX_RECHERCHES_JOUR) {
    return reponse({ erreur: "limite_jour", max: MAX_RECHERCHES_JOUR }, 429);
  }
  await supabase.from("parametres").upsert({
    user_id: user.id,
    recherches_jour: dejaFaites + 1,
    derniere_recherche: aujourdhui,
  });

  // --- Requêtes vers l'endpoint public LinkedIn ---
  const { motsCles = [], localisation = "France", debug = false } = await req.json().catch(() => ({}));
  const requetes = (Array.isArray(motsCles) ? motsCles : [motsCles])
    .map((m) => String(m).trim()).filter(Boolean).slice(0, MAX_MOTS_CLES);
  if (!requetes.length) return reponse({ erreur: "mots_cles_manquants" }, 400);

  const offres = new Map<string, Record<string, string>>();
  let htmlRecu = false;
  let bloque = false;
  let diagnostic = "";

  for (const mots of requetes) {
    const url = "https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search" +
      `?keywords=${encodeURIComponent(mots)}&location=${encodeURIComponent(localisation)}` +
      "&f_TPR=r604800&start=0"; // offres des 7 derniers jours

    // LinkedIn est capricieux avec les IP de serveurs : jusqu'à 3 tentatives par mot-clé.
    for (let essai = 0; essai < 3; essai++) {
      if (essai) await new Promise((r) => setTimeout(r, 800 * essai));
      let rep: Response;
      try {
        rep = await fetch(url, {
          redirect: "manual", // une redirection vers /authwall = blocage, pas une erreur de format
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml",
            "Accept-Language": "fr-FR,fr;q=0.9",
          },
        });
      } catch {
        diagnostic = "fetch_impossible";
        continue;
      }
      diagnostic = "http_" + rep.status;

      if ([301, 302, 303, 307, 308].includes(rep.status) || rep.status === 429 || rep.status === 999 || rep.status === 403) {
        bloque = true; // redirection (authwall) ou refus explicite : IP mal vue, on retente
        await rep.body?.cancel();
        continue;
      }
      if (!rep.ok) { await rep.body?.cancel(); continue; }

      const html = await rep.text();
      if (/authwall|uas\/login|sign-in|inscription pour voir/i.test(html.slice(0, 4000)) && !html.includes("base-search-card")) {
        bloque = true; // page de connexion servie avec un statut 200
        diagnostic = "authwall_200";
        continue;
      }
      htmlRecu = true;
      if (debug) diagnostic = "html_" + html.length + ":" + html.slice(0, 600).replace(/\s+/g, " ");
      for (const offre of parserCartes(html)) offres.set(offre.source_ref, offre);
      break; // tentative réussie pour ce mot-clé
    }
  }

  if (offres.size > 0) {
    return reponse({
      offres: [...offres.values()],
      recherches_restantes: MAX_RECHERCHES_JOUR - dejaFaites - 1,
    });
  }
  if (!htmlRecu || bloque) return reponse({ erreur: "linkedin_bloque", diagnostic }, 502);
  return reponse({ erreur: "format_change", diagnostic: debug ? diagnostic : undefined }, 502);
});

/* Extraction des cartes d'offres du HTML invité de LinkedIn.
   Si LinkedIn change sa structure, on renverra « format_change » et le site
   proposera l'import manuel — jamais de crash. */
function parserCartes(html: string): Record<string, string>[] {
  const resultats: Record<string, string>[] = [];
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

function attraper(texte: string, regex: RegExp): string {
  const m = texte.match(regex);
  return m ? m[1] : "";
}

function nettoyer(texte: string): string {
  return texte.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/\s+/g, " ").trim();
}
