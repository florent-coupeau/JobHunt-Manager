/* Compagnon local — recherche LinkedIn « turbo » via Claude Code + MCP.

   Ce script tourne sur TON PC (jamais sur un serveur) :
   1. il se connecte à TON compte Supabase (email/mot de passe dans compagnon/.env) ;
   2. il lit tes critères et les offres déjà connues ;
   3. il lance Claude Code en arrière-plan, qui interroge LinkedIn via le serveur
      MCP (avec ton compte LinkedIn) et trie les offres selon tes critères ;
   4. il insère les nouvelles offres dans Supabase → elles apparaissent sur le site.

   Usage : double-clic sur rechercher.bat, ou : node rechercher.mjs [nom du domaine]
   Zéro dépendance : Node ≥ 18 suffit (fetch intégré). */

import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import os from "node:os";

const ICI = path.dirname(fileURLToPath(import.meta.url));
const MAX_OFFRES_PAR_RECHERCHE = 15; // modération : on reste discret vis-à-vis de LinkedIn

/* ---------- 1. Configuration ---------- */

/* URL + clé publique Supabase : les mêmes que le site (lues dans docs/js/config.js). */
function configSupabase() {
  const source = readFileSync(path.join(ICI, "..", "docs", "js", "config.js"), "utf8");
  const url = (source.match(/SUPABASE_URL\s*=\s*["']([^"']+)["']/) || [])[1];
  const cle = (source.match(/SUPABASE_ANON_KEY\s*=\s*["']([^"']+)["']/) || [])[1];
  if (!url || !cle) throw new Error("Impossible de lire docs/js/config.js (SUPABASE_URL / SUPABASE_ANON_KEY).");
  return { url: url.replace(/\/+$/, "").replace(/\/rest\/v1$/, ""), cle };
}

/* Identifiants personnels : compagnon/.env (jamais commité — voir .env.exemple). */
function identifiants() {
  const chemin = path.join(ICI, ".env");
  if (!existsSync(chemin)) {
    throw new Error(
      "Fichier compagnon/.env introuvable.\n" +
      "→ Copie compagnon/.env.exemple vers compagnon/.env et remplis ton email + mot de passe du site."
    );
  }
  const valeurs = {};
  for (const ligne of readFileSync(chemin, "utf8").split(/\r?\n/)) {
    const m = ligne.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
    if (m) valeurs[m[1]] = m[2];
  }
  if (!valeurs.EMAIL || !valeurs.MOT_DE_PASSE) throw new Error("compagnon/.env incomplet : il faut EMAIL et MOT_DE_PASSE.");
  return valeurs;
}

/* ---------- 2. Accès Supabase (API REST, comme le site mais en Node) ---------- */

