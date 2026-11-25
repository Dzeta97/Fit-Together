(() => {
  "use strict";

  const client = window.fitTogetherSupabase;
  const BUCKET = "fit-together-proofs";
  const MAX_FILE_SIZE = 10 * 1024 * 1024;

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
  let notificationRefreshTimer = null;
  let currentUser = null;
  let currentMember = null;
  let currentChallenge = null;
  let currentView = "home";
  let selectedWorkoutId = null;

  // --------------------------------------------------
  // UTILITIES
  // --------------------------------------------------

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[char]);
  }

  function localDateString(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function formatDate(value) {
    if (!value) return "Data non disponibile";

    return new Date(value + "T12:00:00").toLocaleDateString("it-IT", {
      day: "2-digit",
      month: "short",
      year: "numeric"
    });
  }

  function formatDateTime(value) {
    if (!value) return "";

    return new Date(value).toLocaleString("it-IT", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit"
    });
  }

  function getWeekRange() {
    const now = new Date();
    const monday = new Date(now);
    const day = (now.getDay() + 6) % 7;

    monday.setDate(now.getDate() - day);
    monday.setHours(0, 0, 0, 0);

    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    return {
      start: localDateString(monday),
      end: localDateString(sunday)
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

  function getPlanSlots(plan) {
    const slots = [
      {
        id: "gym_1",
        title: "Prima sessione palestra",
        description: "Allenamento in palestra",
        icon: "🏋️"
      },
      {
        id: "gym_2",
        title: "Seconda sessione palestra",
        description: "Allenamento in palestra",
        icon: "🏋️"
      }
    ];

    if (plan === "runner") {
      slots.push({
        id: "run",
        title: "Corsa",
        description: "Sessione di corsa",
        icon: "🏃"
      });
    } else {
      slots.push({
        id: "free_sport",
        title: "Sport libero",
        description: "Trekking, bici, sci o altra attività",
        icon: "🚴"
      });
    }

    return slots;
  }

  function activityOptions() {
    return [
      ["gym", "Palestra"],
      ["running", "Corsa"],
      ["cycling", "Ciclismo"],
      ["trekking", "Trekking"],
      ["swimming", "Nuoto"],
      ["skiing", "Sci"],
      ["other", "Altro"]
    ];
  }

  function activityLabel(type) {
    const option = activityOptions().find(item => item[0] === type);
    return option ? option[1] : (type || "Allenamento");
  }

  function statusLabel(status) {
    const labels = {
      approved: "Approvato",
      pending: "Caricata · In attesa di approvazione",
      rejected: "Rifiutato"
    };

    return labels[status] || status || "Da caricare";
  }

  function getSlotWorkout(workouts, slotId) {
    return workouts
      .filter(workout => workout.session_slot === slotId)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];
  }

  function isReviewNotification(notification) {
    const type = String(notification.notification_type || "").toLowerCase();

    return [
      "workout_submitted",
      "workout_pending_review",
      "review_required",
      "workout_to_review"
    ].includes(type);
  }

  // --------------------------------------------------
  // STYLES
  // --------------------------------------------------

  function injectStyles() {
    if (document.getElementById("ft-dashboard-styles")) return;

    const style = document.createElement("style");
    style.id = "ft-dashboard-styles";

    style.textContent = `
      .ft-dashboard {
        display:grid;
        gap:18px;
        padding:10px 0;
      }

      .ft-panel {
        background:var(--card-bg, #fff);
        border:1px solid var(--border-color, #e1e5eb);
        border-radius:16px;
        padding:20px;
      }

      .ft-heading {
        margin:0;
        font-size:23px;
        font-weight:750;
      }

      .ft-subtitle {
        color:var(--text-muted, #718096);
        font-size:13px;
        margin:6px 0 0;
      }

      .ft-progress {
        height:10px;
        background:#e8edf0;
        border-radius:20px;
        overflow:hidden;
        margin-top:12px;
      }

      .ft-progress-fill {
        height:100%;
        background:#30b58b;
        border-radius:20px;
        transition:width .3s ease;
      }

      .ft-slot {
        display:flex;
        align-items:center;
        gap:13px;
        padding:15px;
        border:1px solid var(--border-color, #e1e5eb);
        border-radius:14px;
        margin-top:10px;
        min-width:0;
      }

      .ft-slot.clickable {
        cursor:pointer;
        transition:background .2s ease, border-color .2s ease;
      }

      .ft-slot.clickable:hover {
        border-color:#30b58b;
        background:rgba(48,181,139,.06);
      }

      .ft-slot-icon {
        font-size:25px;
        width:38px;
        text-align:center;
        flex-shrink:0;
      }

      .ft-slot-info {
        flex:1;
        min-width:0;
      }

      .ft-slot-title {
        font-weight:700;
        margin:0;
      }

      .ft-slot-detail {
        color:var(--text-muted, #718096);
        font-size:12px;
        margin:4px 0 0;
      }

      .ft-status {
        display:inline-block;
        padding:5px 9px;
        border-radius:20px;
        font-size:11px;
        font-weight:700;
        white-space:nowrap;
      }

      .ft-status.approved {
        background:#d9f5e9;
        color:#14764f;
      }

      .ft-status.pending {
        background:#fff0cc;
        color:#946200;
      }

      .ft-status.rejected {
        background:#ffe0e2;
        color:#b42332;
      }

      .ft-button {
        border:0;
        border-radius:10px;
        padding:11px 15px;
        font-weight:700;
        cursor:pointer;
        font-size:13px;
      }

      .ft-slot .ft-button {
        width:auto;
        min-width:74px;
        flex:0 0 auto;
        padding:8px 11px;
        font-size:12px;
        white-space:nowrap;
      }

      .ft-primary {
        background:#168b68;
        color:white;
      }

      .ft-secondary {
        background:transparent;
        border:1px solid var(--border-color, #d5dbe2);
        color:inherit;
      }

      .ft-danger {
        background:#b42332;
        color:white;
      }

      .ft-button:disabled {
        opacity:.5;
        cursor:not-allowed;
      }

      .ft-form {
        display:grid;
        gap:13px;
        margin-top:15px;
      }

      .ft-form label {
        display:grid;
        gap:6px;
        font-size:13px;
        font-weight:650;
      }

      .ft-form input,
      .ft-form select,
      .ft-form textarea {
        width:100%;
        box-sizing:border-box;
        padding:11px;
        border:1px solid var(--border-color, #d5dbe2);
        border-radius:9px;
        background:var(--card-bg, #fff);
        color:inherit;
        font:inherit;
      }

      .ft-form textarea {
        min-height:75px;
        resize:vertical;
      }

      .ft-error {
        color:#b42332;
        font-size:13px;
        margin:0;
      }

      .ft-message {
        color:var(--text-muted, #718096);
        font-size:13px;
      }

      .ft-review-card {
        border:1px solid var(--border-color, #e1e5eb);
        border-radius:13px;
        padding:15px;
        margin-top:12px;
      }

      .ft-review-photo {
        display:block;
        width:100%;
        max-height:260px;
        object-fit:cover;
        border-radius:10px;
        margin-top:12px;
      }

      .ft-review-actions {
        display:flex;
        gap:9px;
        margin-top:14px;
      }

      .ft-notification-area {
        position:relative;
      }

      .ft-bell-button {
        position:relative;
        border:1px solid var(--border-color, #d5dbe2);
        background:transparent;
        border-radius:11px;
        padding:10px 13px;
        cursor:pointer;
        font-size:19px;
      }

      .ft-bell-count {
        position:absolute;
        top:-6px;
        right:-6px;
        background:#d9364f;
        color:white;
        border-radius:20px;
        min-width:17px;
        height:17px;
        font-size:10px;
        display:flex;
        align-items:center;
        justify-content:center;
        padding:0 3px;
      }

      .ft-notification-item {
        padding:11px 0;
        border-bottom:1px solid var(--border-color, #e1e5eb);
        font-size:13px;
      }

      .ft-notification-item:last-child {
        border-bottom:0;
      }

      .ft-notification-item.unread {
        font-weight:700;
      }

      .ft-small {
        font-size:11px;
        color:var(--text-muted, #718096);
        margin-top:5px;
      }

      .ft-member-grid {
        display:grid;
        gap:13px;
      }

      .ft-member-name {
        display:flex;
        justify-content:space-between;
        align-items:center;
        gap:10px;
      }

      .ft-toolbar {
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:10px;
        flex-wrap:wrap;
      }

      .ft-toolbar-right {
        display:flex;
        align-items:center;
        gap:9px;
        margin-left:auto;
      }

      .ft-menu-area {
        position:relative;
      }

      .ft-menu-button {
        border:1px solid var(--border-color, #d5dbe2);
        background:transparent;
        color:inherit;
        border-radius:11px;
        padding:10px 13px;
        cursor:pointer;
        font-size:19px;
      }

      .ft-menu-panel {
        position:absolute;
        z-index:20;
        top:calc(100% + 8px);
        right:0;
        left:auto;
        min-width:185px;
        padding:7px;
        background:var(--card-bg, #fff);
        border:1px solid var(--border-color, #d5dbe2);
        border-radius:12px;
        box-shadow:0 8px 24px rgba(0,0,0,.12);
      }

      .ft-menu-item {
        display:block;
        width:100%;
        padding:11px 12px;
        border:0;
        border-radius:8px;
        background:transparent;
        color:inherit;
        text-align:left;
        font:inherit;
        cursor:pointer;
      }

      .ft-menu-item:hover,
      .ft-menu-item.active {
        background:var(--border-color, #edf0f3);
      }

      .ft-menu-divider {
        height:1px;
        background:var(--border-color, #e1e5eb);
        margin:6px 4px;
      }

      .ft-page-title {
        margin:0;
        font-size:23px;
        font-weight:750;
      }

      .ft-detail-row {
        display:flex;
        justify-content:space-between;
        gap:15px;
        padding:13px 0;
        border-bottom:1px solid var(--border-color, #e1e5eb);
      }

      .ft-detail-row:last-child {
        border-bottom:0;
      }

      .ft-detail-label {
        color:var(--text-muted, #718096);
        font-size:13px;
      }

      .ft-detail-value {
        font-size:14px;
        font-weight:650;
        text-align:right;
      }

      .ft-detail-photo {
        width:100%;
        max-height:450px;
        object-fit:contain;
        border-radius:12px;
        margin-top:15px;
        background:rgba(0,0,0,.04);
      }

      .ft-hidden {
        display:none !important;
      }

      @media(min-width:650px) {
        .ft-member-grid {
          grid-template-columns:repeat(2,minmax(0,1fr));
        }
      }
    `;

    document.head.appendChild(style);
  }

  // --------------------------------------------------
  // WORKOUT FORM
  // --------------------------------------------------

  function showWorkoutForm(member, slot) {
    const today = localDateString();
    const week = getWeekRange();

    const isFreeSport = slot.id === "free_sport";

    const fixedActivityType = slot.id.startsWith("gym")
      ? "gym"
      : slot.id === "run"
        ? "running"
        : null;

    const fixedActivityLabel = fixedActivityType
      ? activityLabel(fixedActivityType)
      : "";

    challengeCard.innerHTML = `
      <div class="ft-dashboard">
        <div class="ft-panel">
          <button class="ft-button ft-secondary" data-action="back">
            ← Torna alla dashboard
          </button>

          <h2 class="ft-heading" style="margin-top:18px;">
            ${escapeHtml(slot.title)}
          </h2>

          <p class="ft-subtitle">
            Registra il tuo allenamento e carica una prova fotografica.
          </p>

          <form id="ftWorkoutForm" class="ft-form">

            ${isFreeSport ? `
              <label>
                Tipo di attività
                <select name="activity_type" required>
                  <option value="" selected disabled>Seleziona attività</option>
                  ${activityOptions().map(option => `
                    <option value="${option[0]}">
                      ${option[1]}
                    </option>
                  `).join("")}
                </select>
              </label>
            ` : `
              <label>
                Tipo di attività
                <input type="text" value="${escapeHtml(fixedActivityLabel)}" disabled>
                <input type="hidden" name="activity_type" value="${fixedActivityType}">
              </label>
            `}

            <label>
              Data allenamento
              <input
                type="date"
                name="activity_date"
                min="${week.start}"
                max="${today}"
                value="${today}"
                required
              >
            </label>

            <label>
              Durata (minuti)
              <input
                type="number"
                name="duration_minutes"
                min="1"
                max="1440"
                placeholder="Es. 60"
                required
              >
            </label>

            <label>
              Distanza (km) - facoltativa
              <input
                type="number"
                name="distance_km"
                min="0"
                step="0.01"
                placeholder="Es. 5.5"
              >
            </label>

            <label>
              Note - facoltative
              <textarea name="notes" placeholder="Descrivi il tuo allenamento..."></textarea>
            </label>

            <label>
              Foto di prova
              <input
                type="file"
                name="proof"
                accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
                required
              >
            </label>

            <p class="ft-message">
              Formati supportati: JPG, PNG, WEBP e HEIC. Dimensione massima: 10 MB.
            </p>

            <p id="ftWorkoutError" class="ft-error"></p>

            <button class="ft-button ft-primary" type="submit">
              Carica allenamento
            </button>
          </form>
        </div>
      </div>
    `;

    const form = document.getElementById("ftWorkoutForm");

    form.addEventListener("submit", event => {
      submitWorkout(event, member, slot);
    });
  }

  async function submitWorkout(event, member, slot) {
    event.preventDefault();

    const form = event.currentTarget;
    const button = form.querySelector('button[type="submit"]');
    const errorBox = document.getElementById("ftWorkoutError");
    const formData = new FormData(form);

    const activityType = formData.get("activity_type");
    const activityDate = formData.get("activity_date");
    const duration = Number(formData.get("duration_minutes"));
    const distanceValue = formData.get("distance_km");
    const notes = String(formData.get("notes") || "").trim();
    const file = formData.get("proof");

    errorBox.textContent = "";

    if (!file || !file.size) {
      errorBox.textContent = "Seleziona una foto di prova.";
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      errorBox.textContent = "La foto supera il limite di 10 MB.";
      return;
    }

    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/heic",
      "image/heif"
    ];

    if (!allowedTypes.includes(file.type)) {
      errorBox.textContent = "Formato immagine non supportato.";
      return;
    }

    if (!duration || duration < 1 || duration > 1440) {
      errorBox.textContent = "Inserisci una durata valida.";
      return;
    }

    if (distanceValue && Number(distanceValue) < 0) {
      errorBox.textContent = "La distanza non può essere negativa.";
      return;
    }

    const week = getWeekRange();

    if (activityDate < week.start || activityDate > localDateString()) {
      errorBox.textContent = "La data deve appartenere alla settimana corrente e non essere futura.";
      return;
    }

    button.disabled = true;
    button.textContent = "Caricamento...";

    let uploadedPath = null;

    try {
      const extension = file.name.split(".").pop().toLowerCase();
      const fileName = `${crypto.randomUUID()}.${extension}`;
      uploadedPath = `${member.challenge_id}/${member.id}/${fileName}`;

      const { error: uploadError } = await client.storage
        .from(BUCKET)
        .upload(uploadedPath, file, {
          contentType: file.type,
          upsert: false
        });

      if (uploadError) throw uploadError;

      const workoutData = {
        challenge_id: member.challenge_id,
        member_id: member.id,
        session_slot: slot.id,
        activity_type: activityType,
        activity_date: activityDate,
        duration_minutes: duration,
        distance_km: distanceValue ? Number(distanceValue) : null,
        notes: notes || null,
        proof_path: uploadedPath
      };

      const { error: insertError } = await client
        .from("workout_entries")
        .insert(workoutData);

      if (insertError) throw insertError;

      alert("Allenamento caricato! Ora il tuo partner deve approvarlo.");
      selectedWorkoutId = null;
      currentView = "home";
      await loadDashboard(currentUser);

    } catch (error) {
      console.error("FIT TOGETHER upload error:", error);

      if (uploadedPath) {
        await client.storage.from(BUCKET).remove([uploadedPath]);
      }

      errorBox.textContent = error.message || "Errore durante il caricamento.";
      button.disabled = false;
      button.textContent = "Carica allenamento";
    }
  }

  // --------------------------------------------------
  // WORKOUT DETAILS
  // --------------------------------------------------

  async function renderWorkoutDetails(workout) {
    const member = currentMember;
    const isOwnWorkout = workout.member_id === member.id;
    const canDelete = isOwnWorkout && workout.status === "pending";

    let photoUrl = null;

    if (workout.proof_path) {
      const { data, error } = await client.storage
        .from(BUCKET)
        .createSignedUrl(workout.proof_path, 3600);

      if (error) {
        console.error("FIT TOGETHER photo error:", error);
      } else {
        photoUrl = data?.signedUrl || null;
      }
    }

    challengeCard.innerHTML = `
      <div class="ft-dashboard">
        <div class="ft-panel">

          <button class="ft-button ft-secondary" data-action="back">
            ← Torna alla dashboard
          </button>

          <h2 class="ft-heading" style="margin-top:18px;">
            Dettagli attività
          </h2>

          <p class="ft-subtitle">
            Riepilogo dell'allenamento caricato.
          </p>

          <div style="margin-top:20px;">
            <div class="ft-detail-row">
              <span class="ft-detail-label">Attività</span>
              <span class="ft-detail-value">${escapeHtml(activityLabel(workout.activity_type))}</span>
            </div>

            <div class="ft-detail-row">
              <span class="ft-detail-label">Data</span>
              <span class="ft-detail-value">${formatDate(workout.activity_date)}</span>
            </div>

            <div class="ft-detail-row">
              <span class="ft-detail-label">Durata</span>
              <span class="ft-detail-value">${Number(workout.duration_minutes || 0)} minuti</span>
            </div>

            <div class="ft-detail-row">
              <span class="ft-detail-label">Distanza</span>
              <span class="ft-detail-value">
                ${workout.distance_km !== null && workout.distance_km !== undefined
                  ? `${Number(workout.distance_km)} km`
                  : "Non indicata"}
              </span>
            </div>

            <div class="ft-detail-row">
              <span class="ft-detail-label">Stato</span>
              <span class="ft-detail-value">
                <span class="ft-status ${escapeHtml(workout.status)}">
                  ${escapeHtml(statusLabel(workout.status))}
                </span>
              </span>
            </div>

            <div class="ft-detail-row">
              <span class="ft-detail-label">Caricamento</span>
              <span class="ft-detail-value">${formatDateTime(workout.created_at)}</span>
            </div>
          </div>

          <h3 style="margin:22px 0 8px;">Note</h3>
          <p class="ft-message">
            ${workout.notes
              ? escapeHtml(workout.notes)
              : "Nessuna nota aggiunta."}
          </p>

          <h3 style="margin:22px 0 8px;">Foto di prova</h3>

          ${photoUrl ? `
            <a href="${escapeHtml(photoUrl)}" target="_blank" rel="noopener">
              <img
                class="ft-detail-photo"
                src="${escapeHtml(photoUrl)}"
                alt="Foto di prova dell'allenamento"
              >
            </a>
            <p class="ft-small">Tocca la foto per aprirla a dimensione originale.</p>
          ` : `
            <p class="ft-error">Foto non disponibile.</p>
          `}

          ${canDelete ? `
            <div style="margin-top:28px;padding-top:20px;border-top:1px solid var(--border-color,#e1e5eb);">
              <h3 style="margin:0 0 8px;">Elimina attività</h3>

              <p class="ft-message">
                Eliminando questa attività verranno cancellati anche i dati e la foto caricata.
                Lo slot tornerà disponibile e potrai caricare un nuovo allenamento.
              </p>

              <button
                class="ft-button ft-danger"
                style="width:100%;margin-top:10px;"
                data-action="delete-workout"
                data-id="${escapeHtml(workout.id)}"
              >
                Elimina attività
              </button>
            </div>
          ` : `
            <p class="ft-message" style="margin-top:25px;">
              ${workout.status === "approved"
                ? "Questo allenamento è già stato approvato e non può essere eliminato da questa schermata."
                : "Questa attività non può essere eliminata da questa schermata."}
            </p>
          `}
        </div>
      </div>
    `;
  }

  async function deleteWorkout(workoutId) {
    if (!confirm(
      "Vuoi davvero eliminare questo allenamento?\n\nI dati e la foto saranno cancellati e lo slot tornerà disponibile."
    )) {
      return;
    }

    try {
      const { data: deletedRows, error } = await client
        .from("workout_entries")
        .delete()
        .eq("id", workoutId)
        .eq("member_id", currentMember.id)
        .eq("status", "pending")
        .select("id, proof_path");

      if (error) throw error;

      if (!deletedRows || deletedRows.length === 0) {
        throw new Error(
          "Non è stato possibile eliminare l'attività. Verifica che sia ancora in attesa di approvazione."
        );
      }

      const proofPath = deletedRows[0].proof_path;

      if (proofPath) {
        const { error: storageError } = await client.storage
          .from(BUCKET)
          .remove([proofPath]);

        if (storageError) {
          console.error(
            "FIT TOGETHER: attività eliminata, ma errore nella cancellazione della foto:",
            storageError
          );
        }
      }

      alert("Attività eliminata. Ora puoi caricare un nuovo allenamento.");

      selectedWorkoutId = null;
      currentView = "home";

      await loadDashboard(currentUser);

    } catch (error) {
      console.error("FIT TOGETHER delete workout error:", error);
      alert("Errore durante l'eliminazione: " + error.message);
    }
  }

  // --------------------------------------------------
  // WORKOUT REVIEWS
  // --------------------------------------------------

  async function reviewWorkout(workoutId, approve) {
    const action = approve ? "approvare" : "rifiutare";

    if (!confirm(`Vuoi davvero ${action} questo allenamento?`)) return;

    try {
      const { error } = await client.rpc("review_workout", {
        p_workout_id: workoutId,
        p_approve: approve
      });

      if (error) throw error;

      await loadDashboard(currentUser);

    } catch (error) {
      console.error("FIT TOGETHER review error:", error);
      alert("Errore durante la revisione: " + error.message);
    }
  }

  async function renderPendingReviews(pendingWorkouts, members) {
    if (!pendingWorkouts.length) {
      return `
        <p class="ft-message">
          Non ci sono allenamenti da revisionare.
        </p>
      `;
    }

    const cards = await Promise.all(pendingWorkouts.map(async workout => {
      const member = members.find(item => item.id === workout.member_id);
      let photoUrl = null;

      if (workout.proof_path) {
        const { data } = await client.storage
          .from(BUCKET)
          .createSignedUrl(workout.proof_path, 3600);

        photoUrl = data?.signedUrl || null;
      }

      return `
        <div class="ft-review-card">
          <strong>${escapeHtml(member?.display_name || "Partner")}</strong>

          <p style="margin:8px 0 4px;">
            ${escapeHtml(activityLabel(workout.activity_type))}
            · ${formatDate(workout.activity_date)}
          </p>

          <p class="ft-message" style="margin:0;">
            ${Number(workout.duration_minutes || 0)} minuti
            ${workout.distance_km ? ` · ${Number(workout.distance_km)} km` : ""}
          </p>

          ${workout.notes ? `
            <p class="ft-message">${escapeHtml(workout.notes)}</p>
          ` : ""}

          ${photoUrl ? `
            <a href="${escapeHtml(photoUrl)}" target="_blank" rel="noopener">
              <img class="ft-review-photo" src="${escapeHtml(photoUrl)}" alt="Prova allenamento">
            </a>
          ` : `
            <p class="ft-error">Impossibile caricare la foto.</p>
          `}

          <div class="ft-review-actions">
            <button
              class="ft-button ft-approve-button"
              data-action="approve"
              data-id="${escapeHtml(workout.id)}"
            >
              ✓ Approva
            </button>

            <button
              class="ft-button ft-reject-button"
              data-action="reject"
              data-id="${escapeHtml(workout.id)}"
            >
              ✕ Rifiuta
            </button>
          </div>
        </div>
      `;
    }));

    return cards.join("");
  }

  // --------------------------------------------------
  // NOTIFICATIONS
  // --------------------------------------------------

  function renderNotifications(notifications) {
    if (!notifications.length) {
      return `<p class="ft-message">Non hai nuove notifiche.</p>`;
    }

    return notifications.map(notification => `
      <button
        type="button"
        class="ft-notification-item unread"
        style="display:block;width:100%;text-align:left;background:transparent;color:inherit;border:0;cursor:pointer;font:inherit;"
        data-action="open-notification"
        data-id="${escapeHtml(notification.id)}"
        data-type="${escapeHtml(notification.notification_type)}"
      >
        <div>${escapeHtml(notification.title || "Notifica")}</div>

        <p style="margin:5px 0;">
          ${escapeHtml(notification.message || "")}
        </p>

        <div class="ft-small">
          ${formatDateTime(notification.created_at)} · Nuova · Tocca per aprire
        </div>
      </button>
    `).join("");
  }

  async function markNotificationRead(notificationId) {
    const { error } = await client.rpc("mark_notification_read", {
      p_notification_id: notificationId
    });

    if (error) throw error;
  }

  // --------------------------------------------------
  // DASHBOARD
  // --------------------------------------------------

  async function renderDashboard(
    challenge,
    members,
    workouts,
    pendingWorkouts,
    notifications,
    ownMember,
    week
  ) {
    const workoutCounts = {};

    members.forEach(member => {
      workoutCounts[member.id] = workouts.filter(workout =>
        workout.member_id === member.id &&
        workout.status === "approved"
      ).length;
    });

    const approvedCount = workoutCounts[ownMember.id] || 0;
    const unreadCount = notifications.length;

    const memberCards = members.map(member => {
      const count = workoutCounts[member.id] || 0;
      const progress = Math.min(count, 3);
      const percentage = (progress / 3) * 100;

      const plan = member.weekly_plan === "runner"
        ? "2 palestre + corsa"
        : "2 palestre + sport libero";

      const isYou = member.id === ownMember.id;

      return `
        <div class="ft-panel">
          <div class="ft-member-name">
            <h3 style="margin:0;font-size:19px;">
              ${escapeHtml(member.display_name)}
            </h3>

            <span class="ft-status approved">
              ${isYou ? "TU" : "PARTNER"}
            </span>
          </div>

          <p class="ft-subtitle">${escapeHtml(plan)}</p>

          <div style="display:flex;justify-content:space-between;align-items:center;margin-top:18px;">
            <strong>Progresso settimanale</strong>
            <strong style="font-size:20px;">${count}/3</strong>
          </div>

          <div class="ft-progress">
            <div class="ft-progress-fill" style="width:${percentage}%;"></div>
          </div>

          <p class="ft-subtitle">
            ${count >= 3
              ? "Obiettivo settimanale raggiunto!"
              : `Ancora ${3 - count} allenamenti approvati`}
          </p>
        </div>
      `;
    }).join("");

    const ownSlots = getPlanSlots(ownMember.weekly_plan);

    const slotsHtml = ownSlots.map(slot => {
      const workout = getSlotWorkout(
        workouts.filter(item => item.member_id === ownMember.id),
        slot.id
      );

      const status = workout?.status || null;
      const displayStatus = !workout
        ? "Da caricare"
        : statusLabel(status);

      let actionHtml = "";
      let clickable = false;

      if (status === "approved" || status === "pending") {
        clickable = true;

        actionHtml = `
          <span class="ft-status ${status}">
            ${status === "pending" ? "Caricata" : "Approvata"}
          </span>
        `;
      } else {
        actionHtml = `
          <button
            class="ft-button ft-primary"
            data-action="upload"
            data-slot="${slot.id}"
          >
            ${status === "rejected" ? "Riprova" : "Carica"}
          </button>
        `;
      }

      return `
        <div
          class="ft-slot ${clickable ? "clickable" : ""}"
          ${clickable ? `
            data-action="view-workout"
            data-id="${escapeHtml(workout.id)}"
            role="button"
            tabindex="0"
            aria-label="Apri dettagli ${escapeHtml(slot.title)}"
          ` : ""}
        >
          <div class="ft-slot-icon">${slot.icon}</div>

          <div class="ft-slot-info">
            <p class="ft-slot-title">${escapeHtml(slot.title)}</p>
            <p class="ft-slot-detail">${escapeHtml(displayStatus)}</p>
          </div>

          ${actionHtml}
        </div>
      `;
    }).join("");

    let pageContent = "";

    if (currentView === "workout-detail") {
      const workout = workouts.find(item => item.id === selectedWorkoutId);

      if (!workout) {
        pageContent = `
          <div class="ft-panel">
            <p class="ft-message">Attività non trovata.</p>
            <button class="ft-button ft-secondary" data-action="back">
              ← Torna alla dashboard
            </button>
          </div>
        `;
      } else {
        await renderWorkoutDetails(workout);
        return;
      }

    } else if (currentView === "reviews") {
      const pendingHtml = await renderPendingReviews(pendingWorkouts, members);

      pageContent = `
        <div class="ft-panel">
          <div class="ft-toolbar">
            <div>
              <h2 class="ft-page-title">Reviews</h2>
              <p class="ft-subtitle">
                Controlla gli allenamenti caricati dal tuo partner.
              </p>
            </div>

            <span class="ft-status ${pendingWorkouts.length ? "pending" : "approved"}">
              ${pendingWorkouts.length} da revisionare
            </span>
          </div>

          ${pendingHtml}
        </div>
      `;

    } else {
      pageContent = `
        <div class="ft-panel">
          <h3 style="margin:0 0 7px;">La vostra settimana</h3>

          <p class="ft-subtitle">
            ${formatDate(week.start)} – ${formatDate(week.end)}
          </p>

          <p style="margin:13px 0 0;">
            Ogni partecipante deve completare 3 allenamenti approvati.
          </p>

          <div style="margin-top:14px;">
            <strong>Il tuo progresso: ${approvedCount}/3</strong>

            <div class="ft-progress">
              <div class="ft-progress-fill" style="width:${Math.min(approvedCount, 3) / 3 * 100}%;"></div>
            </div>
          </div>
        </div>

        <div>
          <h3 class="ft-heading" style="font-size:19px;">I tuoi obiettivi</h3>

          <p class="ft-subtitle">
            Carica i tuoi allenamenti e attendi l'approvazione del partner.
          </p>

          ${slotsHtml}
        </div>

        <div>
          <h3 class="ft-heading" style="font-size:19px;">
            Progresso di entrambi
          </h3>

          <div class="ft-member-grid" style="margin-top:12px;">
            ${memberCards}
          </div>
        </div>
      `;
    }

    challengeCard.innerHTML = `
      <div class="ft-dashboard">

        <div class="ft-toolbar">
          <div>
            <p class="ft-subtitle">LA VOSTRA SFIDA</p>

            <h2 class="ft-heading">
              ${escapeHtml(challenge.name || "FIT TOGETHER")}
            </h2>

            <p class="ft-subtitle">
              Ciao ${escapeHtml(ownMember.display_name)}!
            </p>
          </div>

          <div class="ft-toolbar-right">

            <div class="ft-notification-area">
              <button
                class="ft-bell-button"
                data-action="toggle-notifications"
                aria-label="Notifiche"
              >
                🔔
                ${unreadCount
                  ? `<span class="ft-bell-count">${unreadCount}</span>`
                  : ""}
              </button>
            </div>

            <div class="ft-menu-area">
              <button
                class="ft-menu-button"
                data-action="toggle-menu"
                aria-label="Apri menu"
                aria-expanded="false"
              >
                ☰
              </button>

              <div id="ftMenu" class="ft-menu-panel ft-hidden">

                <button
                  class="ft-menu-item ${currentView === "home" ? "active" : ""}"
                  data-action="nav-home"
                >
                  ⌂ Homepage
                </button>

                <button
                  class="ft-menu-item ${currentView === "reviews" ? "active" : ""}"
                  data-action="nav-reviews"
                >
                  ✓ Reviews${pendingWorkouts.length
                    ? ` (${pendingWorkouts.length})`
                    : ""}
                </button>

                <div class="ft-menu-divider"></div>

                <button class="ft-menu-item" data-action="logout">
                  ↪ Esci
                </button>

              </div>
            </div>

          </div>
        </div>

        <div id="ftNotifications" class="ft-panel ft-hidden">
          <div class="ft-toolbar">
            <h3 style="margin:0;">Nuove notifiche</h3>

            <button class="ft-button ft-secondary" data-action="refresh">
              Aggiorna
            </button>
          </div>

          ${renderNotifications(notifications)}
        </div>

        ${pageContent}

      </div>
    `;
  }

  // --------------------------------------------------
  // LOAD DATA
  // --------------------------------------------------

  async function loadDashboard(user) {
    if (loading) return;

    loading = true;
    currentUser = user;

    showMessage(
      "CARICAMENTO...",
      "Stiamo preparando la vostra dashboard."
    );

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

      currentMember = ownMember;

      const { data: challenge, error: challengeError } = await client
        .from("challenges")
        .select("*")
        .eq("id", ownMember.challenge_id)
        .single();

      if (challengeError) throw challengeError;

      currentChallenge = challenge;

      const week = getWeekRange();

      const [
        membersResult,
        workoutsResult,
        pendingResult,
        notificationsResult
      ] = await Promise.all([
        client
          .from("challenge_members")
          .select("id, display_name, weekly_plan, user_id, joined_at")
          .eq("challenge_id", ownMember.challenge_id)
          .order("joined_at", { ascending: true }),

        client
          .from("workout_entries")
          .select("id, member_id, session_slot, activity_type, activity_date, duration_minutes, distance_km, notes, proof_path, status, created_at")
          .eq("challenge_id", ownMember.challenge_id)
          .gte("activity_date", week.start)
          .lte("activity_date", week.end),

        client
          .from("workout_entries")
          .select("id, member_id, session_slot, activity_type, activity_date, duration_minutes, distance_km, notes, proof_path, status, created_at")
          .eq("challenge_id", ownMember.challenge_id)
          .eq("status", "pending")
          .neq("member_id", ownMember.id)
          .gte("activity_date", week.start)
          .lte("activity_date", week.end),

        client
          .from("notifications")
          .select("id, title, message, notification_type, workout_id, is_read, created_at")
          .eq("recipient_id", user.id)
          .eq("is_read", false)
          .order("created_at", { ascending: false })
          .limit(20)
      ]);

      if (membersResult.error) throw membersResult.error;
      if (workoutsResult.error) throw workoutsResult.error;
      if (pendingResult.error) throw pendingResult.error;
      if (notificationsResult.error) throw notificationsResult.error;

      await renderDashboard(
        challenge,
        membersResult.data || [],
        workoutsResult.data || [],
        pendingResult.data || [],
        notificationsResult.data || [],
        ownMember,
        week
      );

      console.log("FIT TOGETHER: dashboard caricata.");
      console.log("Partecipanti:", membersResult.data);
      console.log("Allenamenti:", workoutsResult.data);
      console.log("Da revisionare:", pendingResult.data);
      console.log("Notifiche:", notificationsResult.data);

      if (notificationRefreshTimer) {
        clearInterval(notificationRefreshTimer);
      }

      notificationRefreshTimer = setInterval(() => {
        const workoutFormOpen = document.getElementById("ftWorkoutForm");

        if (currentUser && !loading && !workoutFormOpen) {
          loadDashboard(currentUser);
        }
      }, 30000);

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

  // --------------------------------------------------
  // EVENT HANDLING
  // --------------------------------------------------

  challengeCard.addEventListener("click", async event => {
    const button = event.target.closest("[data-action]");
    if (!button) return;

    const action = button.dataset.action;

    if (action === "toggle-menu") {
      const menu = document.getElementById("ftMenu");

      if (menu) {
        menu.classList.toggle("ft-hidden");

        button.setAttribute(
          "aria-expanded",
          String(!menu.classList.contains("ft-hidden"))
        );
      }

      return;
    }

    if (action === "nav-home") {
      currentView = "home";
      selectedWorkoutId = null;
      await loadDashboard(currentUser);
      return;
    }

    if (action === "nav-reviews") {
      currentView = "reviews";
      selectedWorkoutId = null;
      await loadDashboard(currentUser);
      return;
    }

    if (action === "open-notification") {
      try {
        const notificationType = button.dataset.type;

        await markNotificationRead(button.dataset.id);

        if (isReviewNotification({
          notification_type: notificationType
        })) {
          currentView = "reviews";
          selectedWorkoutId = null;
        }

        await loadDashboard(currentUser);

      } catch (error) {
        console.error("FIT TOGETHER notification error:", error);
        alert("Errore durante l'apertura della notifica: " + error.message);
      }

      return;
    }

    if (action === "toggle-notifications") {
      const panel = document.getElementById("ftNotifications");

      if (panel) {
        panel.classList.toggle("ft-hidden");
      }

      return;
    }

    if (action === "view-workout") {
      selectedWorkoutId = button.dataset.id;
      currentView = "workout-detail";
      await loadDashboard(currentUser);
      return;
    }

    if (action === "delete-workout") {
      await deleteWorkout(button.dataset.id);
      return;
    }

    if (action === "logout") {
      const { error } = await client.auth.signOut();

      if (error) {
        alert("Errore durante la disconnessione: " + error.message);
        return;
      }

      if (notificationRefreshTimer) {
        clearInterval(notificationRefreshTimer);
      }

      window.location.reload();
      return;
    }

    if (action === "refresh") {
      await loadDashboard(currentUser);
      return;
    }

    if (action === "back") {
      selectedWorkoutId = null;
      currentView = "home";
      await loadDashboard(currentUser);
      return;
    }

    if (action === "upload") {
      const slot = getPlanSlots(currentMember.weekly_plan)
        .find(item => item.id === button.dataset.slot);

      if (slot) {
        showWorkoutForm(currentMember, slot);
      }

      return;
    }

    if (action === "approve") {
      await reviewWorkout(button.dataset.id, true);
      return;
    }

    if (action === "reject") {
      await reviewWorkout(button.dataset.id, false);
      return;
    }
  });

  // --------------------------------------------------
  // KEYBOARD ACCESSIBILITY FOR WORKOUT CARDS
  // --------------------------------------------------

  challengeCard.addEventListener("keydown", event => {
    if (
      (event.key === "Enter" || event.key === " ") &&
      event.target.matches(".ft-slot[data-action='view-workout']")
    ) {
      event.preventDefault();
      event.target.click();
    }
  });

  // --------------------------------------------------
  // AUTHENTICATION
  // --------------------------------------------------

  injectStyles();

  client.auth.onAuthStateChange((event, session) => {
    if (session?.user) {
      setTimeout(() => loadDashboard(session.user), 0);
    } else {
      currentView = "home";
      selectedWorkoutId = null;

      if (notificationRefreshTimer) {
        clearInterval(notificationRefreshTimer);
        notificationRefreshTimer = null;
      }
    }
  });

  client.auth.getSession().then(({ data, error }) => {
    if (error) {
      console.error("FIT TOGETHER session error:", error);
      return;
    }

    if (data.session?.user) {
      loadDashboard(data.session.user);
    }
  });

})();
