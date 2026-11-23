
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
        icon: "💪"
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
      ["walking", "Camminata"],
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
      pending: "In attesa",
      rejected: "Rifiutato"
    };

    return labels[status] || status || "Sconosciuto";
  }

  function getSlotWorkout(workouts, slotId) {
    return workouts
      .filter(workout => workout.session_slot === slotId)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];
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

      .ft-primary {
        background:#168b68;
        color:white;
      }

      .ft-secondary {
        background:transparent;
        border:1px solid var(--border-color, #d5dbe2);
        color:inherit;
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

      .ft-approve-button {
        background:#168b68;
        color:white;
      }

      .ft-reject-button {
        background:#b42332;
        color:white;
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

      .ft-notification-panel {
        border:1px solid var(--border-color, #e1e5eb);
        border-radius:13px;
        padding:13px;
        margin-top:10px;
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
            <label>
              Tipo di attività
              <select name="activity_type" required>
                ${activityOptions().map(option => `
                  <option value="${option[0]}" ${option[0] === (slot.id.startsWith("gym") ? "gym" : slot.id === "run" ? "running" : "") ? "selected" : ""}>
                    ${option[1]}
                  </option>
                `).join("")}
              </select>
            </label>

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
      return `<p class="ft-message">Nessuna notifica.</p>`;
    }

    return notifications.map(notification => `
      <div class="ft-notification-item ${notification.is_read ? "" : "unread"}">
        <div>${escapeHtml(notification.title || "Notifica")}</div>

        <p style="margin:5px 0;">
          ${escapeHtml(notification.message || "")}
        </p>

        <div class="ft-small">
          ${formatDateTime(notification.created_at)}
          ${notification.is_read ? "" : " · Nuova"}
        </div>

        ${!notification.is_read ? `
          <button
            class="ft-button ft-secondary"
            style="margin-top:7px;padding:6px 9px;"
            data-action="read-notification"
            data-id="${escapeHtml(notification.id)}"
          >
            Segna come letta
          </button>
        ` : ""}
      </div>
    `).join("");
  }

  async function markNotificationRead(notificationId) {
    try {
      const { error } = await client.rpc("mark_notification_read", {
        p_notification_id: notificationId
      });

      if (error) throw error;

      await loadDashboard(currentUser);

    } catch (error) {
      console.error("FIT TOGETHER notification error:", error);
      alert("Errore durante l'aggiornamento della notifica: " + error.message);
    }
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
    const unreadCount = notifications.filter(item => !item.is_read).length;

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

          <div style="
            display:flex;
            justify-content:space-between;
            align-items:center;
            margin-top:18px;
          ">
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

      let actionHtml = "";

      if (status === "approved") {
        actionHtml = `<span class="ft-status approved">Approvato</span>`;
      } else if (status === "pending") {
        actionHtml = `<span class="ft-status pending">In attesa</span>`;
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
        <div class="ft-slot">
          <div class="ft-slot-icon">${slot.icon}</div>

          <div class="ft-slot-info">
            <p class="ft-slot-title">${escapeHtml(slot.title)}</p>

            <p class="ft-slot-detail">
              ${status
                ? `${statusLabel(status)}${workout?.activity_date ? " · " + formatDate(workout.activity_date) : ""}`
                : escapeHtml(slot.description)}
            </p>
          </div>

          ${actionHtml}
        </div>
      `;
    }).join("");

    const pendingHtml = await renderPendingReviews(
      pendingWorkouts,
      members
    );

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

          <div style="display:flex;gap:9px;align-items:center;">
            <div class="ft-notification-area">
              <button
                class="ft-bell-button"
                data-action="toggle-notifications"
                aria-label="Notifiche"
              >
                🔔
                ${unreadCount ? `
                  <span class="ft-bell-count">${unreadCount}</span>
                ` : ""}
              </button>
            </div>

            <button class="ft-button ft-secondary" data-action="logout">
              Esci
            </button>
          </div>
        </div>

        <div id="ftNotifications" class="ft-panel ft-hidden">
          <div class="ft-toolbar">
            <h3 style="margin:0;">Notifiche</h3>
            <button
              class="ft-button ft-secondary"
              data-action="refresh"
            >
              Aggiorna
            </button>
          </div>

          ${renderNotifications(notifications)}
        </div>

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
              <div
                class="ft-progress-fill"
                style="width:${Math.min(approvedCount, 3) / 3 * 100}%;"
              ></div>
            </div>
          </div>
        </div>

        <div>
          <h3 class="ft-heading" style="font-size:19px;">
            I tuoi obiettivi
          </h3>

          <p class="ft-subtitle">
            Carica i tuoi allenamenti e attendi l'approvazione del partner.
          </p>

          ${slotsHtml}
        </div>

        <div>
          <h3 class="ft-heading" style="font-size:19px;">
            Da revisionare
          </h3>

          <p class="ft-subtitle">
            Approva o rifiuta gli allenamenti caricati dal partner.
          </p>

          ${pendingHtml}
        </div>

        <div>
          <h3 class="ft-heading" style="font-size:19px;">
            Progresso di entrambi
          </h3>

          <div class="ft-member-grid" style="margin-top:12px;">
            ${memberCards}
          </div>
        </div>

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
          .select("id, member_id, session_slot, activity_type, activity_date, duration_minutes, distance_km, status, created_at")
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
          .eq("recipient_id", ownMember.id)
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
        if (currentUser && !loading) {
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
    }

    if (action === "refresh") {
      await loadDashboard(currentUser);
    }

    if (action === "back") {
      await loadDashboard(currentUser);
    }

    if (action === "upload") {
      const slot = getPlanSlots(currentMember.weekly_plan)
        .find(item => item.id === button.dataset.slot);

      if (slot) {
        showWorkoutForm(currentMember, slot);
      }
    }

    if (action === "approve") {
      await reviewWorkout(button.dataset.id, true);
    }

    if (action === "reject") {
      await reviewWorkout(button.dataset.id, false);
    }

    if (action === "read-notification") {
      await markNotificationRead(button.dataset.id);
    }

    if (action === "toggle-notifications") {
      const panel = document.getElementById("ftNotifications");

      if (panel) {
        panel.classList.toggle("ft-hidden");
      }
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
