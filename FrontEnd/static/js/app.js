import { ApiError, GameApi, MockGameApi } from "./api.js";

// State shape (PublicStateResponse):
// { puzzle_id, height, width, is_complete,
//   cells: [{ id, row, column, character_name, profession, is_criminal: true|false|null }],
//   revealed_clues: [{ id, source_cell_id, description_nl, referenced_cell_ids }] }

// UI strings restored to English as in git HEAD
const TEXT = {
  innocent: "Innocent",
  criminal: "Criminal",
  flagInnocent: "INNOCENT",
  flagCriminal: "CRIMINAL",
  flagUnrevealed: "UNREVEALED",
  unrevealed: "unrevealed",
  revealedCount: (n) => `${n} revealed`,
  verdictFor: (name) => `Verdict for ${name}`,
  unknownCell: "Unknown cell",
  publicClue: "Public starting clue",
  publicCluesCount: (n) => `${n} CLUE${n === 1 ? "" : "S"}`,
  revealedBy: "REVEALED BY",
  newBadge: "NEW",
  noTargets: "No cell mapping provided.",
  live: "LIVE API",
  mock: "OFFLINE · MOCK",
  footerLive: "Connected to backend API",
  footerMock: "Backend unreachable — showing local mock data (read-only)",
  restartToast: "Board restored to its initial public state.",
  noPuzzles: "The backend has no puzzles to load.",
  loadedToast: (id) => `Case "${id}" is loaded.`,
  acceptedToast: (name, status) => `Verdict accepted: ${name} is ${status.toLowerCase()}.`,
  noClueAttached: (name) => `${name} has no clue attached.`,
  caseClosedTitle: "Case closed",
  caseClosedBody: "Every character has a proven verdict, without guessing.",
  caseClosedAuto: "Solved by Auto solve — every verdict was forced by the clues.",
  playbackLabel: (step, total) => `Auto solve · step ${step} / ${total}`,
  pause: "Pause",
  resume: "Resume",
  retrying: "Trying to reach the backend…",
  reconnected: "Connected to the backend.",
  stillOffline: "Still offline. Is the backend running?",
  hintSolvedBody: (checks) => `Nothing left to prove: every character already has a verdict. (${checks})`,
  hintUnknownBody: (checks) => `No forced verdict: the public clues do not force any remaining character yet. (${checks})`,
  inconsistentTitle: "Inconsistent clues",
  hintInconsistentBody: (checks) => `The public clues contradict each other — this puzzle has no solution. (${checks})`,
  satChecks: (n) => `${n} SAT check${n === 1 ? "" : "s"}`,
  solveTitles: { SOLVED: "Solved", STUCK: "Stuck", INCONSISTENT: "Inconsistent clues" },
  solveInconsistent: "The public clues contradict each other.",
  solveStuckToast: (n) => `Auto solve stopped after ${n} step${n === 1 ? "" : "s"}: no further verdict is forced by the public clues.`,
  notProvableToast: (name) => `Not provable yet: the clues don't force a verdict for ${name}. +1 mistake.`,
  contradictedToast: (name) => `Contradicted: the clues force the opposite status for ${name}. +1 mistake.`,
  alreadyProvedToast: (name) => `${name} already has a proven verdict.`,
  selectFirst: "Select an unrevealed character first.",
  hintStep1: (label) => `${label} can be proven now. Press Hint again to see the verdict.`,
  hintStep2: (label, status) => `${label} is ${status.toLowerCase()}.`,
  shortcutsTitle: "Keyboard shortcuts",
  shortcutsBody: "← ↑ → ↓   Move between characters\nI   Verdict: Innocent\nC   Verdict: Criminal\nH   Hint (press twice to see the verdict)\nEsc   Clear selection / close dialog\n?   Show this list",
  unexpectedOutcome: "Unexpected outcome",
  backendUnavailable: "Backend unavailable",
  requestFailed: (status) => `Request failed (${status})`,
  unexpectedError: "Unexpected error",
};

// Fallback avatar filenames
const DEFAULT_AVATARS = [
  "an.svg", "binh.svg", "chi.svg", "dung.svg", "giang.svg",
  "ha.svg", "hung.svg", "khoa.svg", "lan.svg", "long.svg",
  "mai.svg", "minh.svg", "nam.svg", "ngoc.svg", "oanh.svg",
  "phuc.svg", "quan.svg", "son.svg", "tam.svg", "thao.svg",
  "trang.svg", "tuan.svg", "uyen.svg", "vy.svg", "yen.svg"
];

let api = new GameApi();
const $ = (selector) => document.querySelector(selector);

