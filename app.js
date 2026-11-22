
(() => {
  const client = window.fitTogetherSupabase;

  if (!client) {
    console.error("FIT TOGETHER: Supabase client non trovato.");
    return;
  }

  const styles = `
    .ft-dashboard { display:grid; gap:16px; }
    .ft-panel {
      background:var(--card); border:1px solid var(--border);
      border-radius:18px; padding:18px;
    }
    .ft-heading { margin:0 0 5px; font-size:23px; }
    .ft-subtitle { color:var(--muted); font-size:13px; }
    .ft-progress {
      height:9px; border-radius:20px; overflow:hidden;
      background:var(--border); margin:13px 0 7px;
    }
    .ft-progress-fill {
      height:100%; background:var(--accent); border-radius:20px;
      transition:width .2s;
    }
    .ft-slot {
      display:flex; align-items:center; gap:12px;
      padding:13px 0; border-bottom:1px solid var(--border);
    }
    .ft-slot:last-child { border-bottom:0; padding-bottom:0; }
    .ft-slot-icon {
      width:42px; height:42px; display:grid; place-items:center;
      background:var(--field); border-radius:12px; font-size:20px;
      flex-shrink:0;
    }
    .ft-slot-info { flex:1; min-width:0; }
    .ft-slot-title { font-weight:750; font-size:14px; }
    .ft-slot-detail { color:var(--muted); font-size:12px; margin-top:3px; }
    .ft-status {
      font-size:11px; font-weight:700; border-radius:20px;
      padding:6px 9px; white-space:nowrap;
      background:var(--field); color:var(--muted);
    }
    .ft-status.approved { color:#16845f; background:#d9f5e9; }
    .ft-status.pending { color:#9a6a0b; background:#fff0c7; }
    .ft-status.rejected { color:#b23b45; background:#ffe0e2; }
    .ft-member {
      display:flex; align-items:center; justify-content:space-between;
      gap:10px; padding:10px 0; border-bottom:1px solid var(--border);
    }
    .ft-member:last-child { border-bottom:0; }
    .ft-small { color:var(--muted); font-size:12px; }
    .ft-toolbar { display:flex; align-items:center; justify-content:space-between; gap:10px; }
    .ft-toolbar button {
      width:auto; margin:0; padding:9px 12px;
      font-size:12px; border:1px solid var(--border);
      background:transparent; color:var(--text);
    }
    .ft-error { color:#c34a50; font-size:13px; line-height:1.5; }
  `;

  if (!document.getElementById("ft-dashboard-styles")) {
    const style = document.createElement("style");
    style.id = "ft-dashboard-styles";
    style.textContent = styles;
    document.head.appendChild(style);
  }

  const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;",
    '"': "&quot;", "'": "&#039;"
  })[char]);

  function localDateString(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function getCurrentWeek() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const monday = new Date(today);
    monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    return {
      start: localDateString(monday),
      end: localDateString(sunday)
    };
  }

  function getPlanSlots(plan) {
    if (plan === "runner") {
      return [
        { id: "gym_1", title: "Palestra 1", description: "Prima sessione", icon: "🏋️" },
        { id: "gym_2", title: "Palestra 2", description: "Seconda sessione", icon: "🏋️" },
        { id: "run", title: "Corsa", description: "Sessione obbligatoria", icon: "🏃" }
      ];
    }

    return [
      { id: "gym_1", title: "Palestra 1", description: "Prima sessione", icon: "🏋️" },
      { id: "gym_2", title: "Palestra 2", description: "Seconda sessione", icon: "🏋️" },
      { id: "free_sport", title: "Sport libero", description: "La tua scelta", icon: "🚴" }
    ];
  }

  function statusLabel(status) {
    if (status === "approved") return "Approvato";
    if (status === "pending") return "In attesa";
    if (status === "rejected") return "Rifiutato";
    return "Da completare";
  }

  function renderSlot(slot, workouts) {
    const entry = workouts.find(item => item.session_slot === slot.id);
    const status = entry?.status || "empty";
    const detail = entry
      ? `${entry.activity_date} · ${entry.duration_minutes} min${entry.distance_km ? ` · ${entry.distance_km} km` : ""}`
      : slot.description;

    return `
      <div class="ft-slot">
        <div class="ft-slot-icon">${slot.icon}</div>
        <div class="ft-slot-info">
          <div class="ft-slot-title">${escapeHtml(slot.title)}</div>
          <div class="ft-slot-detail">${escapeHtml(detail)}</div>
        </div>
        <span class="ft-status ${status}">${statusLabel(status)}</span>
      </div>
    `;
  }

  async function loadDashboard(user) {
    const container = document.getElementById("challengeCard");
    if (!container || !user) return;

    container.innerHTML = `
      <div class="ft-panel" style="text-align:center;padding:32px">
        <div style="font-size:28px;margin-bottom:10px">💪</div>
        <strong>Caricamento FIT TOGETHER...</strong>
        <p class="ft-small">Stiamo recuperando i vostri progressi.</p>
      </div>
    `;
    container.classList.remove("hidden");

    try {
      const { data: ownMember, error: memberError } = await client
        .from("challenge_members")
        .select("id, challenge_id, display_name, weekly_plan")
        .eq("user_id", user.id)
        .order("joined_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (memberError) throw memberError;

      if (!ownMember) {
        container.innerHTML = `
          <div class="ft-panel">
            <h2>Nessuna challenge trovata</h2>
            <p class="ft-small">Non risulti ancora collegato a una challenge.</p>
            <button onclick="location.reload()">Torna all'accesso</button>
          </div>
        `;
        return;
      }

      const week = getCurrentWeek();

      const [membersResult, workoutsResult] = await Promise.all([
        client
          .from("challenge_members")
          .select("id, display_name, weekly_plan, user_id")
          .eq("challenge_id", ownMember.challenge_id)
          .order("joined_at", { ascending: true }),

        client
          .from("workout_entries")
          .select("id, member_id, session_slot, activity_type, activity_date, duration_minutes, distance_km, status, created_at")
          .eq("challenge_id", ownMember.challenge_id)
          .gte("activity_date", week.start)
          .lte("activity_date", week.end)
          .order("created_at", { ascending: false })
      ]);

      if (membersResult.error) throw membersResult.error;
      if (workoutsResult.error) throw workoutsResult.error;

      const members = membersResult.data || [];
      const workouts = workoutsResult.data || [];
      const ownSlots = getPlanSlots(ownMember.weekly_plan);

      const ownWorkouts = workouts.filter(item => item.member_id === ownMember.id);

      const activeOwnWorkouts = ownSlots.map(slot =>
        ownWorkouts.find(item =>
          item.session_slot === slot.id &&
          (item.status === "approved" || item.status === "pending")
        )
      );

      const approvedCount = activeOwnWorkouts.filter(
        item => item?.status === "approved"
      ).length;

      const progress = Math.round((approvedCount / 3) * 100);

      const partner = members.find(member => member.user_id !== user.id);
      const partnerSlots = partner ? getPlanSlots(partner.weekly_plan) : [];
      const partnerWorkouts = partner
        ? workouts.filter(item => item.member_id === partner.id)
        : [];

      const weekLabel = `${week.start.split("-").reverse().join("/")} – ${week.end.split("-").reverse().join("/")}`;

      const memberSummary = members.map(member => {
        const slots = getPlanSlots(member.weekly_plan);
        const memberEntries = workouts.filter(item => item.member_id === member.id);
        const count = slots.filter(slot =>
          memberEntries.some(item =>
            item.session_slot === slot.id && item.status === "approved"
          )
        ).length;

        return `
          <div class="ft-member">
            <div>
              <strong>${escapeHtml(member.display_name)}</strong>
              <div class="ft-small">${member.weekly_plan === "runner" ? "2 palestre + corsa" : "2 palestre + sport libero"}</div>
            </div>
            <strong>${count}/3</strong>
          </div>
        `;
      }).join("");

      container.innerHTML = `
        <div class="ft-dashboard">
          <div class="ft-toolbar">
            <div class="ft-small">FIT TOGETHER · LA TUA CHALLENGE</div>
            <button type="button" id="ftLogout">Esci</button>
          </div>

          <div class="ft-panel">
            <h1 class="ft-heading">Ciao, ${escapeHtml(ownMember.display_name)}! 👋</h1>
            <div class="ft-subtitle">La tua settimana · ${weekLabel}</div>
            <div class="ft-progress">
              <div class="ft-progress-fill" style="width:${progress}%"></div>
            </div>
            <strong>${approvedCount} di 3 allenamenti approvati</strong>
            <div class="ft-small" style="margin-top:5px">Solo gli allenamenti approvati contano per il tuo obiettivo.</div>
          </div>

          <div class="ft-panel">
            <h2 style="margin:0 0 5px">I tuoi obiettivi</h2>
            <div class="ft-subtitle">Completa tutte e tre le sessioni entro domenica.</div>
            ${ownSlots.map(slot => renderSlot(slot, ownWorkouts)).join("")}
          </div>

          <div class="ft-panel">
            <h2 style="margin:0 0 5px">La vostra sfida</h2>
            <div class="ft-subtitle">Progresso settimanale di entrambi</div>
            ${memberSummary || '<p class="ft-small">Nessun partecipante trovato.</p>'}
          </div>

          <div class="ft-panel">
            <h2 style="margin:0 0 5px">Prossime funzionalità</h2>
            <div class="ft-slot">
              <div class="ft-slot-icon">📸</div>
              <div class="ft-slot-info">
                <div class="ft-slot-title">Caricamento allenamento</div>
                <div class="ft-slot-detail">Registra attività e prova fotografica</div>
              </div>
            </div>
            <div class="ft-slot">
              <div class="ft-slot-icon">🤝</div>
              <div class="ft-slot-info">
                <div class="ft-slot-title">Approvazione partner</div>
                <div class="ft-slot-detail">Controlla e approva le sessioni</div>
              </div>
            </div>
            <div class="ft-slot">
              <div class="ft-slot-icon">⚖️</div>
              <div class="ft-slot-info">
                <div class="ft-slot-title">Pesate e statistiche</div>
                <div class="ft-slot-detail">Segui i progressi nel tempo</div>
              </div>
            </div>
          </div>
        </div>
      `;

      document.getElementById("ftLogout").addEventListener("click", async () => {
        await client.auth.signOut();
        location.reload();
      });

    } catch (error) {
      console.error("FIT TOGETHER dashboard error:", error);
      container.innerHTML = `
        <div class="ft-panel">
          <h2>Non riusciamo a caricare la dashboard</h2>
          <p class="ft-error">${escapeHtml(error.message || "Errore sconosciuto")}</p>
          <button type="button" onclick="location.reload()">Riprova</button>
        </div>
      `;
    }
  }

  client.auth.onAuthStateChange((event, session) => {
    if (session?.user) {
      setTimeout(() => loadDashboard(session.user), 0);
    }
  });

  client.auth.getSession().then(({ data, error }) => {
    if (!error && data.session?.user) {
      loadDashboard(data.session.user);
    }
  });
})();
