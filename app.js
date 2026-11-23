
(() => {
  "use strict";

  const client = window.fitTogetherSupabase;

  if (!client) {
    console.error("FIT TOGETHER: Supabase client non trovato.");
    return;
  }

  const challengeCard = document.getElementById("challengeCard");
  const loginCard = document.getElementById("loginCard");

  if (!challengeCard) {
    console.error("FIT TOGETHER: challengeCard non trovato.");
    return;
  }

  let loading = false;

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[char]);
  }

  function getWeekRange() {
    const now = new Date();
    const monday = new Date(now);
    const day = (now.getDay() + 6) % 7;

    monday.setDate(now.getDate() - day);
    monday.setHours(0, 0, 0, 0);

    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    const toDateString = date => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const dayNumber = String(date.getDate()).padStart(2, "0");
      return `${year}-${month}-${dayNumber}`;
    };

    return {
      start: toDateString(monday),
      end: toDateString(sunday)
    };
  }

  function showMessage(title, message, isError = false) {
    if (loginCard) loginCard.classList.add("hidden");
    challengeCard.classList.remove("hidden");

    challengeCard.innerHTML = `
      <div style="
        padding:25px;
        border-radius:18px;
        background:${isError ? "#ffe0e2" : "#e0f5eb"};
        color:#174b39;
        margin-top:20px;
      ">
        <h2>${escapeHtml(title)}</h2>
        <p>${escapeHtml(message)}</p>
      </div>
    `;
  }

  function renderDashboard(challenge, members, workouts, ownMember, week) {
    const workoutCounts = {};

    members.forEach(member => {
      workoutCounts[member.id] = workouts.filter(workout =>
        workout.member_id === member.id &&
        workout.status === "approved" &&
        workout.activity_date >= week.start &&
        workout.activity_date <= week.end
      ).length;
    });

    const memberCards = members.map(member => {
      const count = workoutCounts[member.id] || 0;
      const progress = Math.min(count, 3);
      const percentage = (progress / 3) * 100;

      const plan = member.weekly_plan === "runner"
        ? "2 palestre + corsa"
        : "2 palestre + sport libero";

      const isYou = member.id === ownMember.id;

      return `
        <div style="
          background:var(--card-bg, #ffffff);
          border:1px solid var(--border-color, #e1e5eb);
          border-radius:16px;
          padding:20px;
        ">
          <div style="
            display:flex;
            justify-content:space-between;
            align-items:center;
            gap:10px;
          ">
            <h3 style="margin:0;font-size:20px;">
              ${escapeHtml(member.display_name)}
            </h3>
            <span style="
              font-size:12px;
              color:#168b68;
              font-weight:700;
            ">${isYou ? "TU" : "PARTNER"}</span>
          </div>

          <p style="color:var(--text-muted, #718096);margin:8px 0 18px;">
            ${escapeHtml(plan)}
          </p>

          <div style="
            display:flex;
            justify-content:space-between;
            align-items:center;
            margin-bottom:9px;
          ">
            <strong>Progresso settimanale</strong>
            <strong style="font-size:20px;">${count}/3</strong>
          </div>

          <div style="
            height:10px;
            background:#e8edf0;
            border-radius:20px;
            overflow:hidden;
          ">
            <div style="
              width:${percentage}%;
              height:100%;
              background:#30b58b;
              border-radius:20px;
              transition:width .3s ease;
            "></div>
          </div>

          <p style="
            margin:12px 0 0;
            font-size:13px;
            color:var(--text-muted, #718096);
          ">
            ${count >= 3 ? "Obiettivo settimanale raggiunto!" : `Ancora ${3 - count} allenamenti da completare`}
          </p>
        </div>
      `;
    }).join("");

    challengeCard.innerHTML = `
      <div style="display:grid;gap:20px;padding:10px 0;">

        <div style="
          display:flex;
          justify-content:space-between;
          align-items:center;
          gap:12px;
          flex-wrap:wrap;
        ">
          <div>
            <p style="
              margin:0 0 5px;
              color:var(--text-muted, #718096);
              font-size:13px;
            ">LA VOSTRA SFIDA</p>

            <h2 style="margin:0;font-size:25px;">
              ${escapeHtml(challenge.name || "FIT TOGETHER")}
            </h2>
          </div>

          <button id="logoutButton" type="button" style="
            border:1px solid #d5dbe2;
            background:transparent;
            padding:10px 16px;
            border-radius:10px;
            cursor:pointer;
          ">Esci</button>
        </div>

        <div style="
          background:var(--card-bg, #ffffff);
          border:1px solid var(--border-color, #e1e5eb);
          border-radius:16px;
          padding:20px;
        ">
          <h3 style="margin:0 0 8px;">La vostra settimana</h3>
          <p style="
            margin:0;
            color:var(--text-muted, #718096);
          ">
            ${week.start} – ${week.end}
          </p>
          <p style="margin:12px 0 0;">
            Ogni partecipante deve completare 3 allenamenti approvati.
          </p>
        </div>

        <div style="display:grid;gap:14px;">
          ${memberCards}
        </div>

        <div style="
          background:var(--card-bg, #ffffff);
          border:1px solid var(--border-color, #e1e5eb);
          border-radius:16px;
          padding:20px;
        ">
          <h3 style="margin:0 0 8px;">Prossime funzionalità</h3>
          <p style="
            margin:0;
            color:var(--text-muted, #718096);
          ">
            Qui aggiungeremo la registrazione degli allenamenti,
            il caricamento delle prove fotografiche e
            l'approvazione da parte del partner.
          </p>
        </div>

      </div>
    `;

    document.getElementById("logoutButton").addEventListener("click", async () => {
      const { error } = await client.auth.signOut();

      if (error) {
        alert("Errore durante la disconnessione: " + error.message);
        return;
      }

      window.location.reload();
    });
  }

  async function loadDashboard(user) {
    if (loading) return;
    loading = true;

    showMessage("CARICAMENTO...", "Stiamo preparando la vostra dashboard.");

    try {
      const { data: ownMember, error: memberError } = await client
        .from("challenge_members")
        .select("id, challenge_id, display_name, weekly_plan, user_id, joined_at")
        .eq("user_id", user.id)
        .order("joined_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (memberError) throw memberError;

      if (!ownMember) {
        showMessage(
          "NESSUNA SFIDA TROVATA",
          "Non abbiamo trovato la tua iscrizione alla sfida.",
          true
        );
        return;
      }

      const { data: challenge, error: challengeError } = await client
        .from("challenges")
        .select("*")
        .eq("id", ownMember.challenge_id)
        .single();

      if (challengeError) throw challengeError;

      const { data: members, error: membersError } = await client
        .from("challenge_members")
        .select("id, display_name, weekly_plan, user_id")
        .eq("challenge_id", ownMember.challenge_id)
        .order("joined_at", { ascending: true });

      if (membersError) throw membersError;

      const week = getWeekRange();

      const { data: workouts, error: workoutsError } = await client
        .from("workout_entries")
        .select("id, member_id, activity_date, status")
        .eq("challenge_id", ownMember.challenge_id);

      if (workoutsError) throw workoutsError;

      renderDashboard(
        challenge,
        members || [],
        workouts || [],
        ownMember,
        week
      );

      console.log("FIT TOGETHER: dashboard caricata.");
      console.log("Partecipanti:", members);
      console.log("Allenamenti:", workouts);

    } catch (error) {
      console.error("FIT TOGETHER dashboard error:", error);

      showMessage(
        "ERRORE NEL CARICAMENTO",
        error.message || "Si è verificato un errore.",
        true
      );
    } finally {
      loading = false;
    }
  }

  client.auth.onAuthStateChange((event, session) => {
    if (session?.user) {
      setTimeout(() => loadDashboard(session.user), 0);
    }
  });

  client.auth.getSession().then(({ data, error }) => {
    if (error) {
      console.error(error);
      return;
    }

    if (data.session?.user) {
      loadDashboard(data.session.user);
    }
  });

})();
