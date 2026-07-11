/* Onglet Paramètres : connexion de l'IA de l'utilisateur (fournisseur + clé)
   + gestion des étiquettes personnelles. */

import { el, signalerErreur } from "../ui.js";
import { FOURNISSEURS, cleIA, definirCleIA, fournisseurActuel, definirFournisseur, testerCle } from "../ia.js";
import { creerEtiquette, majEtiquette, supprimerEtiquette, PALETTE_ETIQUETTES } from "../donnees.js";

export function afficherParametres(etat) {
  const cont = document.getElementById("zone-parametres");
  cont.innerHTML = "";

  const carte = el("div", "card");
  carte.append(el("h2", null, "🤖 Mon assistant IA"));
  carte.append(el("p", "aide-fiches",
    "Branche ton propre compte IA pour débloquer l'ajout d'offres en collant un texte, " +
    "les fiches entreprises automatiques, et bientôt la recherche d'offres et le générateur de CV."));

  // --- Choix du fournisseur ---
  carte.append(libelle("Fournisseur"));
  const sel = document.createElement("select");
  sel.className = "champ-critere";
  for (const [id, f] of Object.entries(FOURNISSEURS)) {
    const opt = document.createElement("option");
    opt.value = id;
    opt.textContent = f.nom + (id === "gemini" ? " — palier gratuit ✨" : "");
    opt.selected = id === fournisseurActuel(etat);
    sel.append(opt);
  }
  carte.append(sel);

  // --- Clé API ---
  carte.append(libelle("Clé API"));
  const ligneCle = el("div", "ligne-cle");
  const champ = document.createElement("input");
  champ.type = "password";
  champ.className = "champ-critere";
  champ.placeholder = "Colle ta clé ici";
  champ.autocomplete = "off";
  const btnVoir = el("button", "btn-mini", "👁");
  btnVoir.title = "Afficher / masquer la clé";
  btnVoir.addEventListener("click", () => {
    champ.type = champ.type === "password" ? "text" : "password";
  });
  ligneCle.append(champ, btnVoir);
  carte.append(ligneCle);

  const aide = el("p", "aide-fiches");
  const lien = el("a", "lien-offre");
  lien.target = "_blank";
  lien.rel = "noopener noreferrer";
  carte.append(aide);

  const message = el("p", "message-auth");
  message.hidden = true;
  carte.append(message);

  // --- Boutons ---
  const barre = el("div", "editeur-boutons");
  const btnEnregistrer = el("button", "btn-mini btn-ok", "💾 Enregistrer");
  const btnTester = el("button", "btn-mini", "🔌 Tester la clé");
  barre.append(btnEnregistrer, btnTester);
  carte.append(barre);

  carte.append(el("p", "note-confidentialite",
    "🔒 Ta clé reste dans CE navigateur (elle n'est jamais envoyée dans la base de données). " +
    "Sur un autre appareil, il faudra la saisir à nouveau."));

  cont.append(carte, carteEtiquettes(etat));

  /* ---------- Comportement ---------- */

  function rafraichirChamps() {
    const f = FOURNISSEURS[sel.value];
    champ.value = cleIA(sel.value);
    aide.innerHTML = "";
    lien.textContent = "Obtenir une clé " + f.nom + " ↗";
    lien.href = f.lienCle;
    aide.append(lien, document.createTextNode(" — " + f.infoCle));
    message.hidden = true;
  }

  function afficherMessage(texte, ok) {
    message.textContent = texte;
    message.className = "message-auth " + (ok ? "ok" : "erreur");
    message.hidden = false;
  }

  sel.addEventListener("change", rafraichirChamps);

  btnEnregistrer.addEventListener("click", async () => {
    try {
      await definirFournisseur(etat, sel.value);
      definirCleIA(sel.value, champ.value.trim());
      etat.parametres = { ...(etat.parametres || {}), fournisseur_ia: sel.value };
      afficherMessage("✅ Enregistré ! " + (champ.value.trim()
        ? "Tu peux tester la clé avec le bouton ci-contre."
        : "(aucune clé saisie — les fonctions IA restent désactivées)"), true);
    } catch (e) {
      signalerErreur(e, "Impossible d'enregistrer les paramètres.");
    }
  });

  btnTester.addEventListener("click", async () => {
    const cle = champ.value.trim();
    if (!cle) {
      afficherMessage("Colle d'abord une clé dans le champ ci-dessus.", false);
      return;
    }
    btnTester.disabled = true;
    afficherMessage("⏳ Test en cours…", true);
    const erreur = await testerCle(sel.value, cle);
    btnTester.disabled = false;
    afficherMessage(erreur ? "❌ " + erreur : "✅ La clé fonctionne !", !erreur);
  });

  rafraichirChamps();
}

