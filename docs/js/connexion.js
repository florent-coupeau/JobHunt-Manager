/* Page connexion / inscription. */

import { supabase, verifierConfig } from "./supabase.js";

if (verifierConfig()) {
  // Déjà connecté ? Direction l'application.
  supabase.auth.getSession().then(({ data: { session } }) => {
    if (session) location.href = "index.html";
  });

  const formulaire = document.getElementById("form-auth");
  const champEmail = document.getElementById("champ-email");
  const champMdp = document.getElementById("champ-mdp");
  const message = document.getElementById("message-auth");
  const btnConnexion = document.getElementById("btn-connexion");
  const btnInscription = document.getElementById("btn-inscription");
  const btnOubli = document.getElementById("btn-oubli");

  let modeInscription = false;

  function afficherMessage(texte, type = "info") {
    message.textContent = texte;
    message.className = "message-auth " + type;
    message.hidden = !texte;
  }

  function basculerMode(inscription) {
    modeInscription = inscription;
    document.getElementById("titre-auth").textContent =
      inscription ? "Créer un compte" : "Se connecter";
    btnConnexion.textContent = inscription ? "✨ Créer mon compte" : "→ Se connecter";
    btnInscription.textContent = inscription
      ? "J'ai déjà un compte — me connecter"
      : "Pas encore de compte ? En créer un";
    afficherMessage("");
  }

  btnInscription.addEventListener("click", () => basculerMode(!modeInscription));

  formulaire.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const email = champEmail.value.trim();
    const password = champMdp.value;
    if (!email || !password) return;
    if (modeInscription && password.length < 8) {
      afficherMessage("Choisis un mot de passe d'au moins 8 caractères.", "erreur");
      return;
    }

    btnConnexion.disabled = true;
    afficherMessage(modeInscription ? "Création du compte…" : "Connexion…");

    const { data, error } = modeInscription
      ? await supabase.auth.signUp({ email, password })
      : await supabase.auth.signInWithPassword({ email, password });

    btnConnexion.disabled = false;

    if (error) {
      const traductions = {
        "Invalid login credentials": "Email ou mot de passe incorrect.",
        "User already registered": "Un compte existe déjà avec cet email — connecte-toi.",
        "Email not confirmed": "Confirme d'abord ton email : un lien t'a été envoyé par mail.",
      };
      afficherMessage(traductions[error.message] || "Erreur : " + error.message, "erreur");
      return;
    }

    if (modeInscription && !data.session) {
      // Confirmation d'email activée côté Supabase : pas de session tant que le lien n'est pas cliqué.
      afficherMessage("📬 Compte créé ! Ouvre le mail de confirmation qui vient de t'être envoyé, puis reviens te connecter.", "ok");
      basculerMode(false);
      return;
    }

    location.href = "index.html";
  });

  btnOubli.addEventListener("click", async () => {
    const email = champEmail.value.trim();
    if (!email) {
      afficherMessage("Écris d'abord ton email dans le champ ci-dessus, puis reclique.", "erreur");
      return;
    }
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: location.origin + location.pathname.replace("connexion.html", "index.html"),
    });
    afficherMessage(
      error ? "Erreur : " + error.message
            : "📬 Email envoyé ! Clique sur le lien qu'il contient pour choisir un nouveau mot de passe.",
      error ? "erreur" : "ok"
    );
  });
}
