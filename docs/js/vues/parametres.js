/* Onglet Paramètres : connexion de l'IA de l'utilisateur (fournisseur + clé). */

import { el, signalerErreur } from "../ui.js";
import { FOURNISSEURS, cleIA, definirCleIA, fournisseurActuel, definirFournisseur, testerCle } from "../ia.js";

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

  cont.append(carte);

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
