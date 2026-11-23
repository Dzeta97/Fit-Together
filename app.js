```javascript
(() => {
  const client = window.fitTogetherSupabase;
  const BUCKET = "fit-together-proofs";
  const MAX_FILE_SIZE = 10 * 1024 * 1024;
  let notificationRefreshTimer = null;

  if (!client) {
    console.error("FIT TOGETHER: Supabase client non trovato.");
    return;
  }

  const styles = `
    .ft-dashboard { display:grid; gap:16px; }

    .ft-panel {
      background:var(--card);
      border:1px solid var(--border);
      border-radius:18px;
      padding:18px;
    }

    .ft-heading {
      margin:0 0 5px;
      font-size:23px;
    }

    .ft-subtitle {
      color:var(--muted);
      font-size:13px;
    }

    .ft-progress {
      height:9px;
      border-radius:20px;
      overflow:hidden;
      background:var(--border);
      margin:13px 0 7px;
    }

    .ft-progress-fill {
      height:100%;
      background:var(--accent);
      border-radius:20px;
      transition:width .2s;
    }

    .ft-slot {
      display:flex;
      align-items:center;
      gap:12px;
      padding:13px 0;
      border-bottom:1px solid var(--border);
    }

    .ft-slot:last-child {
      border-bottom:0;
      padding-bottom:0;
    }

    .ft-slot-icon {
      width:42px;
      height:42px;
      display:grid;
      place-items:center;
      background:var(--field);
      border-radius:12px;
      font-size:20px;
      flex-shrink:0;
    }

    .ft-slot-info {
      flex:1;
      min-width:0;
      display:flex;
      align-items:center;
      justify-content:space-between;
      gap:10px;
    }

    .ft-slot-copy {
      min-width:0;
      display:grid;
      gap:5px;
    }

    .ft-slot-title {
      font-weight:750;
      font-size:14px;
    }

    .ft-slot-detail {
      color:var(--muted);
      font-size:11px;
    }

    .ft-status {
      font-size:11px;
      font-weight:700;
      border-radius:20px;
      padding:6px 9px;
      white-space:nowrap;
      display:inline-block;
      background:var(--field);
      color:var(--muted);
      flex-shrink:0;
    }

    .ft-status.approved {
      color:#16845f;
      background:#d9f5e9;
    }

    .ft-status.pending {
      color:#9a6a0b;
      background:#fff0c7;
    }

    .ft-status.rejected {
      color:#b23b45;
      background:#ffe0e2;
    }

    .ft-member {
      display:flex;
      align-items:center;
      justify-content:space-between;
      gap:10px;
      padding:10px 0;
      border-bottom:1px solid var(--border);
    }

    .ft-member:last-child {
      border-bottom:0;
    }

    .ft-small {
      color:var(--muted);
      font-size:12px;
    }

    .ft-toolbar {
      display:flex;
      align-items:center;
      justify-content:space-between;
      gap:10px;
    }

    .ft-toolbar button {
      width:auto;
      margin:0;
      padding:9px 12px;
      font-size:12px;
      border:1px solid var(--border);
      background:transparent;
      color:var(--text);
    }

    .ft-error {
      color:#c34a50;
      font-size:13px;
      line-height:1.5;
    }

    .ft-form {
      display:grid;
      gap:13px;
      margin-top:16px;
    }

    .ft-form label {
      display:grid;
      gap:6px;
    }

    .ft-form input,
    .ft-form select,
    .ft-form textarea {
      width:100%;
      box-sizing:border-box;
      padding:12px;
      border:1px solid var(--border);
      border-radius:10px;
      background:var(--field);
      color:var(--text);
      font:inherit;
      font-size:14px;
    }

    .ft-form button {
      width:100%;
    }

    .ft-form button:disabled {
      opacity:.55;
      cursor:not-allowed;
    }

    .ft-message {
      font-size:13px;
      line-height:1.5;
    }

    .ft-message.error {
      color:#c34a50;
    }

    .ft-message.success {
      color:#16845f;
    }

    .ft-load-button {
      width:auto;
      margin:0;
      padding:9px 12px;
      border:1px solid var(--border);
      border-radius:9px;
      background:var(--field);
      color:var(--text);
      font:inherit;
      font-size:12px;
      font-weight:700;
      cursor:pointer;
      flex-shrink:0;
    }

    .ft-load-button:disabled {
      opacity:.5;
      cursor:not-allowed;
    }

    .ft-back-button {
      width:auto;
      padding:9px 12px;
      margin:0;
      border:1px solid var(--border);
      border-radius:10px;
      background:transparent;
      color:var(--text);
      font:inherit;
      cursor:pointer;
    }

    .ft-fixed-activity {
      opacity:.75;
      cursor:not-allowed;
    }

    .ft-review-list {
      display:grid;
      gap:14px;
      margin-top:15px;
    }

    .ft-review-card {
      border:1px solid var(--border);
      border-radius:14px;
      padding:13px;
      display:grid;
      gap:12px;
    }

    .ft-review-top {
      display:flex;
      align-items:center;
      justify-content:space-between;
      gap:8px;
      flex-wrap:wrap;
    }

    .ft-review-title {
      font-size:15px;
      font-weight:750;
    }

    .ft-review-photo {
      display:block;
      width:100%;
      max-height:300px;
      object-fit:contain;
      border-radius:10px;
      background:var(--field);
    }

    .ft-review-photo-link {
      display:block;
      text-decoration:none;
    }

    .ft-review-details {
      display:grid;
      gap:6px;
      font-size:13px;
    }

    .ft-review-detail {
      color:var(--muted);
    }

    .ft-review-notes {
      padding:10px;
      border-radius:9px;
      background:var(--field);
      font-size:13px;
      white-space:pre-wrap;
      overflow-wrap:anywhere;
    }

    .ft-review-actions {
      display:grid;
      grid-template-columns:1fr 1fr;
      gap:9px;
    }

    .ft-review-actions button {
      width:100%;
      margin:0;
      padding:11px 8px;
      border:0;
      border-radius:10px;
      font:inherit;
      font-size:13px;
      font-weight:750;
      cursor:pointer;
    }

    .ft-approve-button {
      background:#d9f5e9;
      color:#16845f;
    }

    .ft-reject-button {
      background:#ffe0e2;
      color:#b23b45;
    }

    .ft-review-actions button:disabled {
      opacity:.5;
      cursor:not-allowed;
    }

    .ft-review-empty {
      padding:14px;
      border-radius:12px;
      background:var(--field);
      color:var(--muted);
      font-size:13px;
      line-height:1.5;
    }

    .ft-notification-area {
      position:relative;
      display:flex;
      align-items:center;
      gap:8px;
    }

    .ft-bell-button {
      position:relative;
      width:40px !important;
      height:40px;
      padding:0 !important;
      display:grid;
      place-items:center;
      border:1px solid var(--border) !important;
      border-radius:12px;
      background:var(--field) !important;
      color:var(--text) !important;
      font-size:19px !important;
      cursor:pointer;
    }

    .ft-bell-count {
      position:absolute;
      top:-6px;
      right:-6px;
      min-width:18px;
      height:18px;
      padding:0 4px;
      display:grid;
      place-items:center;
      border-radius:20px;
      background:#d9364f;
      color:#fff;
      font-size:10px;
      font-weight:800;
      border:2px solid var(--card);
    }

    .ft-notification-panel {
      display:none;
      margin-top:12px;
    }

    .ft-notification-panel.open {
      display:block;
    }

    .ft-notification-list {
      display:grid;
      gap:8px;
      margin-top:10px;
    }

    .ft-notification-item {
      width:100%;
      margin:0;
      padding:12px;
      display:grid;
      gap:5px;
      text-align:left;
      border:1px solid var(--border);
      border-radius:12px;
      background:var(--field);
      color:var(--text);
      cursor:pointer;
    }

    .ft-notification-item.unread {
      border-color:var(--accent);
      background:var(--card);
    }

    .ft-notification-item:disabled {
      opacity:.6;
      cursor:wait;
    }

    .ft-notification-message {
      font-size:13px;
      line-height:1.4;
    }

    .ft-notification-meta {
      color:var(--muted);
      font-size:11px;
    }

    .ft-notification-toolbar {
      display:flex;
      align-items:center;
      justify-content:space-between;
      gap:8px;
    }

    .ft-notification-toolbar button {
      width:auto;
      margin:0;
      padding:6px 9px;
      border:1px solid var(--border);
      border-radius:8px;
      background:transparent;
      color:var(--text);
      font:inherit;
      font-size:11px;
      cursor:pointer;
    }

    .ft-notification-empty {
      padding:12px;
      color:var(--muted);
      font-size:13px;
      background:var(--field);
      border-radius:10px;
    }

        @media (max-width:380px) {
      .ft-slot {
        gap:8px;
      }

      .ft-slot-icon {
        width:36px;
        height:36px;
      }

      .ft-load-button {
        padding:8px 9px;
        font-size:11px;
      }
    }
  `;

  if (!document.getElementById("ft-dashboard-styles")) {
    const style = document.createElement("style");
    style.id = "ft-dashboard-styles";
    style.textContent = styles;
    document.head.appendChild(style);
  }

  const escapeHtml = (value) =>
    String(value ?? "").replace(/[&<>"']/g, char => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    })[char]);

  function localDateString(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
  }

  function formatDate(dateString) {
    if (!dateString) return "Data non disponibile";

    const parts = dateString.split("-");
    if (parts.length !== 3) return dateString;

    return `${parts[2]}/${parts[1]}/${parts[0]}`;
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
        {
          id: "gym_1",
          title: "Palestra 1",
          icon: "🏋️"
        },
        {
          id: "gym_2",
          title: "Palestra 2",
          icon: "🏋️"
        },
        {
          id: "run",
          title: "Corsa",
          icon: "🏃"
        }
      ];
    }

    return [
      {
        id: "gym_1",
        title: "Palestra 1",
        icon: "🏋️"
      },
      {
        id: "gym_2",
        title: "Palestra 2",
        icon: "🏋️"
      },
      {
        id: "free_sport",
        title: "Sport libero",
        icon: "🚴"
      }
    ];
  }

  function statusLabel(status) {
    if (status === "approved") return "Registrata";
    if (status === "pending") return "In approvazione";
    if (status === "rejected") return "Da correggere";

    return "Da registrare";
  }

  function getActiveWorkout(slot, workouts) {
    return workouts.find(item =>
      item.session_slot === slot.id &&
      (
        item.status === "approved" ||
        item.status === "pending"
      )
    );
  }

  function renderSlot(slot, workouts) {
    const activeEntry = getActiveWorkout(slot, workouts);

    const latestEntry = activeEntry || workouts.find(
      item => item.session_slot === slot.id
    );

    const status = latestEntry?.status || "empty";
    const detail = statusLabel(status);

    let action = "";

    if (status === "approved") {
      action = `
        <span class="ft-status approved">
          ✓ Registrata
        </span>
      `;
    } else if (status === "pending") {
      action = `
        <span class="ft-status pending">
          In approvazione
        </span>
      `;
    } else if (status === "rejected") {
      action = `
        <button type="button"
          class="ft-load-button"
          data-slot="${slot.id}">
          Riprova
        </button>
      `;
    } else {
      action = `
        <button type="button"
          class="ft-load-button"
          data-slot="${slot.id}">
          Carica attività
        </button>
      `;
    }

    return `
      <div class="ft-slot">
        <div class="ft-slot-icon">${slot.icon}</div>

        <div class="ft-slot-info">
          <div class="ft-slot-copy">
            <div class="ft-slot-title">
              ${escapeHtml(slot.title)}
            </div>

            <div class="ft-slot-detail">
              ${escapeHtml(detail)}
            </div>
          </div>

          ${action}
        </div>
      </div>
    `;
  }

  function activityOptions(slotId) {
    if (slotId === "gym_1" || slotId === "gym_2") {
      return [
        { value: "gym", label: "Palestra" }
      ];
    }

    if (slotId === "run") {
      return [
        { value: "run", label: "Corsa" }
      ];
    }

    return [
      { value: "trekking", label: "Trekking" },
      { value: "cycling", label: "Ciclismo" },
      { value: "skiing", label: "Sci" },
      { value: "gym", label: "Palestra" },
      { value: "beach_volley", label: "Beach volley" },
      { value: "run", label: "Corsa" },
      { value: "swimming", label: "Nuoto" },
      { value: "other", label: "Altro sport" }
    ];
  }

  function activityLabel(activity) {
    const labels = {
      gym: "Palestra",
      run: "Corsa",
      trekking: "Trekking",
      cycling: "Ciclismo",
      skiing: "Sci",
      beach_volley: "Beach volley",
      swimming: "Nuoto",
      other: "Altro sport"
    };

    return labels[activity] || activity || "Attività";
  }

  function showWorkoutForm(member, slotId) {
    const container = document.getElementById("challengeCard");
    const week = getCurrentWeek();
    const slots = getPlanSlots(member.weekly_plan);
    const slot = slots.find(item => item.id === slotId);

    if (!slot) return;

    const options = activityOptions(slotId);
    const isFixedActivity = options.length === 1;

    container.innerHTML = `
      <div class="ft-dashboard">

        <div class="ft-toolbar">
          <button type="button"
            class="ft-back-button"
            id="ftBackToDashboard">
            ← Torna alla sfida
          </button>

          <div class="ft-small">FIT TOGETHER</div>
        </div>

        <div class="ft-panel">
          <h1 class="ft-heading">
            Registra allenamento 💪
          </h1>

          <div class="ft-subtitle">
            Sessione: <strong>${escapeHtml(slot.title)}</strong>
          </div>

          <form id="ftWorkoutForm" class="ft-form">

            <label>
              <span class="ft-small">Tipo di attività</span>

              <select id="ftActivityType" required
                ${isFixedActivity
                  ? "disabled class='ft-fixed-activity'"
                  : ""}>

                ${options.map(item =>
                  `<option value="${item.value}">${item.label}</option>`
                ).join("")}

              </select>
            </label>

            <label>
              <span class="ft-small">Data dell'attività</span>

              <input id="ftActivityDate"
                type="date"
                min="${week.start}"
                max="${week.today}"
                value="${week.today}"
                required>
            </label>

            <label>
              <span class="ft-small">Durata (minuti)</span>

              <input id="ftDuration"
                type="number"
                min="1"
                max="1440"
                required
                placeholder="Es. 60">
            </label>

            <label>
              <span class="ft-small">
                Distanza (km) – facoltativa
              </span>

              <input id="ftDistance"
                type="number"
                min="0"
                step="0.01"
                placeholder="Es. 5.5">
            </label>

            <label>
              <span class="ft-small">Note – facoltative</span>

              <textarea id="ftNotes"
                rows="3"
                maxlength="1000"
                placeholder="Aggiungi qualche dettaglio..."></textarea>
            </label>

            <label>
              <span class="ft-small">
                Foto di prova (max 10 MB)
              </span>

              <input id="ftProof"
                type="file"
                accept="image/jpeg,image/png,image/webp,image/heic"
                required>
            </label>

            <button type="submit" id="ftSubmitWorkout">
              Invia allenamento
            </button>

            <div id="ftWorkoutMessage"
              class="ft-message"
              aria-live="polite">
            </div>

          </form>
        </div>
      </div>
    `;

    document.getElementById("ftBackToDashboard")
      .addEventListener("click", () => loadDashboard(member.user));

    document.getElementById("ftWorkoutForm")
      .addEventListener("submit", event =>
        submitWorkout(event, member, slotId)
      );
  }

  async function submitWorkout(event, member, slotId) {
    event.preventDefault();

    const form = event.currentTarget;
    const button = document.getElementById("ftSubmitWorkout");
    const message = document.getElementById("ftWorkoutMessage");

    if (!form || !button || !message) return;

    const slot = slotId;
    const activity = document.getElementById("ftActivityType").value;
    const date = document.getElementById("ftActivityDate").value;
    const duration = Number(document.getElementById("ftDuration").value);
    const distanceValue = document.getElementById("ftDistance").value;
    const notes = document.getElementById("ftNotes").value.trim();
    const file = document.getElementById("ftProof").files[0];

    const week = getCurrentWeek();

    if (!date || date < week.start || date > week.today) {
      message.textContent =
        "Seleziona una data compresa nella settimana corrente e non futura.";

      message.className = "ft-message error";
      return;
    }

    if (!Number.isInteger(duration) || duration < 1 || duration > 1440) {
      message.textContent =
        "Inserisci una durata valida in minuti.";

      message.className = "ft-message error";
      return;
    }

    const distance = distanceValue === ""
      ? null
      : Number(distanceValue);

    if (distance !== null &&
      (!Number.isFinite(distance) || distance < 0)) {

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
      message.textContent =
        "La foto supera il limite massimo di 10 MB.";

      message.className = "ft-message error";
      return;
    }

    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/heic"
    ];

    if (!allowedTypes.includes(file.type)) {
      message.textContent =
        "Formato non supportato. Usa JPEG, PNG, WEBP o HEIC.";

      message.className = "ft-message error";
      return;
    }

    button.disabled = true;
    button.textContent = "Invio in corso...";

    message.textContent =
      "Caricamento della foto e registrazione dell'allenamento...";

    message.className = "ft-message";

    let uploadedPath = null;

    try {
      const originalExtension = file.name
        .split(".")
        .pop()
        .toLowerCase();

      const safeExtension = /^[a-z0-9]+$/.test(originalExtension)
        ? originalExtension
        : "jpg";

      const fileName = `${crypto.randomUUID()}.${safeExtension}`;

      uploadedPath =
        `${member.challenge_id}/${member.id}/${fileName}`;

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

      await loadDashboard(member.user);

    } catch (error) {
      console.error("FIT TOGETHER workout error:", error);

      if (uploadedPath) {
        const { error: cleanupError } = await client.storage
          .from(BUCKET)
          .remove([uploadedPath]);

        if (cleanupError) {
          console.error(
            "Errore durante la pulizia della foto:",
            cleanupError
          );
        }
      }

      message.textContent =
        error.message ||
        "Non è stato possibile inviare l'allenamento.";

      message.className = "ft-message error";

      button.disabled = false;
      button.textContent = "Invia allenamento";
    }
  }

  async function reviewWorkout(workoutId, approve, user) {
    const actionButtons = document.querySelectorAll(
      `[data-review-id="${workoutId}"]`
    );

    actionButtons.forEach(button => {
      button.disabled = true;
      button.textContent = "Attendere...";
    });

    try {
      const { error } = await client.rpc("review_workout", {
        p_workout_id: workoutId,
        p_approve: approve
      });

      if (error) throw error;

      await loadDashboard(user);

    } catch (error) {
      console.error("FIT TOGETHER review error:", error);

      const message = document.getElementById(
        `ftReviewMessage-${workoutId}`
      );

      if (message) {
        message.textContent =
          error.message || "Non è stato possibile completare la revisione.";

        message.className = "ft-message error";
      }

      actionButtons.forEach(button => {
        button.disabled = false;
        button.textContent = button.dataset.originalLabel || "Riprova";
      });
    }
  }

  async function renderPendingReviews(pendingWorkouts, members, user) {
    if (!pendingWorkouts.length) {
      return `
        <div class="ft-review-empty">
          <strong>Non ci sono allenamenti da approvare.</strong>
          <br>
          Quando il partner invierà un allenamento, lo troverai qui.
        </div>
      `;
    }

    const memberMap = new Map(
      members.map(member => [member.id, member])
    );

    const cards = await Promise.all(
      pendingWorkouts.map(async workout => {
        const member = memberMap.get(workout.member_id);
        const memberName = member?.display_name || "Partner";

        let photoHtml = `
          <div class="ft-review-empty">
            Foto di prova non disponibile.
          </div>
        `;

        if (workout.proof_path) {
          try {
            const { data, error } = await client.storage
              .from(BUCKET)
              .createSignedUrl(workout.proof_path, 3600);

            if (!error && data?.signedUrl) {
              const safeUrl = escapeHtml(data.signedUrl);

              photoHtml = `
                <a class="ft-review-photo-link"
                  href="${safeUrl}"
                  target="_blank"
                  rel="noopener noreferrer">

                  <img
                    class="ft-review-photo"
                    src="${safeUrl}"
                    alt="Foto di prova di ${escapeHtml(memberName)}"
                    loading="lazy">
                </a>
              `;
            } else {
              console.error(
                "FIT TOGETHER signed URL error:",
                error
              );
            }
          } catch (photoError) {
            console.error(
              "FIT TOGETHER photo error:",
              photoError
            );
          }
        }

        const distanceHtml =
          workout.distance_km !== null &&
          workout.distance_km !== undefined
            ? `<div class="ft-review-detail">Distanza: <strong>${escapeHtml(workout.distance_km)} km</strong></div>`
            : "";

        const notesHtml = workout.notes
          ? `
            <div class="ft-review-notes">
              <strong>Note:</strong>
              <br>
              ${escapeHtml(workout.notes)}
            </div>
          `
          : "";

        return `
          <div class="ft-review-card" data-workout-card-id="${escapeHtml(workout.id)}">

            <div class="ft-review-top">
              <div class="ft-review-title">
                ${escapeHtml(memberName)}
              </div>

              <span class="ft-status pending">
                Da approvare
              </span>
            </div>

            <div class="ft-review-details">
              <div>
                Attività:
                <strong>${escapeHtml(activityLabel(workout.activity_type))}</strong>
              </div>

              <div class="ft-review-detail">
                Data: <strong>${escapeHtml(formatDate(workout.activity_date))}</strong>
              </div>

              <div class="ft-review-detail">
                Durata: <strong>${escapeHtml(workout.duration_minutes)} minuti</strong>
              </div>

              ${distanceHtml}
            </div>

            ${photoHtml}

            ${notesHtml}

            <div id="ftReviewMessage-${workout.id}"
              class="ft-message"
              aria-live="polite">
            </div>

            <div class="ft-review-actions">
              <button
                type="button"
                class="ft-approve-button"
                data-review-id="${escapeHtml(workout.id)}"
                data-original-label="✓ Approva"
                data-review-action="approve">
                ✓ Approva
              </button>

              <button
                type="button"
                class="ft-reject-button"
                data-review-id="${escapeHtml(workout.id)}"
                data-original-label="✕ Rifiuta"
                data-review-action="reject">
                ✕ Rifiuta
              </button>
            </div>

          </div>
        `;
      })
    );

    return cards.join("");
  }

  function formatNotificationTime(value) {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleString("it-IT", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    });
  }

  function renderNotifications(notifications) {
    if (!notifications.length) {
      return '<div class="ft-notification-empty">Non hai notifiche.</div>';
    }

    return notifications.map(notification => `
      <button
        type="button"
        class="ft-notification-item ${notification.is_read ? "" : "unread"}"
        data-notification-id="${escapeHtml(notification.id)}"
        data-notification-workout="${escapeHtml(notification.workout_id || "")}"
        data-notification-type="${escapeHtml(notification.notification_type)}">
        <strong>${escapeHtml(notification.title)}</strong>
        <span class="ft-notification-message">${escapeHtml(notification.message)}</span>
        <span class="ft-notification-meta">${escapeHtml(formatNotificationTime(notification.created_at))}${notification.is_read ? " · Letta" : " · Nuova"}</span>
      </button>
    `).join("");
  }

  async function markNotificationRead(notificationId) {
    const { error } = await client.rpc("mark_notification_read", {
      p_notification_id: notificationId
    });
    if (error) throw error;
  }

  async function refreshNotifications(user) {
    const { data, error } = await client
      .from("notifications")
      .select("id, title, message, notification_type, workout_id, is_read, created_at")
      .eq("recipient_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) throw error;

    const notifications = data || [];
    const unreadCount = notifications.filter(item => !item.is_read).length;
    const countElement = document.getElementById("ftBellCount");
    const listElement = document.getElementById("ftNotificationList");

    if (countElement) {
      countElement.textContent = unreadCount > 99 ? "99+" : String(unreadCount);
      countElement.hidden = unreadCount === 0;
    }

    if (listElement) {
      listElement.innerHTML = renderNotifications(notifications);
      listElement.querySelectorAll("[data-notification-id]").forEach(button => {
        button.addEventListener("click", async () => {
          const notificationId = button.dataset.notificationId;
          const workoutId = button.dataset.notificationWorkout;
          const notificationType = button.dataset.notificationType;
          button.disabled = true;

          try {
            await markNotificationRead(notificationId);
            await loadDashboard(user);

            if (notificationType === "workout_submitted" && workoutId) {
              const target = document.querySelector(
                `[data-workout-card-id="${workoutId}"]`
              );
              (target || document.getElementById("ftReviewSection"))?.scrollIntoView({
                behavior: "smooth",
                block: "center"
              });
            } else {
              document.getElementById("ftOwnGoalsSection")?.scrollIntoView({
                behavior: "smooth",
                block: "start"
              });
            }
          } catch (error) {
            console.error("FIT TOGETHER notification error:", error);
            button.disabled = false;
            alert(error.message || "Non è stato possibile aprire la notifica.");
          }
        });
      });
    }

    return notifications;
  }

  async function loadDashboard(user) {
    const container = document.getElementById("challengeCard");

    if (!container || !user) return;

    container.innerHTML = `
      <div class="ft-panel"
        style="text-align:center;padding:32px">

        <div style="font-size:28px;margin-bottom:10px">
          💪
        </div>

        <strong>Caricamento FIT TOGETHER...</strong>

        <p class="ft-small">
          Stiamo recuperando i vostri progressi.
        </p>
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

            <p class="ft-small">
              Non risulti ancora collegato a una challenge.
            </p>

            <button onclick="location.reload()">
              Torna all'accesso
            </button>
          </div>
        `;

        return;
      }

      ownMember.user = user;

      const week = getCurrentWeek();

      const [
        membersResult,
        workoutsResult,
        pendingResult,
        notificationsResult
      ] = await Promise.all([

        client
          .from("challenge_members")
          .select("id, display_name, weekly_plan, user_id")
          .eq("challenge_id", ownMember.challenge_id)
          .order("joined_at", { ascending: true }),

        client
          .from("workout_entries")
          .select(`
            id,
            member_id,
            session_slot,
            activity_type,
            activity_date,
            duration_minutes,
            distance_km,
            status,
            created_at
          `)
          .eq("challenge_id", ownMember.challenge_id)
          .gte("activity_date", week.start)
          .lte("activity_date", week.end)
          .order("created_at", { ascending: false }),

        client
          .from("workout_entries")
          .select(`
            id,
            member_id,
            session_slot,
            activity_type,
            activity_date,
            duration_minutes,
            distance_km,
            notes,
            proof_path,
            status,
            created_at
          `)
          .eq("challenge_id", ownMember.challenge_id)
          .eq("status", "pending")
          .neq("member_id", ownMember.id)
          .order("created_at", { ascending: true }),

        client
          .from("notifications")
          .select("id, title, message, notification_type, workout_id, is_read, created_at")
          .eq("recipient_id", user.id)
          .order("created_at", { ascending: false })
          .limit(20)

      ]);

      if (membersResult.error) throw membersResult.error;
      if (workoutsResult.error) throw workoutsResult.error;
      if (pendingResult.error) throw pendingResult.error;
      if (notificationsResult.error) throw notificationsResult.error;

      const members = membersResult.data || [];
      const workouts = workoutsResult.data || [];
      const pendingWorkouts = pendingResult.data || [];
      const notifications = notificationsResult.data || [];
      const unreadNotifications = notifications.filter(item => !item.is_read).length;

      const ownSlots = getPlanSlots(ownMember.weekly_plan);

      const ownWorkouts = workouts.filter(
        item => item.member_id === ownMember.id
      );

      const approvedCount = ownSlots.filter(slot =>
        ownWorkouts.some(item =>
          item.session_slot === slot.id &&
          item.status === "approved"
        )
      ).length;

      const progress = Math.round((approvedCount / 3) * 100);

      const weekLabel =
        `${week.start.split("-").reverse().join("/")} – ${week.end.split("-").reverse().join("/")}`;

      const memberSummary = members.map(member => {
        const slots = getPlanSlots(member.weekly_plan);

        const memberEntries = workouts.filter(
          item => item.member_id === member.id
        );

        const count = slots.filter(slot =>
          memberEntries.some(item =>
            item.session_slot === slot.id &&
            item.status === "approved"
          )
        ).length;

        return `
          <div class="ft-member">

            <div>
              <strong>${escapeHtml(member.display_name)}</strong>

              <div class="ft-small">
                ${member.weekly_plan === "runner"
                  ? "2 palestre + corsa"
                  : "2 palestre + sport libero"}
              </div>
            </div>

            <strong>${count}/3</strong>

          </div>
        `;
      }).join("");

      const pendingReviewsHtml = await renderPendingReviews(
        pendingWorkouts,
        members,
        user
      );

      const partner = members.find(member => member.id !== ownMember.id);
      const partnerName = partner?.display_name || "il tuo partner";
      const notificationListHtml = renderNotifications(notifications);

      container.innerHTML = `
        <div class="ft-dashboard">

          <div class="ft-toolbar">
            <div class="ft-small">
              FIT TOGETHER · LA TUA CHALLENGE
            </div>

            <div class="ft-notification-area">
              <button type="button"
                class="ft-bell-button"
                id="ftBellButton"
                aria-label="Apri notifiche"
                aria-expanded="false">
                🔔
                <span class="ft-bell-count" id="ftBellCount"
                  ${unreadNotifications === 0 ? "hidden" : ""}>
                  ${unreadNotifications > 99 ? "99+" : unreadNotifications}
                </span>
              </button>

              <button type="button" id="ftLogout">
                Esci
              </button>
            </div>
          </div>

          <div class="ft-panel ft-notification-panel" id="ftNotificationPanel">
            <div class="ft-notification-toolbar">
              <strong>Notifiche</strong>
              <button type="button" id="ftRefreshNotifications">Aggiorna</button>
            </div>
            <div class="ft-notification-list" id="ftNotificationList">
              ${notificationListHtml}
            </div>
          </div>

          <div class="ft-panel">

            <h1 class="ft-heading">
              Ciao, ${escapeHtml(ownMember.display_name)}! 👋
            </h1>

            <div class="ft-subtitle">
              La tua settimana · ${weekLabel}
            </div>

            <div class="ft-progress">
              <div class="ft-progress-fill"
                style="width:${progress}%">
              </div>
            </div>

            <strong>
              ${approvedCount} di 3 allenamenti approvati
            </strong>

            <div class="ft-small" style="margin-top:5px">
              Solo gli allenamenti approvati contano per il tuo obiettivo.
            </div>

          </div>

          <div class="ft-panel" id="ftOwnGoalsSection">

            <h2 style="margin:0 0 5px">
              I tuoi obiettivi
            </h2>

            <div class="ft-subtitle">
              Seleziona una sessione per caricare il tuo allenamento.
            </div>

            ${ownSlots.map(slot =>
              renderSlot(slot, ownWorkouts)
            ).join("")}

          </div>

          <div class="ft-panel" id="ftReviewSection">

            <div class="ft-review-top">
              <h2 style="margin:0">
                Allenamenti da approvare
              </h2>

              ${pendingWorkouts.length
                ? `<span class="ft-status pending">${pendingWorkouts.length} in attesa</span>`
                : ""}
            </div>

            <div class="ft-subtitle" style="margin-top:5px">
              Qui trovi gli allenamenti inviati da ${escapeHtml(partnerName)}.
            </div>

            <div class="ft-review-list">
              ${pendingReviewsHtml}
            </div>

          </div>

          <div class="ft-panel">

            <h2 style="margin:0 0 5px">
              La vostra sfida
            </h2>

            <div class="ft-subtitle">
              Progresso settimanale di entrambi
            </div>

            ${memberSummary ||
              '<p class="ft-small">Nessun partecipante trovato.</p>'}

          </div>

        </div>
      `;

      const bellButton = document.getElementById("ftBellButton");
      const notificationPanel = document.getElementById("ftNotificationPanel");

      bellButton.addEventListener("click", async () => {
        const isOpen = notificationPanel.classList.toggle("open");
        bellButton.setAttribute("aria-expanded", String(isOpen));

        if (isOpen) {
          try {
            await refreshNotifications(user);
          } catch (error) {
            console.error("FIT TOGETHER notification refresh error:", error);
          }
        }
      });

      document.getElementById("ftRefreshNotifications")
        .addEventListener("click", async () => {
          const refreshButton = document.getElementById("ftRefreshNotifications");
          refreshButton.disabled = true;
          refreshButton.textContent = "Aggiornamento...";
          try {
            await refreshNotifications(user);
          } catch (error) {
            console.error("FIT TOGETHER notification refresh error:", error);
            alert(error.message || "Non è stato possibile aggiornare le notifiche.");
          } finally {
            refreshButton.disabled = false;
            refreshButton.textContent = "Aggiorna";
          }
        });

      container.querySelectorAll("[data-notification-id]").forEach(button => {
        button.addEventListener("click", async () => {
          const notificationId = button.dataset.notificationId;
          const workoutId = button.dataset.notificationWorkout;
          const notificationType = button.dataset.notificationType;
          button.disabled = true;

          try {
            await markNotificationRead(notificationId);
            await loadDashboard(user);

            if (notificationType === "workout_submitted" && workoutId) {
              const target = document.querySelector(
                `[data-workout-card-id="${workoutId}"]`
              );
              (target || document.getElementById("ftReviewSection"))?.scrollIntoView({
                behavior: "smooth",
                block: "center"
              });
            } else {
              document.getElementById("ftOwnGoalsSection")?.scrollIntoView({
                behavior: "smooth",
                block: "start"
              });
            }
          } catch (error) {
            console.error("FIT TOGETHER notification error:", error);
            button.disabled = false;
            alert(error.message || "Non è stato possibile aprire la notifica.");
          }
        });
      });

      container.querySelectorAll(".ft-load-button").forEach(button => {
        button.addEventListener("click", () => {
          showWorkoutForm(ownMember, button.dataset.slot);
        });
      });

      container.querySelectorAll("[data-review-action]").forEach(button => {
        button.addEventListener("click", () => {
          const workoutId = button.dataset.reviewId;
          const approve = button.dataset.reviewAction === "approve";

          reviewWorkout(workoutId, approve, user);
        });
      });

      document.getElementById("ftLogout").addEventListener(
        "click",
        async () => {
          if (notificationRefreshTimer) {
            clearInterval(notificationRefreshTimer);
            notificationRefreshTimer = null;
          }
          await client.auth.signOut();
          location.reload();
        }
      );

      if (notificationRefreshTimer) {
        clearInterval(notificationRefreshTimer);
      }

      notificationRefreshTimer = setInterval(() => {
        refreshNotifications(user).catch(error => {
          console.error("FIT TOGETHER notification polling error:", error);
        });
      }, 30000);

    } catch (error) {
      console.error("FIT TOGETHER dashboard error:", error);

      container.innerHTML = `
        <div class="ft-panel">

          <h2>
            Non riusciamo a caricare la dashboard
          </h2>

          <p class="ft-error">
            ${escapeHtml(error.message || "Errore sconosciuto")}
          </p>

          <button type="button"
            onclick="location.reload()">
            Riprova
          </button>

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