let state = null;
let selectedId = null;        // Active selected character cell ID
let pinnedClueId = null;      // Pinned clue ID
let hoverClueId = null;       // Hovered clue ID
let hoverCellId = null;       // Hovered character ID
let busy = false;
let mistakes = 0;
let hintsUsed = 0;
let pendingHint = null;      // { cellId, isCriminal }
let solvedByAuto = false;
let playback = null;         // { paused, skip }
let playbackClueIds = new Set();
let playbackCellId = null;
const PLAYBACK_STEP_MS = 650;
let toastTimer;

const cardViews = new Map();
let availableAvatars = new Set(DEFAULT_AVATARS);

// AI Reasoning Log state (Closed by default)
let aiStepsLog = [];
let isAiPanelOpen = false;

const coordinates = (row, column) => `${String.fromCharCode(65 + column)}${row + 1}`;
const initials = (name) => name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
const isProved = (cell) => cell.is_criminal === true || cell.is_criminal === false;
const statusLabel = (isCriminal) => isCriminal ? TEXT.flagCriminal : TEXT.flagInnocent;
const statusName = (isCriminal) => isCriminal ? TEXT.criminal : TEXT.innocent;
const cellById = (id) => state?.cells?.find((cell) => cell.id === id);
const clueById = (id) => state?.revealed_clues?.find((clue) => clue.id === id);
const cellLabel = (cell) => cell ? `${cell.character_name} (${coordinates(cell.row, cell.column)})` : TEXT.unknownCell;
const clueTag = (id) => `#${String(id).padStart(2, "0")}`;

function showAvatar(portrait, name) {
  const slug = name.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase()
    .replace(/đ/g, "d").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const file = `${slug}.svg`;
  if (!availableAvatars.has(file)) return;

  const image = new Image();
  image.alt = name;
  image.onload = () => {
    portrait.classList.remove("letter-avatar");
    portrait.replaceChildren(image);
  };
  image.src = new URL(`../avatars/${file}`, import.meta.url).href;
}

async function loadAvatars() {
  try {
    const response = await fetch(new URL("../../avatars.json", import.meta.url));
    if (response.ok) {
      const list = await response.json();
      if (Array.isArray(list)) availableAvatars = new Set(list);
    }
  } catch {
    // Fallback to DEFAULT_AVATARS
  }

  for (const cell of state?.cells ?? []) {
    const view = cardViews.get(cell.id);
    if (view?.portrait) showAvatar(view.portrait, cell.character_name);
  }
}

// ---------- 1. DYNAMIC GRID (UP TO 5x5) ----------

function renderBoard() {
  const board = $("#board");
  board.style.setProperty("--columns", state.width);
  board.dataset.size = Math.max(state.width, state.height);
  cardViews.clear();

  const grid = document.createDocumentFragment();

  // Corner coordinate marker
  const corner = document.createElement("span");
  corner.className = "coord corner";
  corner.textContent = "⌁";
  grid.append(corner);

  // Column labels: A, B, C, D, E...
  for (let column = 0; column < state.width; column++) {
    const label = document.createElement("span");
    label.className = "coord col-label";
    label.textContent = String.fromCharCode(65 + column);
    grid.append(label);
  }

  // Rows and cells
  for (let row = 0; row < state.height; row++) {
    const rowLabel = document.createElement("span");
    rowLabel.className = "coord row-label";
    rowLabel.textContent = row + 1;
    grid.append(rowLabel);

    for (let column = 0; column < state.width; column++) {
      const cell = state.cells.find((item) => item.row === row && item.column === column);
      if (!cell) {
        const blank = document.createElement("div");
        blank.className = "board-blank";
        grid.append(blank);
        continue;
      }
      const view = makeCard(cell);
      cardViews.set(cell.id, view);
      grid.append(view.card);
    }
  }

  board.replaceChildren(grid);
}

function positionExpandedClue(box, text) {
  const wrapRect = $(".board-wrap").getBoundingClientRect();
  const boxRect = box.getBoundingClientRect();
  const width = Math.min(Math.max(boxRect.width, 270), 340, wrapRect.width - 24);
  const left = Math.max(wrapRect.left + 12, Math.min(boxRect.left, wrapRect.right - width - 12));
  box.style.setProperty("--expanded-clue-width", `${width}px`);
  box.style.setProperty("--expanded-clue-left", `${left - boxRect.left}px`);
  box.style.setProperty("--expanded-clue-position", "absolute");
  box.style.setProperty("--expanded-clue-top", "0px");
  box.style.setProperty("--expanded-clue-bottom", "auto");

  const height = text.getBoundingClientRect().height;
  if (height <= wrapRect.bottom - boxRect.top - 12) return;
  if (height <= boxRect.bottom - wrapRect.top - 12) {
    box.style.setProperty("--expanded-clue-top", "auto");
    box.style.setProperty("--expanded-clue-bottom", "0px");
  } else {
    // Very long clues grow the row instead of clipping inside the scrollport.
    box.style.setProperty("--expanded-clue-position", "relative");
  }
}

