
(() => {
  "use strict";

  console.log("FIT TOGETHER: app.js avviato correttamente.");

  const client = window.fitTogetherSupabase;

  if (!client) {
    console.error("ERRORE: client Supabase non trovato.");
    return;
  }

  console.log("FIT TOGETHER: Supabase collegato.");

  function showSuccess(user) {
    const loginCard = document.getElementById("loginCard");
    const challengeCard = document.getElementById("challengeCard");

    if (!challengeCard) {
      console.error("ERRORE: challengeCard non trovato.");
      return;
    }

    if (loginCard) {
      loginCard.classList.add("hidden");
    }

    challengeCard.classList.remove("hidden");
    challengeCard.replaceChildren();

    const panel = document.createElement("div");
    panel.style.cssText =
      "background:#d9f5e9;color:#126b4d;padding:30px;" +
      "border-radius:18px;text-align:center;margin-top:20px;";

    const title = document.createElement("h1");
    title.textContent = "ACCESSO RIUSCITO!";

    const message = document.createElement("p");
    message.textContent =
      "Supabase ha riconosciuto correttamente il tuo account.";

    const email = document.createElement("p");
    email.style.fontWeight = "bold";
    email.textContent = user.email || "Email non disponibile";

    const button = document.createElement("button");
    button.textContent = "Esci";
    button.style.cssText =
      "padding:12px 25px;border-radius:10px;cursor:pointer;";

    button.addEventListener("click", async () => {
      const { error } = await client.auth.signOut();

      if (error) {
        console.error("Errore logout:", error);
      }
    });

    panel.appendChild(title);
    panel.appendChild(message);
    panel.appendChild(email);
    panel.appendChild(button);

    challengeCard.appendChild(panel);

    console.log("FIT TOGETHER: schermata di successo visualizzata.");
  }

  client.auth.onAuthStateChange((event, session) => {
    console.log("Evento autenticazione:", event);

    if (session && session.user) {
      showSuccess(session.user);
    }
  });

  client.auth.getSession().then(({ data, error }) => {
    if (error) {
      console.error("Errore recupero sessione:", error);
      return;
    }

    if (data.session && data.session.user) {
      showSuccess(data.session.user);
    } else {
      console.log("FIT TOGETHER: nessun utente autenticato.");
    }
  });

})();
