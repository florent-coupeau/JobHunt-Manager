/* Onglet Mon CV : formulaire du CV maître (exhaustif), source de la génération
   de CV ciblés par offre (voir cv.js et le bouton 🎯 CV de l'onglet Offres). */

import { el, boutonMini, signalerErreur } from "../ui.js";
import { CV_VIDE, extraireCVDepuisTexte, convertirDocxEnHTML } from "../cv.js";
import { sauverMasterCV, creerStyleCV, supprimerStyleCV } from "../donnees.js";
import { iaConfiguree } from "../ia.js";

let brouillon = null; // copie de travail, enregistrée seulement au clic sur 💾

export function afficherCV(etat) {
  brouillon = structuredClone({ ...CV_VIDE, ...(etat.masterCV?.contenu || {}) });
  rendre(etat);
}

function rendre(etat) {
  const cont = document.getElementById("zone-cv");
  cont.innerHTML = "";

  cont.append(el("p", "aide-fiches",
    "Renseigne ici TOUT ton parcours, une bonne fois pour toutes. Sur chaque offre (onglet 📋 Offres), " +
    "le bouton 🎯 CV en génère une version ciblée : ton IA sélectionne et reformule ce qui est pertinent — " +
    "elle n'invente jamais une expérience, un diplôme ou une compétence absente d'ici."));

  cont.append(carteRemplissageIA(etat));
  cont.append(carteStylesPerso(etat));

  // --- Identité ---
  const carteId = el("div", "card");
  carteId.append(el("h2", null, "🪪 Identité"));
  const grille = el("div", "form-ajout");
  grille.append(
    champTexte("Nom complet *", brouillon.identite.nom, (v) => { brouillon.identite.nom = v; }),
    champTexte("Titre recherché (ex. Développeur web en alternance)", brouillon.identite.titre_recherche, (v) => { brouillon.identite.titre_recherche = v; }),
    champTexte("Email", brouillon.identite.email, (v) => { brouillon.identite.email = v; }),
    champTexte("Téléphone", brouillon.identite.telephone, (v) => { brouillon.identite.telephone = v; }),
    champTexte("Ville", brouillon.identite.ville, (v) => { brouillon.identite.ville = v; }),
    champTexte("Lien LinkedIn", brouillon.identite.linkedin, (v) => { brouillon.identite.linkedin = v; }),
    champTexte("Portfolio / site personnel", brouillon.identite.portfolio, (v) => { brouillon.identite.portfolio = v; })
  );
  carteId.append(grille);
  carteId.append(libelle("Accroche (2-3 phrases qui te présentent)"));
  const accroche = document.createElement("textarea");
  accroche.className = "editeur-notes";
  accroche.rows = 3;
  accroche.value = brouillon.accroche || "";
  accroche.addEventListener("input", () => { brouillon.accroche = accroche.value; });
  carteId.append(accroche);
  cont.append(carteId);

  // --- Expériences ---
  const carteExp = el("div", "card");
  carteExp.append(el("h2", null, "💼 Expériences"));
  brouillon.experiences.forEach((x, i) => {
    const bloc = el("div", "bloc-domaine");
    bloc.append(entete(`Expérience ${i + 1}`, () => { brouillon.experiences.splice(i, 1); rendre(etat); }));
    const g = el("div", "form-ajout");
    g.append(
      champTexte("Poste", x.poste, (v) => { x.poste = v; }),
      champTexte("Entreprise", x.entreprise, (v) => { x.entreprise = v; }),
      champTexte("Lieu", x.lieu, (v) => { x.lieu = v; }),
      champTexte("Début (ex. 2024)", x.debut, (v) => { x.debut = v; }),
      champTexte("Fin (vide = en cours)", x.fin, (v) => { x.fin = v; })
    );
    bloc.append(g);
    bloc.append(libelle("Réalisations (une par ligne)"));
    bloc.append(champListe(x.bullets, (v) => { x.bullets = v; }));
    carteExp.append(bloc);
  });
  carteExp.append(boutonMini("➕ Ajouter une expérience", "Ajouter une expérience", () => {
    brouillon.experiences.push({ poste: "", entreprise: "", lieu: "", debut: "", fin: "", bullets: [] });
    rendre(etat);
  }));
  cont.append(carteExp);

  // --- Formations ---
  const carteForm = el("div", "card");
  carteForm.append(el("h2", null, "🎓 Formations"));
  brouillon.formations.forEach((x, i) => {
    const bloc = el("div", "bloc-domaine");
    bloc.append(entete(`Formation ${i + 1}`, () => { brouillon.formations.splice(i, 1); rendre(etat); }));
    const g = el("div", "form-ajout");
    g.append(
      champTexte("Diplôme", x.diplome, (v) => { x.diplome = v; }),
      champTexte("Établissement", x.etablissement, (v) => { x.etablissement = v; }),
      champTexte("Lieu", x.lieu, (v) => { x.lieu = v; }),
      champTexte("Début", x.debut, (v) => { x.debut = v; }),
      champTexte("Fin (vide = en cours)", x.fin, (v) => { x.fin = v; })
    );
    bloc.append(g);
    bloc.append(libelle("Détails (mentions, options…)"));
    const details = document.createElement("textarea");
    details.className = "editeur-notes";
    details.rows = 2;
    details.value = x.details || "";
    details.addEventListener("input", () => { x.details = details.value; });
    bloc.append(details);
    carteForm.append(bloc);
  });
  carteForm.append(boutonMini("➕ Ajouter une formation", "Ajouter une formation", () => {
    brouillon.formations.push({ diplome: "", etablissement: "", lieu: "", debut: "", fin: "", details: "" });
    rendre(etat);
  }));
  cont.append(carteForm);

  // --- Compétences ---
  const carteComp = el("div", "card");
  carteComp.append(el("h2", null, "🛠️ Compétences"));
  carteComp.append(el("p", "aide-fiches", "Groupées par catégorie (ex. « Langages », « Outils », « Soft skills »)."));
  brouillon.competences.forEach((c, i) => {
    const bloc = el("div", "bloc-domaine");
    bloc.append(entete(`Catégorie ${i + 1}`, () => { brouillon.competences.splice(i, 1); rendre(etat); }));
    bloc.append(champTexte("Nom de la catégorie", c.categorie, (v) => { c.categorie = v; }));
    bloc.append(libelle("Compétences (une par ligne)"));
    bloc.append(champListe(c.items, (v) => { c.items = v; }));
    carteComp.append(bloc);
  });
  carteComp.append(boutonMini("➕ Ajouter une catégorie", "Ajouter une catégorie de compétences", () => {
    brouillon.competences.push({ categorie: "", items: [] });
    rendre(etat);
  }));
  cont.append(carteComp);

  // --- Projets ---
  const carteProj = el("div", "card");
  carteProj.append(el("h2", null, "🚀 Projets"));
  brouillon.projets.forEach((x, i) => {
    const bloc = el("div", "bloc-domaine");
    bloc.append(entete(`Projet ${i + 1}`, () => { brouillon.projets.splice(i, 1); rendre(etat); }));
    const g = el("div", "form-ajout");
    g.append(
      champTexte("Nom du projet", x.nom, (v) => { x.nom = v; }),
      champTexte("Lien (facultatif)", x.lien, (v) => { x.lien = v; })
    );
    bloc.append(g);
    bloc.append(libelle("Description courte"));
    const desc = document.createElement("textarea");
    desc.className = "editeur-notes";
    desc.rows = 2;
    desc.value = x.description || "";
    desc.addEventListener("input", () => { x.description = desc.value; });
    bloc.append(desc);
    bloc.append(libelle("Points clés (un par ligne)"));
    bloc.append(champListe(x.bullets, (v) => { x.bullets = v; }));
    carteProj.append(bloc);
  });
  carteProj.append(boutonMini("➕ Ajouter un projet", "Ajouter un projet", () => {
    brouillon.projets.push({ nom: "", description: "", bullets: [], lien: "" });
    rendre(etat);
  }));
  cont.append(carteProj);

  // --- Langues, certifications, intérêts ---
  const carteDivers = el("div", "card");
  carteDivers.append(el("h2", null, "🌍 Langues, certifications, centres d'intérêt"));
  brouillon.langues.forEach((l, i) => {
    const ligne = el("div", "ligne-etiquette");
    ligne.append(champTexte("Langue", l.langue, (v) => { l.langue = v; }));
    ligne.append(champTexte("Niveau (ex. Courant, B2…)", l.niveau, (v) => { l.niveau = v; }));
    ligne.append(boutonMini("🗑️", "Supprimer cette langue", () => { brouillon.langues.splice(i, 1); rendre(etat); }));
    carteDivers.append(ligne);
  });
  carteDivers.append(boutonMini("➕ Ajouter une langue", "Ajouter une langue", () => {
    brouillon.langues.push({ langue: "", niveau: "" });
    rendre(etat);
  }));
  carteDivers.append(libelle("Certifications (une par ligne)"));
  carteDivers.append(champListe(brouillon.certifications, (v) => { brouillon.certifications = v; }));
  carteDivers.append(libelle("Centres d'intérêt (un par ligne)"));
  carteDivers.append(champListe(brouillon.interets, (v) => { brouillon.interets = v; }));
  cont.append(carteDivers);

  // --- Enregistrer ---
  const barre = el("div", "barre-enregistrer");
  const btn = el("button", "btn-principal", "💾 Enregistrer mon CV");
  btn.addEventListener("click", async () => {
    if (!brouillon.identite.nom.trim()) {
      signalerErreur(new Error("Le nom complet est nécessaire."), "CV incomplet");
      return;
    }
    try {
      await sauverMasterCV(etat.userId, brouillon);
      await etat.rafraichir();
    } catch (e) {
      signalerErreur(e, "Impossible d'enregistrer ton CV.");
    }
  });
  barre.append(btn);
  cont.append(barre);
}