function makeCard(cell) {
  const card = document.createElement("div");
  card.className = "character-card";
  card.setAttribute("role", "button");
  card.tabIndex = -1;
  card.dataset.cellId = cell.id;

  // Metadata bar: [Coordinate] + Status stamp
  const metaBar = document.createElement("div");
  metaBar.className = "card-meta-bar";

  const coord = document.createElement("span");
  coord.className = "card-coordinate";
  coord.textContent = `[${coordinates(cell.row, cell.column)}]`;

  const flag = document.createElement("span");
  flag.className = "card-flag";
  flag.textContent = TEXT.flagUnrevealed;

  metaBar.append(coord, flag);
  card.append(metaBar);

  // Card Main: Portrait + Name & Profession
  const cardMain = document.createElement("div");
  cardMain.className = "card-main";

  const portrait = document.createElement("span");
  portrait.className = "portrait letter-avatar";
  portrait.setAttribute("aria-hidden", "true");
  portrait.textContent = initials(cell.character_name);
  showAvatar(portrait, cell.character_name);

  const details = document.createElement("div");
  details.className = "card-details";
  const name = document.createElement("strong");
  name.textContent = cell.character_name;
  const job = document.createElement("small");
  job.textContent = cell.profession;
  details.append(name, job);

  cardMain.append(portrait, details);
  card.append(cardMain);

  // Card-attached clue (Goal 2: no button, no modal; native ellipsis, expands at location on hover/focus)
  const attachedClueBox = document.createElement("div");
  attachedClueBox.className = "card-attached-clue";
  attachedClueBox.tabIndex = 0;
  attachedClueBox.setAttribute("role", "note");
  attachedClueBox.setAttribute("aria-label", "Revealed testimony");
  attachedClueBox.hidden = true;

  const attachedClueText = document.createElement("p");
  attachedClueText.className = "attached-clue-text";
  attachedClueBox.append(attachedClueText);

  // Hover and focus handlers: expands smoothly at its location without flicker
  attachedClueBox.addEventListener("mouseenter", () => {
    card.classList.add("clue-hovered");
    positionExpandedClue(attachedClueBox, attachedClueText);
    const ownClue = state?.revealed_clues?.find((c) => c.source_cell_id === cell.id);
    if (ownClue) {
      hoverClueId = ownClue.id;
      renderHighlights();
    }
  });

  attachedClueBox.addEventListener("mouseleave", () => {
    card.classList.remove("clue-hovered");
    if (hoverClueId) {
      hoverClueId = null;
      renderHighlights();
    }
  });

  attachedClueBox.addEventListener("focus", () => {
    card.classList.add("clue-hovered");
    positionExpandedClue(attachedClueBox, attachedClueText);
    const ownClue = state?.revealed_clues?.find((c) => c.source_cell_id === cell.id);
    if (ownClue) {
      hoverClueId = ownClue.id;
      renderHighlights();
    }
  });

  attachedClueBox.addEventListener("blur", () => {
    card.classList.remove("clue-hovered");
    if (hoverClueId) {
      hoverClueId = null;
      renderHighlights();
    }
  });

  attachedClueBox.addEventListener("click", (event) => {
    // Touch/click expansion: focus the clue box directly without selecting card
    event.stopPropagation();
    attachedClueBox.focus();
  });

  card.append(attachedClueBox);

  // Verdict actions on card (visible when selected & unproved)
  const actions = document.createElement("div");
  actions.className = "card-actions";
  actions.setAttribute("role", "group");

  for (const [status, label] of [["INNOCENT", TEXT.innocent], ["CRIMINAL", TEXT.criminal]]) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `card-verdict ${status.toLowerCase()}`;
    button.dataset.status = status;
    button.innerHTML = `${label} <kbd>${label[0]}</kbd>`;
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      submitVerdict(cell.id, status === "CRIMINAL");
    });
    actions.append(button);
  }
  card.append(actions);

  // Card interactions
  card.addEventListener("click", () => onCardClick(cellById(cell.id)));
  card.addEventListener("keydown", (event) => {
    if ((event.key === "Enter" || event.key === " ") && event.target === card) {
      event.preventDefault();
      onCardClick(cellById(cell.id));
    }
  });
  card.addEventListener("animationend", () => card.classList.remove("is-wrong"));
  card.addEventListener("mouseenter", () => { hoverCellId = cell.id; renderHighlights(); });
  card.addEventListener("mouseleave", () => { if (hoverCellId === cell.id) { hoverCellId = null; renderHighlights(); } });
  card.addEventListener("focus", () => { hoverCellId = cell.id; renderHighlights(); });
  card.addEventListener("blur", () => { if (hoverCellId === cell.id) { hoverCellId = null; renderHighlights(); } });

  return { card, flag, portrait, actions, attachedClueBox, attachedClueText };
}

