
(() => {
  "use strict";

  console.log("FIT TOGETHER: app.js avviato.");

  const client = window.fitTogetherSupabase;

  if (!client) {
    console.error("Client Supabase non trovato.");
    return;
  }

  function showMessage(title, message, color = "#d9f5e9") {
    const loginCard = document.getElementById("loginCard");
    const challengeCard = document.getElementById("challengeCard");

    if (!challengeCard) {
      console.error("challengeCard non trovato.");
      return;
    }

    if (loginCard) loginCard.classList.add("hidden");

    challengeCard.classList.remove("hidden");
    challengeCard.replaceChildren();

    const panel = document.createElement("div");
    panel.style.cssText =
      `background:${color};padding:25px;border-radius:18px;` +
      "margin-top:20px;color:#174b39;";

    const heading = document.createElement("h2");
    heading.textContent = title;

    const paragraph = document.createElement("p");
    paragraph.textContent = message;

    panel.append(heading, paragraph);
    challengeCard.appendChild(panel);
  }

  async function loadChallenge(user) {
    showMessage(
      "RICERCA DELLA SFIDA...",
      "Stiamo cercando la tua iscrizione."
    );

    console.log("Ricerca challenge per:", user.id);

    try {
      const { data: member, error } = await client
        .from("challenge_members")
        .select("id, challenge_id, display_name, weekly_plan, user_id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) throw error;

      if (!member) {
        showMessage(
          "NESSUNA SFIDA TROVATA",
          "Non abbiamo trovato il tuo utente nella tabella challenge_members.",
          "#ffe0e2"
        );
        console.log("Nessun membro trovato.");
        return;
      }

      console.log("Membro trovato:", member);

      const { data: challenge, error: challengeError } = await client
        .from("challenges")
        .select("*")
        .eq("id", member.challenge_id)
        .single();

      if (challengeError) throw challengeError;

      console.log("Challenge trovata:", challenge);

      const { data: members, error: membersError } = await client
        .from("challenge_members")
        .select("display_name, weekly_plan")
        .eq("challenge_id", member.challenge_id);

      if (membersError) throw membersError;

      showMessage(
        "SFIDA TROVATA! 🎉",
        `Benvenuto ${member.display_name}! La tua sfida è ${challenge.name || "FIT TOGETHER"}. Partecipanti: ${(members || []).map(item => item.display_name).join(" e ")}.`
      );

      console.log("Partecipanti:", members);

    } catch (error) {
      console.error("Errore caricamento challenge:", error);

      showMessage(
        "ERRORE NEL CARICAMENTO",
        error.message || "Errore sconosciuto.",
        "#ffe0e2"
      );
    }
  }

  client.auth.onAuthStateChange((event, session) => {
    if (session?.user) {
      setTimeout(() => loadChallenge(session.user), 0);
    }
  });

  client.auth.getSession().then(({ data, error }) => {
    if (error) {
      console.error(error);
      return;
    }

    if (data.session?.user) {
      loadChallenge(data.session.user);
    }
  });

})();
