(() => {
  "use strict";

  const client = window.fitTogetherSupabase;
  const BUCKET = "fit-together-proofs";
  const MAX_FILE_SIZE = 10 * 1024 * 1024;
  const WEIGHT_BUCKET = "fit-together-weight-proofs";

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
  let workoutDetailReturnView = "home";

  let historyMode = "list";
  let historyYear = null;
  let historyMonth = null;
  let historyWeek = null;

  // Filtri della sezione Statistiche sport
  let statsPeriod = "year";
  let statsYear = new Date().getFullYear();
  let statsMonth = new Date().getMonth() + 1;
  let statsWeek = getISOWeekInfo(localDateString()).week;

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

  function getISOWeekInfo(value) {
    const date = new Date(`${value}T12:00:00`);
    const day = (date.getDay() + 6) % 7;

    date.setDate(date.getDate() - day + 3);

    const isoYear = date.getFullYear();
    const firstThursday = new Date(isoYear, 0, 4);
    const firstDay = (firstThursday.getDay() + 6) % 7;

    firstThursday.setDate(firstThursday.getDate() - firstDay + 3);

    const week = 1 + Math.round(
      (date - firstThursday) / 604800000
    );

    return { year: isoYear, week };
  }

  function getISOWeekRange(year, week) {
    const jan4 = new Date(year, 0, 4, 12);
    const day = (jan4.getDay() + 6) % 7;

    const monday = new Date(jan4);
    monday.setDate(jan4.getDate() - day + (week - 1) * 7);

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
    const type = String(
      notification.notification_type || ""
    ).toLowerCase();

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

      .ft-history-controls {
        display:grid;
        grid-template-columns:repeat(3,minmax(0,1fr));
        gap:9px;
        margin:18px 0;
      }

      .ft-history-controls label {
        display:grid;
        gap:6px;
        font-size:12px;
        font-weight:700;
      }

      .ft-history-controls select {
        min-width:0;
        width:100%;
        padding:10px 7px;
        border:1px solid var(--border-color,#d5dbe2);
        border-radius:9px;
        background:var(--card-bg,#fff);
        color:inherit;
      }

      .ft-mode-switch {
        display:flex;
        gap:8px;
        margin:15px 0;
      }

      .ft-mode-switch .active {
        background:#168b68;
        color:white;
        border-color:#168b68;
      }

      .ft-history-scroll {
        max-height:390px;
        overflow-y:auto;
        overscroll-behavior:contain;
        border-top:1px solid var(--border-color,#e1e5eb);
        border-bottom:1px solid var(--border-color,#e1e5eb);
        border-radius:8px;
      }

      .ft-history-scroll::-webkit-scrollbar {
        width:7px;
      }

      .ft-history-scroll::-webkit-scrollbar-thumb {
        background:#aeb8c2;
        border-radius:10px;
      }

      .ft-history-item {
        display:flex;
        align-items:center;
        gap:12px;
        width:100%;
        padding:14px 4px;
        border:0;
        border-bottom:1px solid var(--border-color,#e1e5eb);
        background:transparent;
        color:inherit;
        text-align:left;
        cursor:pointer;
      }

      .ft-history-item:last-child {
        border-bottom:0;
      }

      .ft-history-icon {
        font-size:24px;
        width:34px;
        text-align:center;
        flex-shrink:0;
      }

      .ft-history-main {
        flex:1;
        min-width:0;
      }

      .ft-history-meta {
        display:block;
        color:var(--text-muted,#718096);
        font-size:12px;
        margin-top:4px;
      }

      .ft-history-group {
        margin-top:18px;
      }

      /* TIMELINE ORIZZONTALE */

      .ft-panel:has(#ftTimelineScroll) {
        width:100%;
        max-width:100%;
        min-width:0;
        box-sizing:border-box;
        overflow:hidden;
      }

      .ft-timeline-scroll {
        display:block;
        width:100%;
        max-width:100%;
        min-width:0;
        box-sizing:border-box;
        overflow-x:auto;
        overflow-y:hidden;
        padding-bottom:10px;
        -webkit-overflow-scrolling:touch;
        overscroll-behavior-x:contain;
        touch-action:pan-x;
        scrollbar-width:auto;
        scrollbar-color:#89949f #e8edf0;
      }

      .ft-timeline-scroll::-webkit-scrollbar {
        height:8px;
      }

      .ft-timeline-scroll::-webkit-scrollbar-track {
        background:#e8edf0;
        border-radius:10px;
      }

      .ft-timeline-scroll::-webkit-scrollbar-thumb {
        background:#89949f;
        border-radius:10px;
      }

      .ft-timeline-scroll::-webkit-scrollbar-thumb:hover {
        background:#66727e;
      }

      .ft-timeline-content {
        width:max-content;
        min-width:100%;
      }

      .ft-timeline-months {
        display:flex;
        width:max-content;
        min-width:100%;
        margin:18px 0 5px;
        color:var(--text-muted,#718096);
        font-size:10px;
        text-align:center;
      }

      .ft-timeline-month {
        flex:0 0 auto;
        box-sizing:border-box;
        white-space:nowrap;
        overflow:hidden;
      }

      .ft-week-timeline {
        display:flex;
        flex-wrap:nowrap;
        width:max-content;
        min-width:100%;
        gap:7px;
        box-sizing:border-box;
        padding:8px 2px 14px;
      }

      .ft-week-chip {
        box-sizing:border-box;
        flex:0 0 86px;
        width:86px;
        min-width:86px;
        min-height:72px;
        border:1px solid var(--border-color,#d5dbe2);
        border-radius:12px;
        padding:8px 5px;
        background:transparent;
        color:inherit;
        cursor:pointer;
        display:flex;
        flex-direction:column;
        justify-content:center;
        align-items:center;
        gap:4px;
      }

      .ft-week-chip strong {
        font-size:14px;
      }

      .ft-week-chip span {
        font-size:10px;
        color:var(--text-muted,#718096);
        white-space:nowrap;
      }

      .ft-week-chip.active {
        background:#168b68;
        color:white;
        border-color:#168b68;
      }

      .ft-week-chip.active span {
        color:rgba(255,255,255,.85);
      }

      /* STATISTICHE SPORT */

      .ft-stats-kpis {
        display:grid;
        grid-template-columns:repeat(2,minmax(0,1fr));
        gap:10px;
        margin-top:16px;
      }

      .ft-stats-kpi {
        min-width:0;
        padding:14px;
        border:1px solid var(--border-color,#e1e5eb);
        border-radius:13px;
      }

      .ft-stats-kpi-label {
        color:var(--text-muted,#718096);
        font-size:11px;
        line-height:1.35;
      }

      .ft-stats-kpi-value {
        margin-top:7px;
        font-size:25px;
        font-weight:800;
        line-height:1.1;
      }

      .ft-stats-chart {
        width:100%;
        overflow:hidden;
        margin-top:12px;
      }

      .ft-stats-chart svg {
        display:block;
        width:100%;
        height:auto;
      }

      .ft-pie-layout {
        display:flex;
        align-items:center;
        gap:20px;
        flex-wrap:wrap;
        margin-top:16px;
      }

      .ft-pie-chart {
        width:150px;
        height:150px;
        flex:0 0 150px;
        border-radius:50%;
      }

      .ft-pie-legend {
        display:grid;
        gap:9px;
        flex:1;
        min-width:135px;
      }

      .ft-pie-legend-item {
        display:flex;
        align-items:center;
        gap:8px;
        font-size:12px;
      }

      .ft-pie-dot {
        width:10px;
        height:10px;
        border-radius:50%;
        flex:0 0 10px;
      }

      .ft-pie-label {
        flex:1;
        min-width:0;
      }

      .ft-stats-note {
        color:var(--text-muted,#718096);
        font-size:11px;
        line-height:1.45;
        margin-top:12px;
      }

      @media(max-width:420px) {
        .ft-pie-layout {
          gap:14px;
        }

        .ft-pie-chart {
          width:125px;
          height:125px;
          flex-basis:125px;
        }
      }

      .ft-rule-card {
        padding:17px;
        border:1px solid var(--border-color,#e1e5eb);
        border-radius:14px;
        margin-top:12px;
      }

      .ft-rule-card h3 {
        margin:0 0 8px;
        font-size:16px;
      }

      .ft-rule-card p {
        margin:0;
        line-height:1.55;
        font-size:14px;
      }

      .ft-rule-card.success {
        background:rgba(48,181,139,.09);
      }

      .ft-rule-card.warning {
        background:rgba(245,181,55,.11);
      }

      .ft-rule-card.info {
        background:rgba(70,140,220,.10);
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

  function renderNotifications(notifications, extraHtml = "") {
    if (!notifications.length && !extraHtml) {
      return `<p class="ft-message">Non hai nuove notifiche.</p>`;
    }

    return extraHtml + notifications.map(notification => `
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
  // SPORT STATISTICS
  // --------------------------------------------------

  function addDaysToDate(value, days) {
    const date = new Date(`${value}T12:00:00`);
    date.setDate(date.getDate() + days);
    return localDateString(date);
  }

  function getStatsRange() {
    const year = Number(statsYear) || new Date().getFullYear();

    if (statsPeriod === "month") {
      const month = Math.min(12, Math.max(1, Number(statsMonth) || 1));
      const startDate = new Date(year, month - 1, 1, 12);
      const endDate = new Date(year, month, 0, 12);

      return {
        start: localDateString(startDate),
        end: localDateString(endDate)
      };
    }

    if (statsPeriod === "week") {
      const maxWeek = getISOWeekInfo(`${year}-12-28`).week;
      const week = Math.min(maxWeek, Math.max(1, Number(statsWeek) || 1));
      return getISOWeekRange(year, week);
    }

    return {
      start: `${year}-01-01`,
      end: `${year}-12-31`
    };
  }

  function renderStatsLineChart(points) {
    if (!points.length) {
      return `<p class="ft-message">Nessuna attività approvata nel periodo selezionato.</p>`;
    }

    const width = 680;
    const height = 230;
    const left = 38;
    const right = 16;
    const top = 18;
    const bottom = 42;
    const plotWidth = width - left - right;
    const plotHeight = height - top - bottom;
    const maxValue = Math.max(1, ...points.map(point => point.value));
    const stepX = points.length > 1 ? plotWidth / (points.length - 1) : 0;

    const coordinates = points.map((point, index) => {
      const x = points.length > 1 ? left + index * stepX : left + plotWidth / 2;
      const y = top + plotHeight - (point.value / maxValue) * plotHeight;
      return { x, y, ...point };
    });

    const polyline = coordinates
      .map(point => `${point.x},${point.y}`)
      .join(" ");

    const labelEvery = Math.max(1, Math.ceil(points.length / 7));

    const grid = Array.from({ length: 4 }, (_, index) => {
      const value = Math.round(maxValue * (3 - index) / 3);
      const y = top + (plotHeight / 3) * index;

      return `
        <line x1="${left}" y1="${y}" x2="${width - right}" y2="${y}"
          stroke="var(--border-color,#e1e5eb)" stroke-dasharray="3 4"/>
        <text x="${left - 9}" y="${y + 4}" text-anchor="end"
          font-size="10" fill="var(--text-muted,#718096)">${value}</text>
      `;
    }).join("");

    const dots = coordinates.map(point => `
      <circle cx="${point.x}" cy="${point.y}" r="3.5"
        fill="#168b68" stroke="var(--card-bg,#fff)" stroke-width="1.5">
        <title>${escapeHtml(point.label)}: ${point.value} attività</title>
      </circle>
    `).join("");

    const labels = coordinates.map((point, index) => {
      if (
        index % labelEvery !== 0 &&
        index !== coordinates.length - 1
      ) return "";

      return `
        <text x="${point.x}" y="${height - 13}" text-anchor="middle"
          font-size="10" fill="var(--text-muted,#718096)">
          ${escapeHtml(point.label)}
        </text>
      `;
    }).join("");

    return `
      <div class="ft-stats-chart">
        <svg viewBox="0 0 ${width} ${height}" role="img"
          aria-label="Andamento delle attività approvate">
          ${grid}
          <polyline points="${polyline}" fill="none" stroke="#168b68"
            stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
          ${dots}
          ${labels}
        </svg>
      </div>
    `;
  }

  function renderStatsPieChart(workouts) {
    const palette = [
      "#168b68", "#3979c6", "#e6a23c", "#8b65bd",
      "#d45d79", "#4b9da8", "#8b929b"
    ];

    const grouped = {};

    workouts
      .filter(workout => workout.status === "approved")
      .forEach(workout => {
        const type = workout.activity_type || "other";
        grouped[type] = (grouped[type] || 0) + 1;
      });

    const entries = Object.entries(grouped)
      .sort((a, b) => b[1] - a[1]);

    const total = entries.reduce((sum, item) => sum + item[1], 0);

    if (!total) {
      return `<p class="ft-message">Non ci sono ancora attività approvate da rappresentare.</p>`;
    }

    let cumulative = 0;
    const stops = entries.map(([type, count], index) => {
      const start = cumulative / total * 100;
      cumulative += count;
      const end = cumulative / total * 100;
      return `${palette[index % palette.length]} ${start}% ${end}%`;
    });

    const legend = entries.map(([type, count], index) => `
      <div class="ft-pie-legend-item">
        <span class="ft-pie-dot" style="background:${palette[index % palette.length]}"></span>
        <span class="ft-pie-label">${escapeHtml(activityLabel(type))}</span>
        <strong>${Math.round(count / total * 100)}%</strong>
      </div>
    `).join("");

    return `
      <div class="ft-pie-layout">
        <div class="ft-pie-chart"
          style="background:conic-gradient(${stops.join(",")});"
          role="img" aria-label="Distribuzione delle attività approvate">
        </div>
        <div class="ft-pie-legend">${legend}</div>
      </div>
    `;
  }

  function buildStatsTrend(workouts, range) {
    const approved = workouts.filter(workout =>
      workout.status === "approved" &&
      workout.activity_date >= range.start &&
      workout.activity_date <= range.end
    );

    const points = [];

    if (statsPeriod === "year") {
      const monthLabels = [
        "Gen", "Feb", "Mar", "Apr", "Mag", "Giu",
        "Lug", "Ago", "Set", "Ott", "Nov", "Dic"
      ];

      for (let month = 1; month <= 12; month++) {
        const value = approved.filter(workout =>
          Number(workout.activity_date.slice(5, 7)) === month
        ).length;

        points.push({ label: monthLabels[month - 1], value });
      }

    } else {
      const start = new Date(`${range.start}T12:00:00`);
      const end = new Date(`${range.end}T12:00:00`);
      const dayLabels = ["Dom", "Lun", "Mar", "Mer", "Gio", "Ven", "Sab"];

      for (
        let date = new Date(start);
        date <= end;
        date.setDate(date.getDate() + 1)
      ) {
        const dateString = localDateString(date);
        const value = approved.filter(workout =>
          workout.activity_date === dateString
        ).length;

        const label = statsPeriod === "week"
          ? dayLabels[date.getDay()]
          : String(date.getDate());

        points.push({ label, value });
      }
    }

    return { approved, points };
  }

  // Calcolo di sessioni completate / saltate / in attesa.
  // - Si parte dalla settimana più antica tra iscrizione e primo allenamento registrato.
  // - Le settimane concluse contano come "saltate" se lo slot non ha un allenamento approvato.
  // - La settimana in corso conta solo le sessioni completate o in attesa:
  //   le sessioni mancanti non sono ancora considerate saltate.
  function calculateMissedSessions(allWorkouts, ownMember, range) {
    const currentWeekStart = getWeekRange().start;

    const candidates = [];

    if (ownMember.joined_at) {
      candidates.push(localDateString(new Date(ownMember.joined_at)));
    }

    allWorkouts.forEach(workout => {
      if (workout.activity_date) candidates.push(workout.activity_date);
    });

    const firstDate = candidates.length
      ? candidates.sort()[0]
      : currentWeekStart;

    const firstInfo = getISOWeekInfo(firstDate);
    let monday = getISOWeekRange(firstInfo.year, firstInfo.week).start;

    const result = {
      completed: 0,
      missed: 0,
      pending: 0,
      weeks: 0
    };

    while (monday <= currentWeekStart) {
      const info = getISOWeekInfo(monday);
      const weekRange = getISOWeekRange(info.year, info.week);
      const sunday = weekRange.end;
      const isCurrentWeek = weekRange.start === currentWeekStart;

      let includeWeek = sunday >= range.start && sunday <= range.end;

      if (statsPeriod === "week") {
        includeWeek = includeWeek &&
          info.year === Number(statsYear) &&
          info.week === Number(statsWeek);
      }

      if (statsPeriod === "month") {
        includeWeek = includeWeek &&
          Number(sunday.slice(5, 7)) === Number(statsMonth) &&
          Number(sunday.slice(0, 4)) === Number(statsYear);
      }

      if (includeWeek) {
        result.weeks++;

        getPlanSlots(ownMember.weekly_plan).forEach(slot => {
          const slotEntries = allWorkouts.filter(workout =>
            workout.session_slot === slot.id &&
            workout.activity_date >= weekRange.start &&
            workout.activity_date <= weekRange.end
          );

          if (slotEntries.some(item => item.status === "approved")) {
            result.completed++;
          } else if (slotEntries.some(item => item.status === "pending")) {
            result.pending++;
          } else if (!isCurrentWeek) {
            result.missed++;
          }
        });
      }

      monday = addDaysToDate(monday, 7);
    }

    return result;
  }

  // --------------------------------------------------
  // FITNESS GOAL (PESO SETTIMANALE)
  // --------------------------------------------------

  function fmtKg(value) {
    return Number(value).toFixed(1).replace(".", ",");
  }

  function renderWeightChart(entries, goal) {
    if (!entries.length) {
      return `<p class="ft-message">Registra il primo peso per vedere il trend.</p>`;
    }

    const width = 680;
    const height = 250;
    const left = 46;
    const right = 16;
    const top = 18;
    const bottom = 42;
    const plotWidth = width - left - right;
    const plotHeight = height - top - bottom;

    const values = entries.map(item => Number(item.weight_kg));
    if (goal !== null) values.push(goal);

    const minValue = Math.floor(Math.min(...values) - 1);
    const maxValue = Math.ceil(Math.max(...values) + 1);
    const span = Math.max(1, maxValue - minValue);

    const yFor = value =>
      top + plotHeight - ((value - minValue) / span) * plotHeight;

    const stepX = entries.length > 1 ? plotWidth / (entries.length - 1) : 0;

    const coordinates = entries.map((item, index) => ({
      x: entries.length > 1 ? left + index * stepX : left + plotWidth / 2,
      y: yFor(Number(item.weight_kg)),
      value: Number(item.weight_kg),
      label: `CW${getISOWeekInfo(item.week_start).week}`
    }));

    const polyline = coordinates
      .map(point => `${point.x},${point.y}`)
      .join(" ");

    const labelEvery = Math.max(1, Math.ceil(entries.length / 7));

    const grid = Array.from({ length: 4 }, (_, index) => {
      const value = maxValue - (span * index) / 3;
      const y = top + (plotHeight / 3) * index;

      return `
        <line x1="${left}" y1="${y}" x2="${width - right}" y2="${y}"
          stroke="var(--border-color,#e1e5eb)" stroke-dasharray="3 4"/>
        <text x="${left - 9}" y="${y + 4}" text-anchor="end"
          font-size="10" fill="var(--text-muted,#718096)">${fmtKg(value)}</text>
      `;
    }).join("");

    const targetLine = goal !== null ? `
      <line x1="${left}" y1="${yFor(goal)}" x2="${width - right}" y2="${yFor(goal)}"
        stroke="#e6a23c" stroke-width="2.5" stroke-dasharray="7 5"/>
      <text x="${width - right}" y="${yFor(goal) - 7}" text-anchor="end"
        font-size="10" font-weight="700" fill="#b27a12">Obiettivo ${fmtKg(goal)} kg</text>
    ` : "";

    const dots = coordinates.map(point => `
      <circle cx="${point.x}" cy="${point.y}" r="4"
        fill="#168b68" stroke="var(--card-bg,#fff)" stroke-width="1.5">
        <title>${escapeHtml(point.label)}: ${fmtKg(point.value)} kg</title>
      </circle>
    `).join("");

    const labels = coordinates.map((point, index) => {
      if (
        index % labelEvery !== 0 &&
        index !== coordinates.length - 1
      ) return "";

      return `
        <text x="${point.x}" y="${height - 13}" text-anchor="middle"
          font-size="10" fill="var(--text-muted,#718096)">
          ${escapeHtml(point.label)}
        </text>
      `;
    }).join("");

    return `
      <div class="ft-stats-chart">
        <svg viewBox="0 0 ${width} ${height}" role="img"
          aria-label="Andamento del peso rispetto all'obiettivo">
          ${grid}
          ${targetLine}
          <polyline points="${polyline}" fill="none" stroke="#168b68"
            stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
          ${dots}
          ${labels}
        </svg>
      </div>

      <div class="ft-stats-note" style="display:flex;gap:16px;flex-wrap:wrap;">
        <span><strong style="color:#168b68;">━</strong> Peso settimanale</span>
        ${goal !== null
          ? `<span><strong style="color:#e6a23c;">╍</strong> Obiettivo</span>`
          : ""}
      </div>
    `;
  }

  async function submitWeight(event) {
    event.preventDefault();

    const form = event.target;
    const button = form.querySelector('button[type="submit"]');
    const errorBox = document.getElementById("ftWeightError");
    const formData = new FormData(form);

    const weight = Number(
      String(formData.get("weight_kg") || "").replace(",", ".")
    );
    const file = formData.get("proof");

    errorBox.textContent = "";

    if (!weight || weight < 20 || weight > 400) {
      errorBox.textContent = "Inserisci un peso valido (in kg).";
      return;
    }

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

    button.disabled = true;
    button.textContent = "Caricamento...";

    let uploadedPath = null;

    try {
      const extension = file.name.split(".").pop().toLowerCase();
      uploadedPath = `${currentUser.id}/${crypto.randomUUID()}.${extension}`;

      const { error: uploadError } = await client.storage
        .from(WEIGHT_BUCKET)
        .upload(uploadedPath, file, {
          contentType: file.type,
          upsert: false
        });

      if (uploadError) throw uploadError;

      const { error: insertError } = await client
        .from("weight_entries")
        .insert({
          challenge_id: currentMember.challenge_id,
          member_id: currentMember.id,
          entry_date: localDateString(),
          weight_kg: weight,
          proof_path: uploadedPath
        });

      if (insertError) throw insertError;

      alert("Peso registrato!");
      currentView = "fitness-goal";
      await loadDashboard(currentUser);

    } catch (error) {
      console.error("FIT TOGETHER weight upload error:", error);

      if (uploadedPath) {
        await client.storage.from(WEIGHT_BUCKET).remove([uploadedPath]);
      }

      errorBox.textContent = error.code === "23505"
        ? "Hai già registrato il peso per questa settimana."
        : (error.message || "Errore durante il caricamento.");

      button.disabled = false;
      button.textContent = "Registra peso";
    }
  }

  async function deleteWeight(entryId) {
    if (!confirm(
      "Vuoi davvero eliminare il peso di questa settimana?\n\nIl dato e la foto saranno cancellati e potrai registrarlo di nuovo."
    )) {
      return;
    }

    try {
      const { data: deletedRows, error } = await client
        .from("weight_entries")
        .delete()
        .eq("id", entryId)
        .eq("member_id", currentMember.id)
        .select("id, proof_path");

      if (error) throw error;

      if (!deletedRows || deletedRows.length === 0) {
        throw new Error("Non è stato possibile eliminare il peso.");
      }

      const proofPath = deletedRows[0].proof_path;

      if (proofPath) {
        const { error: storageError } = await client.storage
          .from(WEIGHT_BUCKET)
          .remove([proofPath]);

        if (storageError) {
          console.error(
            "FIT TOGETHER: peso eliminato, ma errore nella cancellazione della foto:",
            storageError
          );
        }
      }

      await loadDashboard(currentUser);

    } catch (error) {
      console.error("FIT TOGETHER delete weight error:", error);
      alert("Errore durante l'eliminazione: " + error.message);
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
    week,
    historyWorkouts,
    statsWorkouts
  ) {
    // Dati "Obiettivo fitness": se la tabella non esiste ancora, il resto dell'app funziona comunque
    let weightEntries = [];
    let weightGoal = null;
    let weightReady = false;

    try {
      const [entriesResult, goalResult] = await Promise.all([
        client
          .from("weight_entries")
          .select("id, member_id, entry_date, week_start, weight_kg, proof_path, created_at")
          .eq("member_id", ownMember.id)
          .order("week_start", { ascending: true }),

        client
          .from("challenge_members")
          .select("goal_weight_kg")
          .eq("id", ownMember.id)
          .maybeSingle()
      ]);

      if (entriesResult.error) {
        console.warn("FIT TOGETHER: peso non disponibile:", entriesResult.error.message);
      } else {
        weightEntries = entriesResult.data || [];
        weightReady = true;
      }

      if (
        !goalResult.error &&
        goalResult.data &&
        goalResult.data.goal_weight_kg !== null &&
        goalResult.data.goal_weight_kg !== undefined
      ) {
        weightGoal = Number(goalResult.data.goal_weight_kg);
      }
    } catch (error) {
      console.warn("FIT TOGETHER: errore lettura peso:", error);
    }

    const thisWeekWeight = weightEntries.find(
      item => item.week_start === week.start
    ) || null;

    // Promemoria in-app: compare dal lunedì finché il peso della settimana non è registrato
    const weightReminder = weightReady && !thisWeekWeight;

    const reminderHtml = weightReminder ? `
      <button
        type="button"
        class="ft-notification-item unread"
        style="display:block;width:100%;text-align:left;background:transparent;color:inherit;border:0;cursor:pointer;font:inherit;"
        data-action="open-weight-reminder"
      >
        <div>⚖️ Registrazione peso settimanale attesa</div>

        <p style="margin:5px 0;">
          Registra il tuo peso di questa settimana e carica la foto di prova.
        </p>

        <div class="ft-small">
          CW${getISOWeekInfo(week.start).week} · Nuova · Tocca per aprire
        </div>
      </button>
    ` : "";

    const workoutCounts = {};

    members.forEach(member => {
      workoutCounts[member.id] = workouts.filter(workout =>
        workout.member_id === member.id &&
        workout.status === "approved"
      ).length;
    });

    const approvedCount = workoutCounts[ownMember.id] || 0;
    const unreadCount = notifications.length + (weightReminder ? 1 : 0);

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
              : `Ancora ${3 - count} allenamenti da registrare`}
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

    // --------------------------------------------------
    // WORKOUT DETAIL
    // --------------------------------------------------

    if (currentView === "workout-detail") {
      const workout = [...workouts, ...historyWorkouts].find(
        item => item.id === selectedWorkoutId
      );

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

    // --------------------------------------------------
    // FITNESS GOAL
    // --------------------------------------------------

    } else if (currentView === "fitness-goal") {

      if (!weightReady) {
        pageContent = `
          <div class="ft-panel">
            <h2 class="ft-page-title">⚖️ Obiettivo fitness</h2>
            <p class="ft-message">
              Questa sezione non è ancora attiva: il database deve essere configurato.
            </p>
          </div>
        `;
      } else {
        const latestWeight = weightEntries.length
          ? Number(weightEntries[weightEntries.length - 1].weight_kg)
          : null;

        const firstWeight = weightEntries.length
          ? Number(weightEntries[0].weight_kg)
          : null;

        let thisWeekPhotoUrl = null;

        if (thisWeekWeight && thisWeekWeight.proof_path) {
          const { data: signed } = await client.storage
            .from(WEIGHT_BUCKET)
            .createSignedUrl(thisWeekWeight.proof_path, 3600);

          thisWeekPhotoUrl = signed?.signedUrl || null;
        }

        const weekInfo = getISOWeekInfo(week.start);

        const weekSectionHtml = thisWeekWeight ? `
          <div class="ft-detail-row">
            <span class="ft-detail-label">Peso registrato</span>
            <strong class="ft-detail-value">${fmtKg(thisWeekWeight.weight_kg)} kg</strong>
          </div>

          <div class="ft-detail-row">
            <span class="ft-detail-label">Data</span>
            <span class="ft-detail-value">${formatDate(thisWeekWeight.entry_date)}</span>
          </div>

          ${thisWeekPhotoUrl ? `
            <a href="${escapeHtml(thisWeekPhotoUrl)}" target="_blank" rel="noopener">
              <img
                class="ft-detail-photo"
                src="${escapeHtml(thisWeekPhotoUrl)}"
                alt="Foto di prova del peso"
              >
            </a>
          ` : ""}

          <button
            class="ft-button ft-secondary"
            style="width:100%;margin-top:14px;"
            data-action="delete-weight"
            data-id="${escapeHtml(thisWeekWeight.id)}"
          >
            Elimina e registra di nuovo
          </button>
        ` : `
          <form id="ftWeightForm" class="ft-form">
            <label>
              Peso (kg)
              <input
                type="number"
                name="weight_kg"
                inputmode="decimal"
                min="20"
                max="400"
                step="0.1"
                placeholder="Es. 78.5"
                required
              >
            </label>

            <label>
              Foto di prova (bilancia)
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

            <p id="ftWeightError" class="ft-error"></p>

            <button class="ft-button ft-primary" type="submit">
              Registra peso
            </button>
          </form>
        `;

        let goalSectionHtml = "";

        if (weightGoal === null) {
          goalSectionHtml = `
            <p class="ft-message">
              Il tuo obiettivo non è ancora stato impostato.
            </p>
          `;
        } else {
          let diffKpi = "—";
          let diffPctKpi = "—";
          let statusText = "Registra il tuo primo peso per vedere la distanza dall'obiettivo.";
          let diffColor = "inherit";

          if (latestWeight !== null) {
            const diff = latestWeight - weightGoal;
            const absDiff = Math.abs(diff);
            const sign = diff > 0 ? "+" : "−";

            if (absDiff < 0.05) {
              diffKpi = "0,0 kg";
              diffPctKpi = "0,0%";
              diffColor = "#168b68";
              statusText = "Obiettivo raggiunto! 🎉";
            } else {
              diffKpi = `${sign}${fmtKg(absDiff)} kg`;
              diffPctKpi = `${sign}${fmtKg(absDiff / weightGoal * 100)}%`;
              diffColor = "#c34d5b";

              statusText = diff > 0
                ? `Ti mancano ${fmtKg(absDiff)} kg per arrivare all'obiettivo.`
                : `Sei ${fmtKg(absDiff)} kg sotto l'obiettivo.`;
            }
          }

          let progressHtml = "";

          if (
            weightEntries.length >= 2 &&
            firstWeight !== null &&
            latestWeight !== null &&
            firstWeight !== weightGoal
          ) {
            const progress = Math.max(0, Math.min(
              100,
              (firstWeight - latestWeight) / (firstWeight - weightGoal) * 100
            ));

            progressHtml = `
              <div style="margin-top:16px;">
                <div style="display:flex;justify-content:space-between;align-items:center;">
                  <strong>Avanzamento verso l'obiettivo</strong>
                  <strong>${Math.round(progress)}%</strong>
                </div>

                <div class="ft-progress">
                  <div class="ft-progress-fill" style="width:${progress}%;"></div>
                </div>

                <p class="ft-subtitle">
                  Calcolato dal primo peso registrato (${fmtKg(firstWeight)} kg).
                </p>
              </div>
            `;
          }

          goalSectionHtml = `
            <div class="ft-stats-kpis">
              <div class="ft-stats-kpi">
                <div class="ft-stats-kpi-label">Il tuo obiettivo</div>
                <div class="ft-stats-kpi-value">${fmtKg(weightGoal)} kg</div>
              </div>

              <div class="ft-stats-kpi">
                <div class="ft-stats-kpi-label">Peso attuale</div>
                <div class="ft-stats-kpi-value">
                  ${latestWeight === null ? "—" : `${fmtKg(latestWeight)} kg`}
                </div>
              </div>

              <div class="ft-stats-kpi">
                <div class="ft-stats-kpi-label">Differenza (kg)</div>
                <div class="ft-stats-kpi-value" style="color:${diffColor};">${diffKpi}</div>
              </div>

              <div class="ft-stats-kpi">
                <div class="ft-stats-kpi-label">Differenza (%)</div>
                <div class="ft-stats-kpi-value" style="color:${diffColor};">${diffPctKpi}</div>
              </div>
            </div>

            <p class="ft-message" style="margin-top:14px;">${escapeHtml(statusText)}</p>

            ${progressHtml}
          `;
        }

        pageContent = `
          <div class="ft-panel">
            <h2 class="ft-page-title">⚖️ Obiettivo fitness</h2>
            <p class="ft-subtitle">
              Registra il tuo peso ogni settimana, a partire dal lunedì mattina.
            </p>

            <h3 style="margin:25px 0 5px;">Peso della settimana</h3>
            <p class="ft-subtitle">
              CW${weekInfo.week} · ${formatDate(week.start)} – ${formatDate(week.end)}
            </p>

            ${weekSectionHtml}

            <h3 style="margin:30px 0 5px;">Il tuo obiettivo</h3>
            ${goalSectionHtml}

            <h3 style="margin:30px 0 5px;">Trend del peso</h3>
            <p class="ft-subtitle">
              Il tuo peso settimana dopo settimana rispetto all'obiettivo.
            </p>
            ${renderWeightChart(weightEntries, weightGoal)}
          </div>
        `;
      }

    // --------------------------------------------------
    // REVIEWS
    // --------------------------------------------------

    } else if (currentView === "reviews") {
      const pendingHtml = await renderPendingReviews(
        pendingWorkouts,
        members
      );

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

    // --------------------------------------------------
    // SPORTS STATISTICS
    // --------------------------------------------------

    } else if (currentView === "sports-stats") {
      const allStatsWorkouts = statsWorkouts;
      const range = getStatsRange();
      const filteredStatsWorkouts = allStatsWorkouts.filter(workout =>
        workout.activity_date >= range.start &&
        workout.activity_date <= range.end
      );

      const trend = buildStatsTrend(allStatsWorkouts, range);
      const approved = trend.approved;

      const minutes = approved.reduce(
        (sum, workout) => sum + Number(workout.duration_minutes || 0),
        0
      );

      const distance = approved.reduce(
        (sum, workout) => sum + Number(workout.distance_km || 0),
        0
      );

      // La distanza totale viene mostrata solo a chi ha la corsa come sport obbligatorio
      const showDistance = ownMember.weekly_plan === "runner";

      const attendance = calculateMissedSessions(
        allStatsWorkouts,
        ownMember,
        range
      );

      const decidedSessions = attendance.completed + attendance.missed;

      const consistency = decidedSessions
        ? Math.round(attendance.completed / decidedSessions * 100)
        : null;

      const missedPercentage = decidedSessions
        ? Math.round(attendance.missed / decidedSessions * 100)
        : null;

      const years = [
        ...new Set([
          new Date().getFullYear(),
          ...allStatsWorkouts.map(item =>
            Number(item.activity_date.slice(0, 4))
          )
        ])
      ].sort((a, b) => b - a);

      const monthNames = [
        "Gennaio", "Febbraio", "Marzo", "Aprile",
        "Maggio", "Giugno", "Luglio", "Agosto",
        "Settembre", "Ottobre", "Novembre", "Dicembre"
      ];

      const maxWeek = getISOWeekInfo(`${Number(statsYear)}-12-28`).week;
      const safeWeek = Math.min(maxWeek, Math.max(1, Number(statsWeek) || 1));

      const periodLabel = statsPeriod === "year"
        ? String(statsYear)
        : statsPeriod === "month"
          ? `${monthNames[Number(statsMonth) - 1]} ${statsYear}`
          : `CW${safeWeek} · ${statsYear}`;

      pageContent = `
        <div class="ft-panel">
          <h2 class="ft-page-title">Statistiche sport</h2>
          <p class="ft-subtitle">
            Analisi dei tuoi allenamenti personali approvati.
          </p>

          <div class="ft-history-controls" style="grid-template-columns:repeat(3,minmax(0,1fr));">
            <label>
              Periodo
              <select data-stats-filter="period">
                <option value="year" ${statsPeriod === "year" ? "selected" : ""}>Anno</option>
                <option value="month" ${statsPeriod === "month" ? "selected" : ""}>Mese</option>
                <option value="week" ${statsPeriod === "week" ? "selected" : ""}>Settimana</option>
              </select>
            </label>

            <label>
              Anno
              <select data-stats-filter="year">
                ${years.map(year => `
                  <option value="${year}" ${Number(statsYear) === year ? "selected" : ""}>
                    ${year}
                  </option>
                `).join("")}
              </select>
            </label>

            ${statsPeriod === "month" ? `
              <label>
                Mese
                <select data-stats-filter="month">
                  ${monthNames.map((name, index) => `
                    <option value="${index + 1}" ${Number(statsMonth) === index + 1 ? "selected" : ""}>
                      ${name}
                    </option>
                  `).join("")}
                </select>
              </label>
            ` : statsPeriod === "week" ? `
              <label>
                Settimana
                <select data-stats-filter="week">
                  ${Array.from({ length: maxWeek }, (_, index) => index + 1).map(number => `
                    <option value="${number}" ${safeWeek === number ? "selected" : ""}>
                      CW${number}
                    </option>
                  `).join("")}
                </select>
              </label>
            ` : `
              <div></div>
            `}
          </div>

          <p class="ft-subtitle" style="margin-top:0;">
            Periodo selezionato: <strong>${escapeHtml(periodLabel)}</strong>
          </p>

          <div class="ft-stats-kpis">
            <div class="ft-stats-kpi">
              <div class="ft-stats-kpi-label">Attività approvate</div>
              <div class="ft-stats-kpi-value">${approved.length}</div>
            </div>

            <div class="ft-stats-kpi">
              <div class="ft-stats-kpi-label">Ore di allenamento</div>
              <div class="ft-stats-kpi-value">${(minutes / 60).toFixed(1).replace(".", ",")} h</div>
            </div>

            <div class="ft-stats-kpi">
              <div class="ft-stats-kpi-label">Costanza sulle sessioni definite</div>
              <div class="ft-stats-kpi-value" style="color:#168b68;">
                ${consistency === null ? "—" : `${consistency}%`}
              </div>
            </div>

            <div class="ft-stats-kpi">
              <div class="ft-stats-kpi-label">Sessioni saltate</div>
              <div class="ft-stats-kpi-value" style="color:#c34d5b;">
                ${missedPercentage === null ? "—" : `${missedPercentage}%`}
              </div>
            </div>
          </div>

          ${showDistance ? `
            <div class="ft-stats-kpi" style="margin-top:10px;">
              <div class="ft-stats-kpi-label">Distanza totale registrata</div>
              <div class="ft-stats-kpi-value">${distance.toFixed(1).replace(".", ",")} km</div>
            </div>
          ` : ""}

          <h3 style="margin:25px 0 5px;">Trend attività</h3>
          <p class="ft-subtitle">
            Numero di allenamenti approvati nel tempo.
          </p>
          ${renderStatsLineChart(trend.points)}

          <h3 style="margin:25px 0 5px;">Le tue attività</h3>
          <p class="ft-subtitle">
            Distribuzione degli sport praticati nel periodo selezionato.
          </p>
          ${renderStatsPieChart(filteredStatsWorkouts)}
        </div>
      `;

    // --------------------------------------------------
    // HISTORY
    // --------------------------------------------------

    } else if (currentView === "history") {

      const monthNames = [
        "Gennaio", "Febbraio", "Marzo", "Aprile",
        "Maggio", "Giugno", "Luglio", "Agosto",
        "Settembre", "Ottobre", "Novembre", "Dicembre"
      ];

      const currentInfo = getISOWeekInfo(localDateString());

      const availableYears = [
        ...new Set(
          historyWorkouts.map(item =>
            getISOWeekInfo(item.activity_date).year
          )
        )
      ].sort((a, b) => b - a);

      const years = [
        ...new Set([
          new Date().getFullYear(),
          ...availableYears
        ])
      ].sort((a, b) => b - a);

      const selectedYear = historyYear
        ? Number(historyYear)
        : null;

      const selectedMonth = historyMonth
        ? Number(historyMonth)
        : null;

      const filteredWorkouts = historyWorkouts.filter(workout => {
        const info = getISOWeekInfo(workout.activity_date);
        const month = Number(workout.activity_date.slice(5, 7));

        if (selectedYear && info.year !== selectedYear) return false;
        if (selectedMonth && month !== selectedMonth) return false;

        if (
          historyWeek !== null &&
          info.week !== Number(historyWeek)
        ) return false;

        return true;
      }).sort((a, b) =>
        b.activity_date.localeCompare(a.activity_date) ||
        new Date(b.created_at) - new Date(a.created_at)
      );

      function renderHistoryItem(workout) {
        const info = getISOWeekInfo(workout.activity_date);

        const icon = workout.activity_type === "running"
          ? "🏃"
          : workout.activity_type === "gym"
            ? "🏋️"
            : workout.activity_type === "cycling"
              ? "🚴"
              : workout.activity_type === "trekking"
                ? "🥾"
                : workout.activity_type === "swimming"
                  ? "🏊"
                  : "💪";

        return `
          <button
            class="ft-history-item"
            data-action="view-workout"
            data-id="${escapeHtml(workout.id)}"
          >
            <span class="ft-history-icon">${icon}</span>

            <span class="ft-history-main">
              <strong>${escapeHtml(activityLabel(workout.activity_type))}</strong>

              <span class="ft-history-meta">
                ${formatDate(workout.activity_date)}
                · CW${info.week}
                · ${Number(workout.duration_minutes || 0)} min
                ${workout.distance_km
                  ? ` · ${Number(workout.distance_km)} km`
                  : ""}
              </span>
            </span>

            <span class="ft-status approved">Approvato</span>
          </button>
        `;
      }

      let historyBody = "";

      // ------------------------------
      // LIST VIEW
      // ------------------------------

      if (historyMode === "list") {

        historyBody = filteredWorkouts.length
          ? `
            <div class="ft-history-scroll">
              ${filteredWorkouts.map(renderHistoryItem).join("")}
            </div>

            <p class="ft-small" style="text-align:center;margin-top:10px;">
              ${filteredWorkouts.length} attività approvate
            </p>
          `
          : `
            <div class="ft-panel" style="text-align:center;margin-top:12px;">
              <div style="font-size:30px;">📭</div>
              <p class="ft-message">
                Nessuna attività approvata per i filtri selezionati.
              </p>
            </div>
          `;

      // ------------------------------
      // TIMELINE VIEW
      // ------------------------------

      } else {

        const timelineYear = selectedYear || new Date().getFullYear();

        const lastWeekOfYear = getISOWeekInfo(
          `${timelineYear}-12-28`
        ).week;

        const timelineWeeks = [];

        for (let weekNumber = 1; weekNumber <= lastWeekOfYear; weekNumber++) {
          const range = getISOWeekRange(timelineYear, weekNumber);

          timelineWeeks.push({
            week: weekNumber,
            start: range.start,
            end: range.end
          });
        }

        const selectedTimelineWeek = historyWeek !== null
          ? Number(historyWeek)
          : 1;

        const selectedRange = getISOWeekRange(
          timelineYear,
          selectedTimelineWeek
        );

        const timelineWorkouts = historyWorkouts
          .filter(workout => {
            const info = getISOWeekInfo(workout.activity_date);

            return info.year === timelineYear &&
              info.week === selectedTimelineWeek;
          })
          .sort((a, b) =>
            b.activity_date.localeCompare(a.activity_date)
          );

        // Raggruppa le settimane per mese.
        // Il mese viene assegnato in base al giovedì della settimana ISO.

        const monthGroups = [];

        timelineWeeks.forEach(item => {
          const monday = new Date(`${item.start}T12:00:00`);
          const thursday = new Date(monday);

          thursday.setDate(monday.getDate() + 3);

          const monthIndex = thursday.getMonth();

          const lastGroup = monthGroups[monthGroups.length - 1];

          if (lastGroup && lastGroup.monthIndex === monthIndex) {
            lastGroup.count++;
          } else {
            monthGroups.push({
              monthIndex,
              count: 1
            });
          }
        });

        const monthsHtml = monthGroups.map(group => {
          const width = group.count * 86 + (group.count - 1) * 7;

          return `
            <span
              class="ft-timeline-month"
              style="width:${width}px;"
            >
              ${monthNames[group.monthIndex].slice(0, 3)}
            </span>
          `;
        }).join("");

        historyBody = `
          <div class="ft-timeline-scroll" id="ftTimelineScroll">
            <div class="ft-timeline-content">

              <div class="ft-timeline-months">
                ${monthsHtml}
              </div>

              <div class="ft-week-timeline" id="ftWeekTimeline">
                ${timelineWeeks.map(item => {
                  const startDate = new Date(`${item.start}T12:00:00`);
                  const endDate = new Date(`${item.end}T12:00:00`);

                  const dateLabel =
                    `${startDate.getDate()} ${monthNames[startDate.getMonth()].slice(0, 3)}`
                    + ` – ${endDate.getDate()} ${monthNames[endDate.getMonth()].slice(0, 3)}`;

                  return `
                    <button
                      class="ft-week-chip ${item.week === selectedTimelineWeek ? "active" : ""}"
                      data-action="history-week"
                      data-week="${item.week}"
                      data-year="${timelineYear}"
                    >
                      <strong>CW${item.week}</strong>
                      <span>${dateLabel}</span>
                    </button>
                  `;
                }).join("")}
              </div>

            </div>
          </div>

          <h3 style="margin:8px 0 12px;">
            CW${selectedTimelineWeek}
            · ${formatDate(selectedRange.start)}
            – ${formatDate(selectedRange.end)}
          </h3>

          ${timelineWorkouts.length
            ? timelineWorkouts.map(renderHistoryItem).join("")
            : `
              <div class="ft-panel" style="text-align:center;">
                <div style="font-size:28px;">🗓️</div>
                <p class="ft-message">
                  Nessuna attività approvata in questa settimana.
                </p>
              </div>
            `}
        `;
      }

      pageContent = `
        <div class="ft-panel">

          <h2 class="ft-page-title">Storico attività</h2>

          <p class="ft-subtitle">
            Qui trovi tutti i tuoi allenamenti approvati.
          </p>

          <div class="ft-mode-switch">
            <button
              class="ft-button ft-secondary ${historyMode === "list" ? "active" : ""}"
              data-action="history-mode"
              data-mode="list"
            >
              ☷ Elenco
            </button>

            <button
              class="ft-button ft-secondary ${historyMode === "timeline" ? "active" : ""}"
              data-action="history-mode"
              data-mode="timeline"
            >
              ◷ Timeline
            </button>
          </div>

          <div class="ft-history-controls">

            <label>
              Anno
              <select data-history-filter="year">
                <option value="" ${!historyYear ? "selected" : ""}>Tutti</option>

                ${years.map(year => `
                  <option
                    value="${year}"
                    ${Number(historyYear) === year ? "selected" : ""}
                  >
                    ${year}
                  </option>
                `).join("")}
              </select>
            </label>

            <label>
              Mese
              <select data-history-filter="month">
                <option value="" ${!historyMonth ? "selected" : ""}>Tutti</option>

                ${monthNames.map((name, index) => `
                  <option
                    value="${index + 1}"
                    ${Number(historyMonth) === index + 1 ? "selected" : ""}
                  >
                    ${name}
                  </option>
                `).join("")}
              </select>
            </label>

            <label>
              Settimana
              <select data-history-filter="week">
                <option value="" ${historyWeek === null ? "selected" : ""}>Tutte</option>

                ${Array.from(
                  { length: 53 },
                  (_, index) => index + 1
                ).map(number => `
                  <option
                    value="${number}"
                    ${Number(historyWeek) === number ? "selected" : ""}
                  >
                    CW${number}
                  </option>
                `).join("")}
              </select>
            </label>

          </div>

          ${historyBody}

        </div>
      `;

    // --------------------------------------------------
    // RULES
    // --------------------------------------------------

    } else if (currentView === "rules") {

      pageContent = `
        <div class="ft-panel">

          <div style="font-size:34px;">🏆</div>

          <h2 class="ft-page-title" style="margin-top:8px;">
            Il regolamento
          </h2>

          <p class="ft-subtitle">
            Benvenuti in FIT TOGETHER, ${escapeHtml(ownMember.display_name)}! 💪
          </p>

          <p style="line-height:1.65;margin-top:18px;">
            La sfida è semplice: ogni settimana dovrete raggiungere il vostro
            obiettivo sportivo e registrare le attività previste. Il vostro
            partner farà lo stesso e avrà il compito di verificare gli allenamenti.
          </p>

          <h3 style="margin:24px 0 8px;">
            E domenica sera… si fanno i conti!
          </h3>

          <div class="ft-rule-card success">
            <h3>🥗 Entrambi raggiungete l'obiettivo</h3>
            <p>
              Complimenti! Vi meritate una bella cena salutare per festeggiare.
              Il conto? Rigorosamente diviso a metà!
            </p>
          </div>

          <div class="ft-rule-card warning">
            <h3>😉 Solo uno raggiunge l'obiettivo</h3>
            <p>
              Chi non ha completato la sfida offre la cena all'altro.
              Niente scuse!
            </p>
          </div>

          <div class="ft-rule-card info">
            <h3>❤️ Nessuno raggiunge l'obiettivo</h3>
            <p>
              Niente cena questa volta: entrambi donate 10 € a un'associazione
              benefica a vostra scelta.
            </p>
          </div>

          <p style="line-height:1.65;margin-top:22px;font-weight:650;">
            La cosa più importante è mantenere la costanza, motivarsi a vicenda
            e divertirsi. Le sfide sono fatte per essere vinte… quindi cerchiamo
            di non fare della beneficenza un appuntamento fisso! 💚
          </p>

        </div>
      `;

    // --------------------------------------------------
    // HOMEPAGE
    // --------------------------------------------------

    } else {

      pageContent = `
        <div class="ft-panel">

          <h3 style="margin:0 0 7px;">
            La vostra settimana
          </h3>

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
            Progresso di entrambi
          </h3>

          <div class="ft-member-grid" style="margin-top:12px;">
            ${memberCards}
          </div>

        </div>
      `;
    }

    // --------------------------------------------------
    // MAIN LAYOUT
    // --------------------------------------------------

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
                  class="ft-menu-item ${currentView === "rules" ? "active" : ""}"
                  data-action="nav-rules"
                >
                  📖 Regolamento
                </button>

                <button
                  class="ft-menu-item ${currentView === "reviews" ? "active" : ""}"
                  data-action="nav-reviews"
                >
                  ✓ Reviews${pendingWorkouts.length
                    ? ` (${pendingWorkouts.length})`
                    : ""}
                </button>

                <button
                  class="ft-menu-item ${currentView === "history" ? "active" : ""}"
                  data-action="nav-history"
                >
                  ◷ Storico attività
                </button>

                <button
                  class="ft-menu-item ${currentView === "sports-stats" ? "active" : ""}"
                  data-action="nav-sports-stats"
                >
                  📊 Statistiche sport
                </button>

                <button
                  class="ft-menu-item ${currentView === "fitness-goal" ? "active" : ""}"
                  data-action="nav-fitness"
                >
                  ⚖️ Obiettivo fitness
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

          ${renderNotifications(notifications, reminderHtml)}

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
        notificationsResult,
        historyResult,
        statsResult
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
          .limit(20),

        client
          .from("workout_entries")
          .select("id, member_id, session_slot, activity_type, activity_date, duration_minutes, distance_km, notes, proof_path, status, created_at")
          .eq("challenge_id", ownMember.challenge_id)
          .eq("member_id", ownMember.id)
          .eq("status", "approved")
          .order("activity_date", { ascending: false }),

        client
          .from("workout_entries")
          .select("id, member_id, session_slot, activity_type, activity_date, duration_minutes, distance_km, status, created_at")
          .eq("challenge_id", ownMember.challenge_id)
          .eq("member_id", ownMember.id)
          .order("activity_date", { ascending: true })

      ]);

      if (membersResult.error) throw membersResult.error;
      if (workoutsResult.error) throw workoutsResult.error;
      if (pendingResult.error) throw pendingResult.error;
      if (notificationsResult.error) throw notificationsResult.error;
      if (historyResult.error) throw historyResult.error;
      if (statsResult.error) throw statsResult.error;

      await renderDashboard(
        challenge,
        membersResult.data || [],
        workoutsResult.data || [],
        pendingResult.data || [],
        notificationsResult.data || [],
        ownMember,
        week,
        historyResult.data || [],
        statsResult.data || []
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
        const workoutFormOpen =
          document.getElementById("ftWorkoutForm") ||
          document.getElementById("ftWeightForm");

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

    if (action === "nav-history") {
      currentView = "history";
      selectedWorkoutId = null;

      historyMode = "list";
      historyYear = null;
      historyMonth = null;
      historyWeek = null;

      await loadDashboard(currentUser);
      return;
    }

    if (action === "nav-sports-stats") {
      currentView = "sports-stats";
      selectedWorkoutId = null;

      statsPeriod = "year";
      statsYear = new Date().getFullYear();
      statsMonth = new Date().getMonth() + 1;
      statsWeek = getISOWeekInfo(localDateString()).week;

      await loadDashboard(currentUser);
      return;
    }

    if (action === "nav-rules") {
      currentView = "rules";
      selectedWorkoutId = null;
      await loadDashboard(currentUser);
      return;
    }

    if (action === "nav-fitness" || action === "open-weight-reminder") {
      currentView = "fitness-goal";
      selectedWorkoutId = null;
      await loadDashboard(currentUser);
      return;
    }

    if (action === "delete-weight") {
      await deleteWeight(button.dataset.id);
      return;
    }

    if (action === "history-mode") {
      const newMode = button.dataset.mode;

      if (newMode === "timeline") {
        historyMode = "timeline";

        if (!historyYear) {
          historyYear = new Date().getFullYear();
        }

        historyMonth = null;

        const currentInfo = getISOWeekInfo(localDateString());

        historyWeek = Number(historyYear) === currentInfo.year
          ? currentInfo.week
          : getISOWeekInfo(`${historyYear}-12-28`).week;

      } else {
        historyMode = "list";

        historyYear = null;
        historyMonth = null;
        historyWeek = null;
      }

      await loadDashboard(currentUser);
      return;
    }

    if (action === "history-week") {
      historyWeek = Number(button.dataset.week);
      historyYear = Number(button.dataset.year);
      historyMode = "timeline";

      await loadDashboard(currentUser);
      return;
    }

    if (action === "open-notification") {
      try {
        const notificationType = button.dataset.type;

        await markNotificationRead(button.dataset.id);

        // Solo le notifiche che richiedono una review
        // aprono la pagina Reviews.
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
      workoutDetailReturnView = currentView;
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

      if (currentView === "workout-detail") {
        currentView = workoutDetailReturnView;
      } else {
        currentView = "home";
      }

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
  // HISTORY AND STATS FILTERS
  // --------------------------------------------------

  challengeCard.addEventListener("change", async event => {
    const statsFilter = event.target.closest("[data-stats-filter]");

    if (statsFilter) {
      const kind = statsFilter.dataset.statsFilter;

      if (kind === "period") {
        statsPeriod = statsFilter.value;
      } else if (kind === "year") {
        statsYear = Number(statsFilter.value);
      } else if (kind === "month") {
        statsMonth = Number(statsFilter.value);
      } else if (kind === "week") {
        statsWeek = Number(statsFilter.value);
      }

      await loadDashboard(currentUser);
      return;
    }

    const filter = event.target.closest("[data-history-filter]");
    if (!filter) return;

    const kind = filter.dataset.historyFilter;

    if (kind === "year") {
      historyYear = filter.value ? Number(filter.value) : null;
      historyWeek = null;

      if (
        historyMode === "timeline" &&
        historyYear === null
      ) {
        historyYear = new Date().getFullYear();
      }

      if (historyMode === "timeline") {
        historyWeek = 1;
      }

    } else if (kind === "month") {
      historyMonth = filter.value ? Number(filter.value) : null;

      if (historyMode === "timeline") {
        historyWeek = null;
      }

    } else if (kind === "week") {
      historyWeek = filter.value ? Number(filter.value) : null;
    }

    await loadDashboard(currentUser);
  });

  // --------------------------------------------------
  // WEIGHT FORM SUBMIT
  // --------------------------------------------------

  challengeCard.addEventListener("submit", event => {
    if (event.target && event.target.id === "ftWeightForm") {
      submitWeight(event);
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