function render() {
  for (const cell of state.cells) {
    const view = cardViews.get(cell.id);
    if (!view) continue;
    const { card, flag, attachedClueBox, attachedClueText } = view;
    const isRevealed = isProved(cell);

    card.classList.toggle("is-revealed", isRevealed);
    card.classList.toggle("is-hidden", !isRevealed);
    card.setAttribute(
      "aria-label",
      `${coordinates(cell.row, cell.column)} ${cell.character_name}${isRevealed ? `, ${statusName(cell.is_criminal)}` : `, ${TEXT.unrevealed}`}`
    );

    flag.classList.toggle("flag-criminal", cell.is_criminal === true);
    flag.classList.toggle("flag-innocent", cell.is_criminal === false);
    flag.textContent = isRevealed ? statusLabel(cell.is_criminal) : TEXT.flagUnrevealed;

    // Display card's attached clue if revealed
    const ownClue = state.revealed_clues.find((c) => c.source_cell_id === cell.id);
    if (isRevealed && ownClue) {
      attachedClueBox.hidden = false;
      attachedClueText.textContent = `“${ownClue.description_nl}”`;
    } else {
      attachedClueBox.hidden = true;
      attachedClueText.textContent = "";
    }
  }

  const revealedCount = state.cells.filter(isProved).length;
  $("#case-name").textContent = state.puzzle_id;
  $("#board-size").textContent = `${state.height} × ${state.width}`;
  $("#known-count").textContent = TEXT.revealedCount(revealedCount);
  $("#progress-label").textContent = `${revealedCount} / ${state.cells.length}`;
  $("#progress-bar").style.width = `${state.cells.length ? (revealedCount / state.cells.length) * 100 : 0}%`;
  $("#mistake-count").textContent = mistakes;
  $("#hint-count").textContent = hintsUsed;

  renderPublicClues();
  renderSelection();
  renderAiStepsFeed();
}

function renderSelection() {
  const focusId = selectedId ?? state.cells[0]?.id;
  for (const [id, { card }] of cardViews) {
    card.classList.toggle("is-selected", id === selectedId);
    card.classList.toggle("is-hinted", id === pendingHint?.cellId);
    card.tabIndex = id === focusId ? 0 : -1;
  }
  renderControls();
  renderHighlights();
}

function renderControls() {
  const live = api.mode === "live";
  for (const [id, { card, actions }] of cardViews) {
    const cell = cellById(id);
    const open = live && id === selectedId && !isProved(cell);
    card.classList.toggle("has-actions", open);
    actions.setAttribute("aria-label", TEXT.verdictFor(cell.character_name));
    actions.querySelectorAll("button").forEach((button) => {
      button.disabled = !open || busy;
      button.tabIndex = open ? 0 : -1;
    });
  }

  $("#load-case").disabled = busy;
  $("#restart-btn").disabled = busy;
  $("#hint-btn").disabled = busy || !live;
  $("#autosolve-btn").disabled = busy || !live;
  $("#board").setAttribute("aria-busy", String(busy));
}

// ---------- 2. HIGHLIGHTS & TWO-WAY LINKING ----------

function activeClue() { return clueById(hoverClueId ?? pinnedClueId); }
function activeCellId() { return hoverCellId ?? selectedId; }

function renderHighlights() {
  const clue = activeClue();
  const mentioned = new Set(clue?.referenced_cell_ids);

  for (const [id, { card }] of cardViews) {
    card.classList.toggle("is-highlighted", mentioned.has(id));
    card.classList.toggle("is-clue-source", clue?.source_cell_id === id);
    card.classList.toggle("is-playback", id === playbackCellId);
  }

  const cellId = clue ? null : activeCellId();

  // Highlight public evidence cards
  document.querySelectorAll(".public-clue-card").forEach((item) => {
    const id = Number(item.dataset.clueId);
    item.classList.toggle("is-active", id === clue?.id);
    item.classList.toggle("is-solver-active", playbackClueIds.has(id));
    item.classList.toggle("is-pinned", id === pinnedClueId);
    item.querySelectorAll("[data-target-id]").forEach((chip) => {
      chip.classList.toggle("is-current", Number(chip.dataset.targetId) === cellId);
    });
  });
}

function onCardClick(cell) {
  if (busy) return;
  selectedId = selectedId === cell.id ? null : cell.id;
  pinnedClueId = null;
  cardViews.get(cell.id)?.card.focus({ preventScroll: true });

  if (selectedId != null && isProved(cell)) {
    const own = state.revealed_clues.filter((clue) => clue.source_cell_id === cell.id);
    if (!own.length) {
      showToast(TEXT.noClueAttached(cell.character_name));
    }
  }
  renderSelection();
}