/* ---------- Remplissage automatique par IA (texte d'un CV existant collé) ---------- */

function carteRemplissageIA(etat) {
  const carte = el("div", "card");
  carte.append(el("h2", null, "✨ Remplir automatiquement"));
  carte.append(el("p", "aide-fiches",
    "Colle ci-dessous le texte de ton CV existant (copié depuis un Word, un PDF, ou ton profil LinkedIn) — " +
    "ton IA remplit le formulaire pour toi. Si des informations sont déjà saisies, elles sont conservées " +
    "et complétées (pas remplacées) — tu peux coller plusieurs sources à la suite pour tout regrouper. " +
    "Relis et corrige ensuite avant d'enregistrer."));

  const champ = document.createElement("textarea");
  champ.className = "editeur-notes";
  champ.rows = 5;
  champ.placeholder = "Colle ici le texte complet de ton CV…";
  carte.append(champ);

  const message = el("p", "message-auth");
  message.hidden = true;
  carte.append(message);

  const barre = el("div", "editeur-boutons");
  const bouton = el("button", "btn-mini btn-ok", "✨ Analyser et remplir");
  barre.append(bouton);
  carte.append(barre);

  bouton.addEventListener("click", async () => {
    if (!iaConfiguree(etat)) {
      afficherMessageIA(message, "Configure d'abord ton IA dans l'onglet ⚙️ Paramètres (clé gratuite en 1 minute).", false);
      return;
    }
    const texte = champ.value.trim();
    if (texte.length < 60) {
      afficherMessageIA(message, "Colle le texte complet de ton CV (au moins quelques phrases).", false);
      return;
    }
    bouton.disabled = true;
    afficherMessageIA(message, "⏳ Lecture de ton CV en cours…", true);
    try {
      brouillon = await extraireCVDepuisTexte(etat, texte, brouillon);
      rendre(etat);
    } catch (e) {
      bouton.disabled = false;
      afficherMessageIA(message, "❌ " + (e.message || "L'analyse a échoué — réessaie."), false);
    }
  });

  return carte;
}

