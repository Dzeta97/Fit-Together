
(() => {
  const client = window.fitTogetherSupabase;
  const BUCKET = "fit-together-proofs";
  const MAX_FILE_SIZE = 10 * 1024 * 1024;

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
      height:100%; background:var(--accent);
      border-radius:20px; transition:width .2s;
    }
    .ft-slot {
      display:flex; align-items:center; gap:12px;
      padding:13px 0; border-bottom:1px solid var(--border);
    }
    .ft-slot:last-child { border-bottom:0; padding-bottom:0; }
    .ft-slot-icon {
      width:42px; height:42px; display:grid; place-items:center;
      background:var(--field); border-radius:12px;
      font-size:20px; flex-shrink:0;
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
    .ft-toolbar {
      display:flex; align-items:center;
      justify-content:space-between; gap:10px;
    }
    .ft-toolbar button {
      width:auto; margin:0; padding:9px 12px;
      font-size:12px; border:1px solid var(--border);
      background:transparent; color:var(--text);
    }
    .ft-error { color:#c34a50; font-size:13px; line-height:1.5; }

    .ft-form { display:grid; gap:13px; margin-top:16px; }
    .ft-form label { display:grid; gap:6px; }
    .ft-form input, .ft-form select, .ft-form textarea {
      width:100%; box-sizing:border-box;
      padding:12px; border:1px solid var(--border);
      border-radius:10px; background:var(--field);
      color:var(--text); font:inherit; font-size:14px;
    }
    .ft-form button { width:100%; }
    .ft-form button:disabled { opacity:.55; cursor:not-allowed; }
    .ft-message { font-size:13px; line-height:1.5; }
    .ft-message.error { color:#c34a50; }
    .ft-message.success { color:#16845f; }
  `;

  if (!document.getElementById("ft-dashboard-styles")) {
    const style = document.createElement("style");
    style.id = "ft-dashboard-styles";
    style.textContent = styles;
    document.head.appendChild(style);
  }

  const escapeHtml = (value) =>
    String(value ?? "").replace(/[&<>"']/g, char => ({
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
      end: localDateString(sunday),
      today: localDateString(today)
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

  function activityOptions(slotId) {
    if (slotId === "gym_1" || slotId === "gym_2") {
      return [{ value: "gym", label: "Palestra" }];
    }

    if (slotId === "run") {
      return [{ value: "run", label: "Corsa" }];
    }

    return [
      { value: "trekking", label: "Trekking" },
      { value: "cycling", label: "Ciclismo" },
      { value: "skiing", label: "Sci" },
      { value: "gym", label: "Palestra" },
      { value: "other", label: "Altro sport" }
    ];
  }

  function updateActivityOptions() {
    const slot = document.getElementById("ftSessionSlot");
    const activity = document.getElementById("ftActivityType");

    if (!slot || !activity) return;

    activity.innerHTML = activityOptions(slot.value)
      .map(item => `<option value="${item.value}">${item.label}</option>`)
      .join("");
  }

  async function submitWorkout(event, member) {
    event.preventDefault();

    const form = event.currentTarget;
    const button = document.getElementById("ftSubmitWorkout");
    const message = document.getElementById("ftWorkoutMessage");

    if (!form || !button || !message) return;

    const slot = document.getElementById("ftSessionSlot").value;
    const activity = document.getElementById("ftActivityType").value;
    const date = document.getElementById("ftActivityDate").value;
    const duration = Number(document.getElementById("ftDuration").value);
    const distanceValue = document.getElementById("ftDistance").value;
    const notes = document.getElementById("ftNotes").value.trim();
    const file = document.getElementById("ftProof").files[0];

    const week = getCurrentWeek();

    if (!date || date < week.start || date > week.today) {
      message.textContent = "Seleziona una data compresa nella settimana corrente e non futura.";
      message.className = "ft-message error";
      return;
    }

    if (!Number.isInteger(duration) || duration < 1 || duration > 1440) {
      message.textContent = "Inserisci una durata valida in minuti.";
      message.className = "ft-message error";
      return;
    }

    const distance = distanceValue === "" ? null : Number(distanceValue);

    if (distance !== null && (!Number.isFinite(distance) || distance < 0)) {
      message.textContent = "Inserisci una distanza valida.";
      message.className = "ft-message error";
      return;
    }

    if (!file) {
      message.textContent = "Devi caricare una foto di prova.";
      message.className = "ft-message error";
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      message.textContent = "La foto supera il limite massimo di 10 MB.";
      message.className = "ft-message error";
      return;
    }

    const allowedTypes = [
      "image/jpeg", "image/png", "image/webp", "image/heic"
    ];

    if (!allowedTypes.includes(file.type)) {
      message.textContent = "Formato non supportato. Usa JPEG, PNG, WEBP o HEIC.";
      message.className = "ft-message error";
      return;
    }

    button.disabled = true;
    button.textContent = "Invio in corso...";
    message.textContent = "Caricamento della foto e registrazione dell'allenamento...";
    message.className = "ft-message";

    let uploadedPath = null;

    try {
      const originalExtension = file.name.split(".").pop().toLowerCase();
      const safeExtension = /^[a-z0-9]+$/.test(originalExtension)
        ? originalExtension
        : "jpg";

      const fileName = `${crypto.randomUUID()}.${safeExtension}`;

      uploadedPath = `${member.challenge_id}/${member.id}/${fileName}`;

      const { error: uploadError } = await client.storage
        .from(BUCKET)
        .upload(uploadedPath, file, {
          cacheControl: "3600",
          upsert: false,
          contentType: file.type
        });

      if (uploadError) throw uploadError;

      const { error: insertError } = await client
        .from("workout_entries")
        .insert({
          challenge_id: member.challenge_id,
          member_id: member.id,
          session_slot: slot,
          activity_type: activity,
          activity_date: date,
          duration_minutes: duration,
          distance_km: distance,
          notes: notes || null,
          proof_path: uploadedPath
        });

      if (insertError) throw insertError;

      message.textContent = "Allenamento inviato! Ora è in attesa di approvazione del partner.";
      message.className = "ft-message success";

      form.reset();
      updateActivityOptions();

      await loadDashboard(member.user);

    } catch (error) {
      console.error("FIT TOGETHER workout error:", error);

      if (uploadedPath) {
        const { error: cleanupError } = await client.storage
          .from(BUCKET)
          .remove([uploadedPath]);

        if (cleanupError) {
          console.error("Errore durante la pulizia della foto:", cleanupError);
        }
      }

      message.textContent = error.message || "Non è stato possibile inviare l'allenamento.";
      message.className = "ft-message error";

    } finally {
      button.disabled = false;
      button.textContent = "Invia allenamento";
    }
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
        .select("id, challenge_id, display_name, weekly_plan, user_id")
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

      ownMember.user = user;

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

      const weekLabel =
        `${week.start.split("-").reverse().join("/")} – ${week.end.split("-").reverse().join("/")}`;

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
            <div class="ft-small" style="margin-top:5px">
              Solo gli allenamenti approvati contano per il tuo obiettivo.
            </div>
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
            <h2 style="margin:0 0 5px">Registra un allenamento 💪</h2>
            <div class="ft-subtitle">
              Inserisci la tua sessione e carica una prova fotografica.
            </div>

            <form id="ftWorkoutForm" class="ft-form">

              <label>
                <span class="ft-small">Sessione settimanale</span>
                <select id="ftSessionSlot" required>
                  ${ownSlots.map(slot =>
                    `<option value="${slot.id}">${escapeHtml(slot.title)}</option>`
                  ).join("")}
                </select>
              </label>

              <label>
                <span class="ft-small">Tipo di attività</span>
                <select id="ftActivityType" required></select>
              </label>

              <label>
                <span class="ft-small">Data dell'attività</span>
                <input id="ftActivityDate" type="date"
                  min="${week.start}" max="${week.today}" value="${week.today}" required>
              </label>

              <label>
                <span class="ft-small">Durata (minuti)</span>
                <input id="ftDuration" type="number" min="1" max="1440"
                  required placeholder="Es. 60">
              </label>

              <label>
                <span class="ft-small">Distanza (km) – facoltativa</span>
                <input id="ftDistance" type="number" min="0" step="0.01"
                  placeholder="Es. 5.5">
              </label>

              <label>
                <span class="ft-small">Note – facoltative</span>
                <textarea id="ftNotes" rows="3" maxlength="1000"
                  placeholder="Aggiungi qualche dettaglio..."></textarea>
              </label>

              <label>
                <span class="ft-small">Foto di prova (max 10 MB)</span>
                <input id="ftProof" type="file"
                  accept="image/jpeg,image/png,image/webp,image/heic" required>
              </label>

              <button type="submit" id="ftSubmitWorkout">
                Invia allenamento
              </button>

              <div id="ftWorkoutMessage" class="ft-message" aria-live="polite"></div>
            </form>
          </div>
        </div>
      `;

      updateActivityOptions();

      document.getElementById("ftSessionSlot")
        .addEventListener("change", updateActivityOptions);

      document.getElementById("ftWorkoutForm")
        .addEventListener("submit", event => submitWorkout(event, ownMember));

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