// ---------- 3. BOARD-INTEGRATED PUBLIC EVIDENCE REGION (GOAL 3) ----------

function renderPublicClues() {
  const container = $("#public-evidence-banner");
  const list = $("#public-evidence-list");
  const countBadge = $("#public-clues-count");
  if (!container || !list) return;

  const publicClues = (state?.revealed_clues ?? []).filter((c) => c.source_cell_id == null);

  if (!publicClues.length) {
    container.hidden = true;
    list.innerHTML = "";
    return;
  }

  container.hidden = false;
  if (countBadge) countBadge.textContent = TEXT.publicCluesCount(publicClues.length);

  list.innerHTML = publicClues.map((clue) => {
    const targets = (clue.referenced_cell_ids || []).map(cellById).filter(Boolean);
    const chips = targets.map((cell) => `<span class="target-chip" data-target-id="${cell.id}">[${coordinates(cell.row, cell.column)}] <b>${escapeHtml(cell.character_name)}</b></span>`).join("")
      || `<span class="target-chip">${escapeHtml(TEXT.noTargets)}</span>`;

    return `
      <div class="public-clue-card" data-clue-id="${clue.id}" role="button" tabindex="0">
        <div class="public-clue-header">
          <span class="public-clue-id">${clueTag(clue.id)}</span>
          <span class="public-clue-source">${escapeHtml(TEXT.publicClue)}</span>
        </div>
        <p class="public-clue-body">${escapeHtml(clue.description_nl)}</p>
        <div class="public-clue-targets">${chips}</div>
      </div>
    `;
  }).join("");

  list.querySelectorAll(".public-clue-card").forEach((card) => {
    const id = Number(card.dataset.clueId);
    card.addEventListener("mouseenter", () => { hoverClueId = id; renderHighlights(); });
    card.addEventListener("mouseleave", () => { if (hoverClueId === id) { hoverClueId = null; renderHighlights(); } });
    card.addEventListener("focus", () => { hoverClueId = id; renderHighlights(); });
    card.addEventListener("blur", () => { if (hoverClueId === id) { hoverClueId = null; renderHighlights(); } });
    card.addEventListener("click", () => {
      if (busy) return;
      pinnedClueId = pinnedClueId === id ? null : id;
      renderHighlights();
    });
    card.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        pinnedClueId = pinnedClueId === id ? null : id;
        renderHighlights();
      }
    });
  });
}

// ---------- 4. AI REASONING JOURNAL (COLLAPSIBLE RIGHT PANEL) ----------

function toggleAiPanel(forceOpen) {
  isAiPanelOpen = forceOpen !== undefined ? forceOpen : !isAiPanelOpen;
  const panel = $("#ai-steps-panel");
  const toggleBtn = $("#ai-steps-btn");

  if (panel) panel.hidden = !isAiPanelOpen;
  if (toggleBtn) {
    toggleBtn.classList.toggle("is-active", isAiPanelOpen);
    toggleBtn.setAttribute("aria-expanded", String(isAiPanelOpen));
  }

  if (isAiPanelOpen) {
    renderAiStepsFeed();
  }
}

$("#ai-steps-btn")?.addEventListener("click", () => toggleAiPanel());
$("#ai-steps-close")?.addEventListener("click", () => toggleAiPanel(false));

function recordAiStep(stepData) {
  aiStepsLog.push(stepData);
  const badge = $("#ai-steps-badge");
  if (badge) {
    badge.textContent = aiStepsLog.length;
    badge.hidden = aiStepsLog.length === 0;
  }
  if (isAiPanelOpen) renderAiStepsFeed();
}

