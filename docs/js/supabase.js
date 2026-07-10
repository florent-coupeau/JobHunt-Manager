/* Client Supabase partagé par toutes les pages. */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";

export const configManquante = !SUPABASE_URL || !SUPABASE_ANON_KEY;

/* Tolère une URL collée avec un chemin en trop (ex. "…supabase.co/rest/v1/") :
   seul "https://xxxx.supabase.co" doit être gardé. */
const urlPropre = (SUPABASE_URL || "").replace(/\/(rest|auth|realtime|storage)\/v1\/?$/, "").replace(/\/+$/, "");

export const supabase = configManquante
  ? null
  : createClient(urlPropre, SUPABASE_ANON_KEY);

/* Si la config est vide, on affiche un message clair au lieu d'un écran cassé. */
export function verifierConfig() {
  if (!configManquante) return true;
  document.body.innerHTML = `
    <div class="erreur" style="margin-top:60px">
      <h2>⚙️ Configuration manquante</h2>
      <p>Le fichier <code>js/config.js</code> ne contient pas encore l'adresse du projet Supabase.</p>
      <p>Suis l'étape 3 du fichier <code>INSTALLATION.md</code> pour la remplir (2 minutes).</p>
    </div>`;
  return false;
}