function libelle(texte) {
  return el("div", "libelle-champ", texte);
}

/* ---------- Mes étiquettes (tri personnel des offres) ---------- */

function carteEtiquettes(etat) {
  const carte = el("div", "card");
  carte.append(el("h2", null, "🏷️ Mes étiquettes"));
  carte.append(el("p", "aide-fiches",
    "Tes petites étiquettes personnelles pour trier les offres à ta façon " +
    "(ex. « Urgent », « À étudier », « Backup »). Elles apparaissent dans la colonne Étiquette de l'onglet 📋 Offres."));

  for (const etiquette of etat.etiquettes || []) {
    const ligne = el("div", "ligne-etiquette");

    const couleur = document.createElement("input");
    couleur.type = "color";
    couleur.value = etiquette.couleur;
    couleur.title = "Couleur de l'étiquette";
    couleur.addEventListener("change", async () => {
      try {
        await majEtiquette(etiquette.id, { couleur: couleur.value });
        await etat.rafraichir();
      } catch (e) {
        signalerErreur(e, "Impossible de changer la couleur.");
      }
    });

    const nom = document.createElement("input");
    nom.type = "text";
    nom.className = "champ-critere";
    nom.value = etiquette.nom;
    nom.title = "Renommer (Entrée ou clic ailleurs pour valider)";
    nom.addEventListener("change", async () => {
      const nouveau = nom.value.trim();
      if (!nouveau || nouveau === etiquette.nom) { nom.value = etiquette.nom; return; }
      try {
        await majEtiquette(etiquette.id, { nom: nouveau });
        await etat.rafraichir();
      } catch (e) {
        nom.value = etiquette.nom;
        signalerErreur(e, "Impossible de renommer (nom déjà pris ?).");
      }
    });

    const btnSupprimer = el("button", "btn-mini", "🗑️");
    btnSupprimer.title = "Supprimer cette étiquette";
    btnSupprimer.addEventListener("click", async () => {
      if (!confirm(`Supprimer l'étiquette « ${etiquette.nom} » ?\n(Les offres ne seront pas supprimées — elles redeviennent « sans étiquette ».)`)) return;
      try {
        await supprimerEtiquette(etiquette.id);
        await etat.rafraichir();
      } catch (e) {
        signalerErreur(e, "Impossible de supprimer l'étiquette.");
      }
    });

    ligne.append(couleur, nom, btnSupprimer);
    carte.append(ligne);
  }

  if (!(etat.etiquettes || []).length) {
    carte.append(el("p", "vide", "Aucune étiquette pour l'instant."));
  }

  const btnAjouter = el("button", "btn-mini btn-ok", "➕ Ajouter une étiquette");
  btnAjouter.addEventListener("click", async () => {
    const nom = (prompt("Nom de la nouvelle étiquette :") || "").trim();
    if (!nom) return;
    try {
      await creerEtiquette(etat.userId, {
        nom,
        couleur: PALETTE_ETIQUETTES[(etat.etiquettes || []).length % PALETTE_ETIQUETTES.length],
        ordre: (etat.etiquettes || []).length,
      });
      await etat.rafraichir();
    } catch (e) {
      signalerErreur(e, "Impossible de créer l'étiquette (nom déjà pris ?).");
    }
  });
  const barreAjout = el("div", "editeur-boutons");
  barreAjout.append(btnAjouter);
  carte.append(barreAjout);

  return carte;
}