function renderAiStepsFeed() {
  const feed = $("#ai-steps-feed");
  if (!feed) return;

  if (!aiStepsLog.length) {
    feed.innerHTML = `
      <div class="ai-empty-state">
        <span class="ai-empty-icon">☷</span>
        <strong>No deduction steps recorded yet</strong>
        <p>Run <em>Auto solve</em> or request a <em>Hint</em> to trace the solver's deductive reasoning chain.</p>
      </div>`;
    return;
  }

  feed.innerHTML = aiStepsLog.map((step, idx) => {
    const targetCell = cellById(step.verdict.cell_id);
    const targetName = targetCell ? `${targetCell.character_name} [${coordinates(targetCell.row, targetCell.column)}]` : `Cell #${step.verdict.cell_id}`;
    const statusClass = step.verdict.is_criminal ? "criminal" : "innocent";
    const statusText = step.verdict.is_criminal ? TEXT.criminal : TEXT.innocent;

    const clueChips = (step.active_clue_ids || []).map((id) => `<span class="ai-step-chip">Clue #${String(id).padStart(2, "0")}</span>`).join("") || "Prior deduction";

    const queriesHtml = (step.sat_queries || []).map((q) => {
      const assume = q.assumption ? `${cellById(q.assumption.cell_id)?.character_name ?? q.assumption.cell_id} is ${statusName(q.assumption.is_criminal)}` : "All possibilities";
      const satText = q.satisfiable ? "SATISFIABLE (SAT)" : "CONTRADICTED (UNSAT)";
      const satClass = q.satisfiable ? "sat" : "unsat";
      return `<div class="ai-query-item"><span>Assume ${assume}</span><b class="ai-query-tag ${satClass}">${satText}</b></div>`;
    }).join("");

    return `
      <div class="ai-step-card" data-step-index="${idx}">
        <div class="ai-step-header">
          <span class="ai-step-num">STEP #${String(step.step ?? idx + 1).padStart(2, "0")}</span>
          <span class="ai-step-verdict ${statusClass}">➔ ${statusText}</span>
        </div>
        <div class="ai-step-subject">Verdict: ${escapeHtml(targetName)}</div>
        <div class="ai-step-clues">
          <span class="ai-step-clues-label">Basis:</span>
          ${clueChips}
        </div>
        ${queriesHtml ? `<div class="ai-step-queries">${queriesHtml}</div>` : ""}
      </div>`;
  }).join("");

  feed.querySelectorAll(".ai-step-card").forEach((card) => {
    const idx = Number(card.dataset.stepIndex);
    const step = aiStepsLog[idx];
    card.addEventListener("mouseenter", () => {
      playbackCellId = step.verdict.cell_id;
      playbackClueIds = new Set(step.active_clue_ids || []);
      renderHighlights();
    });
    card.addEventListener("mouseleave", () => {
      playbackCellId = null;
      playbackClueIds = new Set();
      renderHighlights();
    });
  });
}

// ---------- 5. UTILITIES & STATE MANAGEMENT ----------

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
}

function showToast(message) {
  const toast = $("#toast");
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("visible"), 3600);
}

function showModal(title, message) {
  $("#modal-title").textContent = title;
  $("#modal-copy").textContent = message;
  $("#modal-backdrop").hidden = false;
}

function setState(next, { announceComplete = true } = {}) {
  const samePuzzle = state?.puzzle_id === next.puzzle_id;
  const wasComplete = samePuzzle && state.is_complete;

  const progressed = !samePuzzle || next.cells.some((cell, i) => cell.is_criminal !== state.cells[i]?.is_criminal);
  if (progressed) pendingHint = null;

  state = next;
  if (!samePuzzle) {
    aiStepsLog = [];
    const badge = $("#ai-steps-badge");
    if (badge) badge.hidden = true;
    renderBoard();
  }

  if (selectedId != null && !cellById(selectedId)) selectedId = null;
  if (!clueById(pinnedClueId)) pinnedClueId = null;
  if (!clueById(hoverClueId)) hoverClueId = null;

  render();
  renderWin(announceComplete && state.is_complete && !wasComplete);
}

function renderWin(justWon) {
  const panel = $("#win-panel");
  if (!panel) return;
  panel.hidden = !state.is_complete;
  if (!state.is_complete) return;

  $("#win-title").textContent = TEXT.caseClosedTitle;
  $("#win-body").textContent = solvedByAuto ? TEXT.caseClosedAuto : TEXT.caseClosedBody;
  $("#win-mistakes").textContent = mistakes;
  $("#win-hints").textContent = hintsUsed;
  if (justWon) panel.scrollIntoView({ block: "nearest", behavior: "smooth" });
}

function resetBoard(next) {
  selectedId = null;
  pinnedClueId = null;
  hoverClueId = null;
  hoverCellId = null;
  mistakes = 0;
  hintsUsed = 0;
  pendingHint = null;
  solvedByAuto = false;
  aiStepsLog = [];
  const badge = $("#ai-steps-badge");
  if (badge) badge.hidden = true;
  state = null;
  setState(next);
}

function setConnection(mode) {
  const live = mode === "live";
  $("#connection-label").textContent = live ? TEXT.live : TEXT.mock;
  $(".connection-stamp")?.classList.toggle("is-live", live);
  $("#footer-mode").textContent = live ? TEXT.footerLive : TEXT.footerMock;
  $("#offline-banner").hidden = live;
}

async function run(action) {
  if (busy || !state) return;
  busy = true;
  renderControls();
  try {
    await action();
  } catch (error) {
    if (error instanceof ApiError) {
      showModal(error.status === 0 ? TEXT.backendUnavailable : TEXT.requestFailed(error.status), error.message);
    } else {
      console.error(error);
      showModal(TEXT.unexpectedError, error.message);
    }
  } finally {
    busy = false;
    renderControls();
  }
}