async function connexionSupabase(config, email, motDePasse) {
  const rep = await fetch(`${config.url}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: config.cle },
    body: JSON.stringify({ email, password: motDePasse }),
  });
  const corps = await rep.json();
  if (!rep.ok) throw new Error("Connexion Supabase refusée : " + (corps.error_description || corps.msg || rep.status));
  return { jeton: corps.access_token, userId: corps.user.id };
}

async function lireTable(config, session, requete) {
  const rep = await fetch(`${config.url}/rest/v1/${requete}`, {
    headers: { apikey: config.cle, Authorization: "Bearer " + session.jeton },
  });
  if (!rep.ok) throw new Error(`Lecture ${requete} : HTTP ${rep.status}`);
  return rep.json();
}

async function insererOffre(config, session, offre) {
  const rep = await fetch(`${config.url}/rest/v1/offres`, {
    method: "POST",
    headers: {
      apikey: config.cle,
      Authorization: "Bearer " + session.jeton,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({ user_id: session.userId, ...offre }),
  });
  if (!rep.ok) throw new Error(`Insertion « ${offre.titre} » : HTTP ${rep.status} ${await rep.text()}`);
}

/* ---------- 3. Localisation de la CLI Claude (comme le serveur v2) ---------- */

function trouverClaude() {
  // 1. « claude » sur le PATH ?
  for (const dossier of (process.env.PATH || "").split(path.delimiter)) {
    for (const nom of ["claude.exe", "claude.cmd", "claude"]) {
      const exe = path.join(dossier, nom);
      if (existsSync(exe)) return exe;
    }
  }
  // 2. Sinon, le binaire embarqué dans l'extension VS Code (version la plus récente).
  const extensions = path.join(os.homedir(), ".vscode", "extensions");
  let meilleur = null;
  let dateMax = 0;
  try {
    for (const nom of readdirSync(extensions)) {
      if (!nom.startsWith("anthropic.claude-code-")) continue;
      const exe = path.join(extensions, nom, "resources", "native-binary", "claude.exe");
      try {
        const infos = statSync(exe);
        if (infos.mtimeMs > dateMax) { dateMax = infos.mtimeMs; meilleur = exe; }
      } catch { /* pas de binaire dans cette version */ }
    }
  } catch { /* dossier extensions introuvable */ }
  return meilleur;
}

/* ---------- 4. La tâche confiée à Claude ---------- */

function construirePrompt(domaine, criteres) {
  const exclusions = (criteres.exclusions || []).join(", ") || "aucune";
  const zone = criteres.localisation?.zone || "France";
  return `Recherche automatisée d'offres d'alternance via le serveur MCP LinkedIn. Suis ces étapes exactement :
1. Fais au MAXIMUM 2 appels à l'outil search_jobs, avec des mots-clés parmi : ${(domaine.mots_cles || []).join(" ; ")}.
   Paramètres : location "${zone}", date_posted "past_week", sort_by "date".
2. Garde uniquement les vraies offres d'alternance / apprentissage / contrat de professionnalisation,
   pertinentes pour le domaine « ${domaine.nom} » (postes visés : ${(domaine.postes || []).join(", ") || "non précisés"}).
   Écarte : postes seniors, CDI classiques, stages courts, freelance, et tout ce qui touche à : ${exclusions}.
3. Garde au maximum ${MAX_OFFRES_PAR_RECHERCHE} offres, les plus pertinentes.
4. Termine ta réponse par UNIQUEMENT un bloc JSON (aucun texte après), au format exact :
{"offres": [{"source_ref": "li-<id numérique de l'offre>", "titre": "...", "entreprise": "...", "lieu": "...",
"lien": "https://www.linkedin.com/jobs/view/<id>/", "description_resume": "1 phrase en français",
"date_publication": "AAAA-MM-JJ ou chaîne vide"}]}
N'invente aucune offre. Ne modifie aucun fichier. Ne fais aucun commit.`;
}

function lancerClaude(claudeExe, prompt) {
  return new Promise((resoudre, rejeter) => {
    const proc = spawn(claudeExe, [
      "-p",
      "--mcp-config", path.join(ICI, "mcp.json"),
      "--strict-mcp-config",
      "--allowedTools", "mcp__mcp-server-linkedin__search_jobs,mcp__mcp-server-linkedin__get_job_details",
    ], { cwd: ICI });

    let sortie = "";
    proc.stdout.on("data", (d) => { sortie += d.toString(); process.stdout.write("."); });
    proc.stderr.on("data", (d) => { sortie += d.toString(); });

    const garde = setTimeout(() => {
      proc.kill();
      rejeter(new Error("Délai dépassé (10 min) — tâche interrompue."));
    }, 10 * 60 * 1000);

    proc.on("error", (e) => { clearTimeout(garde); rejeter(e); });
    proc.on("close", (code) => {
      clearTimeout(garde);
      console.log(""); // fin de la ligne de points de progression
      if (code !== 0 && !sortie.includes('"offres"')) {
        return rejeter(new Error("Claude a échoué (code " + code + ").\n" + sortie.slice(-800)));
      }
      resoudre(sortie);
    });

    proc.stdin.write(prompt);
    proc.stdin.end();
  });
}

/* Extrait le bloc JSON final de la réponse de Claude (parse défensif, comme le site). */
function extraireJSON(texte) {
  const debut = texte.indexOf('{"offres"');
  const dernierDebut = texte.lastIndexOf('{"offres"');
  for (const i of [dernierDebut, debut]) {
    if (i === -1) continue;
    const fin = texte.lastIndexOf("}");
    if (fin > i) {
      try { return JSON.parse(texte.slice(i, fin + 1)); } catch { /* tentative suivante */ }
    }
  }
  throw new Error("Claude n'a pas renvoyé le JSON attendu. Fin de sa réponse :\n" + texte.slice(-600));
}

/* ---------- 5. Déroulé principal ---------- */

try {
  console.log("🎯 Compagnon de recherche LinkedIn (via ton compte, résultats sur le site)\n");

  const config = configSupabase();
  const { EMAIL, MOT_DE_PASSE } = identifiants();

  console.log("→ Connexion à Supabase…");
  const session = await connexionSupabase(config, EMAIL, MOT_DE_PASSE);

  console.log("→ Lecture de tes critères et des offres connues…");
  const [criteres] = await lireTable(config, session, "criteres?select=*");
  if (!criteres) throw new Error("Aucun critère en base — configure l'onglet 🧭 Critères du site d'abord.");
  const refsConnues = new Set(
    (await lireTable(config, session, "offres?select=source_ref")).map((o) => o.source_ref).filter(Boolean)
  );

  // Domaine : argument en ligne de commande, sinon le premier des critères.
  const voulu = process.argv[2]?.toLowerCase();
  const domaines = criteres.domaines || [];
  const domaine = voulu
    ? domaines.find((d) => d.nom.toLowerCase().includes(voulu) || d.id === voulu)
    : domaines[0];
  if (!domaine) throw new Error(`Domaine introuvable. Domaines disponibles : ${domaines.map((d) => d.nom).join(", ")}`);
  if (!(domaine.mots_cles || []).length) throw new Error(`Le domaine « ${domaine.nom} » n'a pas de mots-clés (onglet 🧭 Critères).`);

  const claudeExe = trouverClaude();
  if (!claudeExe) throw new Error("CLI Claude introuvable (ni sur le PATH, ni dans l'extension VS Code).");

  console.log(`→ Claude cherche sur LinkedIn (domaine « ${domaine.nom} », 2-5 min)…`);
  const reponse = await lancerClaude(claudeExe, construirePrompt(domaine, criteres));
  const { offres = [] } = extraireJSON(reponse);

  console.log(`→ ${offres.length} offre(s) trouvée(s) par Claude — insertion des nouvelles…`);
  let ajoutees = 0;
  let doublons = 0;
  for (const o of offres) {
    if (!o.titre || !o.source_ref) continue;
    if (refsConnues.has(o.source_ref)) { doublons++; continue; }
    await insererOffre(config, session, {
      source: "linkedin",
      source_ref: o.source_ref,
      titre: o.titre,
      entreprise: o.entreprise || "",
      lieu: o.lieu || "",
      lien: o.lien || "",
      description_resume: o.description_resume || "",
      domaine: domaine.id,
      date_publication: /^\d{4}-\d{2}-\d{2}$/.test(o.date_publication || "") ? o.date_publication : null,
    });
    ajoutees++;
  }

  console.log(`\n✅ ${ajoutees} nouvelle(s) offre(s) ajoutée(s)` +
    (doublons ? ` · ${doublons} déjà connue(s)` : "") +
    " — ouvre le site (onglet 📋 Offres) pour les trier !");
} catch (e) {
  console.error("\n❌ " + e.message);
  process.exitCode = 1;
}
