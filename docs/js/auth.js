/* Session : garde de page, déconnexion. */

import { supabase } from "./supabase.js";

/* Renvoie la session si connecté, sinon redirige vers la page de connexion. */
export async function exigerConnexion() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    location.href = "connexion.html";
    return null;
  }
  return session;
}

export async function deconnexion() {
  await supabase.auth.signOut();
  location.href = "connexion.html";
}