async function connect() {
  try {
    api = new GameApi();
    resetBoard(await api.getGame());
  } catch (error) {
    console.warn("Falling back to mock data:", error);
    api = new MockGameApi();
    resetBoard(await api.getGame());
  }
  setConnection(api.mode);
  renderControls();
}

// ---------- 6. ACTIONS & GAMEPLAY ----------

$("#restart-btn").addEventListener("click", () => run(async () => {
  resetBoard(await api.restart());
  showToast(TEXT.restartToast);
}));

$("#load-case").addEventListener("click", () => run(async () => {
  const puzzleIds = await api.listPuzzles();
  if (!puzzleIds.length) return showToast(TEXT.noPuzzles);
  const next = puzzleIds[(puzzleIds.indexOf(state.puzzle_id) + 1) % puzzleIds.length];
  resetBoard(await api.loadPuzzle(next));
  showToast(TEXT.loadedToast(next));
}));

function useHint() {
  const waiting = pendingHint && cellById(pendingHint.cellId);
  if (waiting && !isProved(waiting)) {
    selectedId = pendingHint.cellId;
    renderSelection();
    showToast(TEXT.hintStep2(cellLabel(waiting), statusName(pendingHint.isCriminal)));
    return;
  }

  run(async () => {
    const hint = await api.hint();
    const checks = TEXT.satChecks(hint.sat_queries.length);
    if (hint.status === "FOUND") {
      hintsUsed += 1;
      pendingHint = { cellId: hint.verdict.cell_id, isCriminal: hint.verdict.is_criminal };
      selectedId = hint.verdict.cell_id;
      pinnedClueId = null;
      $("#hint-count").textContent = hintsUsed;
      renderSelection();
      cardViews.get(selectedId)?.card.focus({ preventScroll: true });
      showToast(TEXT.hintStep1(cellLabel(cellById(selectedId))));

      recordAiStep({
        step: aiStepsLog.length + 1,
        active_clue_ids: [],
        sat_queries: hint.sat_queries,
        verdict: hint.verdict,
        revealed_clue_ids: [],
      });
    } else if (hint.status === "SOLVED") {
      showToast(TEXT.hintSolvedBody(checks));
    } else if (hint.status === "UNKNOWN") {
      showToast(TEXT.hintUnknownBody(checks));
    } else {
      showModal(TEXT.inconsistentTitle, TEXT.hintInconsistentBody(checks));
    }
  });
}

$("#hint-btn").addEventListener("click", useHint);

$("#autosolve-btn").addEventListener("click", () => run(async () => {
  const result = await api.autoSolve();
  aiStepsLog = [];
  for (const step of result.trace) {
    recordAiStep(step);
  }
  await playTrace(state, result);

  if (result.status === "SOLVED") return;
  if (result.status === "STUCK") {
    showToast(TEXT.solveStuckToast(result.trace.length));
  } else {
    showModal(TEXT.solveTitles[result.status] ?? result.status, TEXT.solveInconsistent);
  }
}));

async function playTrace(before, result) {
  const finalClues = new Map(result.state.revealed_clues.map((clue) => [clue.id, clue]));
  let frame = structuredClone(before);
  selectedId = null;
  pinnedClueId = null;
  hoverClueId = null;
  hoverCellId = null;
  playback = { paused: false, skip: false };
  showPlayback(true);

  try {
    for (const [index, step] of result.trace.entries()) {
      if (playback.skip) break;
      $("#playback-label").textContent = TEXT.playbackLabel(index + 1, result.trace.length);
      playbackClueIds = new Set(step.active_clue_ids);
      playbackCellId = step.verdict.cell_id;
      renderHighlights();
      if (!await playbackWait(PLAYBACK_STEP_MS / 2)) break;

      frame = structuredClone(frame);
      const cell = frame.cells.find((item) => item.id === step.verdict.cell_id);
      if (cell) cell.is_criminal = step.verdict.is_criminal;
      for (const id of step.revealed_clue_ids) {
        if (finalClues.has(id) && !frame.revealed_clues.some((clue) => clue.id === id)) {
          frame.revealed_clues.push(finalClues.get(id));
        }
      }
      setState(frame, { announceComplete: false });
      if (!await playbackWait(PLAYBACK_STEP_MS / 2)) break;
    }
  } finally {
    playbackClueIds = new Set();
    playbackCellId = null;
    playback = null;
    showPlayback(false);
    if (result.status === "SOLVED") solvedByAuto = true;
    setState(result.state);
    renderHighlights();
  }
}

async function playbackWait(ms) {
  let left = ms;
  while (left > 0 || playback?.paused) {
    if (!playback || playback.skip) return false;
    await new Promise((resolve) => setTimeout(resolve, 50));
    if (!playback?.paused) left -= 50;
  }
  return !playback?.skip;
}

