/* Point d'entrée de l'application (page index.html). */

import { verifierConfig } from "./supabase.js";
import { exigerConnexion, deconnexion } from "./auth.js";
import { chargerTout } from "./donnees.js";
import { afficherDashboard } from "./vues/dashboard.js";
import { afficherOffres, initOffres } from "./vues/offres.js";
import { afficherKanban } from "./vues/kanban.js";
import { afficherEntreprises } from "./vues/entreprises.js";
import { afficherCriteres } from "./vues/criteres.js";
import { afficherCV } from "./vues/cv.js";
import { afficherParametres } from "./vues/parametres.js";
import { initRechercheLinkedin, afficherRecherche } from "./linkedin.js";

const etat = {
  userId: null,
  offres: [],
  entreprises: [],
  criteres: null,
  parametres: null,
  masterCV: null,
  rafraichir: null, // rechargé + réaffiché ; utilisé par toutes les vues après une action
};

function toutAfficher() {
  afficherDashboard(etat);
  afficherOffres(etat);
  afficherKanban(etat);
  afficherEntreprises(etat);
  afficherCriteres(etat);
  afficherCV(etat);
  afficherParametres(etat);
  afficherRecherche(etat);
}

async function rafraichir() {
  try {
    Object.assign(etat, await chargerTout(etat.userId));
    document.getElementById("app").hidden = false;
    document.getElementById("erreur-chargement").hidden = true;
    toutAfficher();
  } catch (e) {
    console.error(e);
    document.getElementById("app").hidden = true;
    document.getElementById("erreur-chargement").hidden = false;
    document.getElementById("erreur-detail").textContent = e.message || "";
  }
}
etat.rafraichir = rafraichir;

function initOnglets() {
  for (const bouton of document.querySelectorAll(".tab")) {
    bouton.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach((b) => b.classList.remove("active"));
      document.querySelectorAll(".panel").forEach((p) => p.classList.remove("active"));
      bouton.classList.add("active");
      document.getElementById("tab-" + bouton.dataset.tab).classList.add("active");
    });
  }
}

function initTheme() {
  const racine = document.documentElement;
  const themeMemo = localStorage.getItem("theme");
  if (themeMemo) racine.dataset.theme = themeMemo;
  document.getElementById("btn-theme").addEventListener("click", () => {
    const sombreActuel = racine.dataset.theme === "dark" ||
      (!racine.dataset.theme && matchMedia("(prefers-color-scheme: dark)").matches);
    racine.dataset.theme = sombreActuel ? "light" : "dark";
    localStorage.setItem("theme", racine.dataset.theme);
  });
}

async function initialiser() {
  if (!verifierConfig()) return;
  const session = await exigerConnexion();
  if (!session) return;

  etat.userId = session.user.id;
  document.getElementById("email-utilisateur").textContent = session.user.email;
  document.getElementById("btn-deconnexion").addEventListener("click", deconnexion);

  initOnglets();
  initTheme();
  initOffres(etat);
  initRechercheLinkedin(etat);
  await rafraichir();
}

initialiser();