function afficherMessageIA(zone, texte, ok) {
  zone.textContent = texte;
  zone.className = "message-auth " + (ok ? "ok" : "erreur");
  zone.hidden = false;
}

/* ---------- Styles de CV personnalisés (import d'un .docx existant) ---------- */

function carteStylesPerso(etat) {
  const carte = el("div", "card");
  carte.append(el("h2", null, "🎨 Mes styles de CV personnalisés"));
  carte.append(el("p", "aide-fiches",
    "Tu as déjà un CV Word avec une mise en forme qui te plaît ? Importe-le : il devient un style " +
    "disponible dans le sélecteur de style, en plus de Classique/Moderne/Minimaliste. La structure " +
    "(titres, gras, listes) est reprise au mieux — une mise en page très complexe (colonnes, tableaux) " +
    "peut être simplifiée."));

  for (const style of etat.stylesCV || []) {
    const ligne = el("div", "ligne-etiquette");
    ligne.append(el("span", null, style.nom));
    ligne.append(boutonMini("🗑️", "Supprimer ce style", async () => {
      if (!confirm(`Supprimer le style « ${style.nom} » ?`)) return;
      try {
        await supprimerStyleCV(style.id);
        await etat.rafraichir();
      } catch (e) {
        signalerErreur(e, "Impossible de supprimer ce style.");
      }
    }));
    carte.append(ligne);
  }
  if (!(etat.stylesCV || []).length) {
    carte.append(el("p", "vide", "Aucun style personnalisé pour l'instant."));
  }

  const champNom = document.createElement("input");
  champNom.type = "text";
  champNom.className = "champ-critere";
  champNom.placeholder = "Nom du style (ex. Mon CV pro)";
  const champFichier = document.createElement("input");
  champFichier.type = "file";
  champFichier.accept = ".docx";

  const message = el("p", "message-auth");
  message.hidden = true;

  const barre = el("div", "editeur-boutons");
  const bouton = el("button", "btn-mini btn-ok", "✨ Créer ce style");
  barre.append(bouton);

  bouton.addEventListener("click", async () => {
    const nom = champNom.value.trim();
    const fichier = champFichier.files[0];
    if (!nom) {
      afficherMessageIA(message, "Donne un nom à ce style.", false);
      return;
    }
    if (!fichier) {
      afficherMessageIA(message, "Choisis d'abord un fichier .docx.", false);
      return;
    }
    bouton.disabled = true;
    afficherMessageIA(message, "⏳ Lecture du document…", true);
    try {
      const gabaritHtml = await convertirDocxEnHTML(fichier);
      await creerStyleCV(etat.userId, nom, gabaritHtml);
      await etat.rafraichir();
    } catch (e) {
      bouton.disabled = false;
      afficherMessageIA(message, "❌ " + (e.message || "La création du style a échoué."), false);
    }
  });

  carte.append(champNom, champFichier, message, barre);
  return carte;
}

/* ---------- Petits champs (mêmes conventions que vues/criteres.js) ---------- */

function libelle(texte) {
  return el("div", "libelle-champ", texte);
}

function champTexte(placeholder, valeur, maj) {
  const input = document.createElement("input");
  input.type = "text";
  input.className = "champ-critere";
  input.placeholder = placeholder;
  input.value = valeur || "";
  input.addEventListener("input", () => maj(input.value));
  return input;
}

function champListe(valeurs, maj) {
  const ta = document.createElement("textarea");
  ta.className = "editeur-notes";
  ta.rows = Math.max(2, (valeurs || []).length + 1);
  ta.value = (valeurs || []).join("\n");
  ta.addEventListener("input", () => maj(ta.value.split("\n").map((l) => l.trim()).filter(Boolean)));
  return ta;
}

function entete(titre, supprimer) {
  const ligne = el("div", "entete-ent");
  ligne.append(el("strong", null, titre));
  ligne.append(boutonMini("🗑️", "Supprimer", supprimer));
  return ligne;
}