function showPlayback(on) {
  $("#playback-bar").hidden = !on;
  $(".board-toolbar .caption-hint").hidden = on;
  $("#playback-pause").textContent = TEXT.pause;
}

$("#playback-pause").addEventListener("click", () => {
  if (!playback) return;
  playback.paused = !playback.paused;
  $("#playback-pause").textContent = playback.paused ? TEXT.resume : TEXT.pause;
});

$("#playback-skip").addEventListener("click", () => {
  if (playback) playback.skip = true;
});

$("#win-again").addEventListener("click", () => $("#restart-btn").click());
$("#win-next").addEventListener("click", () => $("#load-case").click());

$("#retry-btn").addEventListener("click", async () => {
  if (busy) return;
  busy = true;
  renderControls();
  $("#retry-btn").disabled = true;
  showToast(TEXT.retrying);
  try {
    await connect();
  } finally {
    busy = false;
    $("#retry-btn").disabled = false;
    renderControls();
  }
  showToast(api.mode === "live" ? TEXT.reconnected : TEXT.stillOffline);
});

function submitVerdict(cellId, isCriminal) {
  const cell = cellById(cellId);
  if (!cell || isProved(cell) || api.mode !== "live") return;

  run(async () => {
    const result = await api.submitVerdict(cellId, isCriminal);
    const name = cellLabel(cellById(cellId));
    if (result.outcome === "ACCEPTED") {
      selectedId = cellId;
      setState(result.state);
      showToast(TEXT.acceptedToast(name, statusName(isCriminal)));
      return;
    }
    if (result.outcome === "NOT_PROVABLE" || result.outcome === "CONTRADICTED") {
      mistakes += 1;
      const card = cardViews.get(cellId)?.card;
      if (card) {
        card.classList.remove("is-wrong");
        void card.offsetWidth;
        card.classList.add("is-wrong");
      }
    }
    setState(result.state);
    if (result.outcome === "NOT_PROVABLE") showToast(TEXT.notProvableToast(name));
    else if (result.outcome === "CONTRADICTED") showToast(TEXT.contradictedToast(name));
    else if (result.outcome === "ALREADY_PROVED") showToast(TEXT.alreadyProvedToast(name));
    else showModal(TEXT.unexpectedOutcome, String(result.outcome));
  });
}

function moveSelection(dRow, dColumn) {
  const current = cellById(selectedId);
  const clamp = (value, max) => Math.min(max, Math.max(0, value));
  const target = current
    ? state.cells.find((cell) => cell.row === clamp(current.row + dRow, state.height - 1) && cell.column === clamp(current.column + dColumn, state.width - 1))
    : state.cells[0];
  if (!target) return;
  selectedId = target.id;
  pinnedClueId = null;
  renderSelection();
  cardViews.get(target.id)?.card.focus();
}

function showShortcuts() {
  showModal(TEXT.shortcutsTitle, TEXT.shortcutsBody);
}

$("#shortcuts-btn").addEventListener("click", showShortcuts);

$("#modal-close").addEventListener("click", () => { $("#modal-backdrop").hidden = true; });
$("#modal-ok").addEventListener("click", () => { $("#modal-backdrop").hidden = true; });
$("#modal-backdrop").addEventListener("click", (event) => {
  if (event.target.id === "modal-backdrop") event.currentTarget.hidden = true;
});

const ARROWS = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
window.addEventListener("keydown", (event) => {
  const modalOpen = !$("#modal-backdrop").hidden;

  if (event.key === "Escape") {
    if (modalOpen) {
      $("#modal-backdrop").hidden = true;
      return;
    }
    if (isAiPanelOpen) {
      toggleAiPanel(false);
      return;
    }
    selectedId = null;
    pinnedClueId = null;
    if (state) renderSelection();
    return;
  }

  if (modalOpen || !state || event.ctrlKey || event.metaKey || event.altKey) return;
  if (event.target.closest?.("input, textarea, select, [contenteditable]")) return;

  if (ARROWS[event.key]) {
    event.preventDefault();
    moveSelection(...ARROWS[event.key]);
    return;
  }

  const key = event.key.toLowerCase();
  if (key === "?") {
    event.preventDefault();
    showShortcuts();
  } else if (key === "h") {
    event.preventDefault();
    if (!$("#hint-btn").disabled) useHint();
  } else if (key === "i" || key === "c") {
    event.preventDefault();
    const cell = cellById(selectedId);
    if (!cell || isProved(cell)) {
      showToast(TEXT.selectFirst);
    } else {
      submitVerdict(cell.id, key === "c");
    }
  }
});

void loadAvatars();
await connect();
