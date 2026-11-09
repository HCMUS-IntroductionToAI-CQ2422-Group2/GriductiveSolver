import { ApiError, GameApi, MockGameApi } from "./api.js";

// State luôn có shape PublicStateResponse (BackEnd/APIs/schemas.py):
// { puzzle_id, height, width, is_complete,
//   cells: [{ id, row, column, character_name, profession, is_criminal: true|false|null }],
//   revealed_clues: [{ id, source_cell_id, description_nl, referenced_cell_ids }] }
let api = new GameApi();
const $ = (selector) => document.querySelector(selector);
let state;
let selectedId = null;
let selectedClueId = null;
let inspectMode = false;
let busy = false;
let toastTimer;
const cardViews = new Map();
let availableAvatars = new Set();

const coordinates = (row, column) => `${String.fromCharCode(65 + column)}${row + 1}`;
const initials = (name) => name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
const isProved = (cell) => cell.is_criminal === true || cell.is_criminal === false;
const statusLabel = (isCriminal) => isCriminal ? "CRIMINAL" : "INNOCENT";
const statusName = (isCriminal) => isCriminal ? "Criminal" : "Innocent";
const cellById = (id) => state.cells.find((cell) => cell.id === id);
const cellLabel = (cell) => cell ? `${cell.character_name} (${coordinates(cell.row, cell.column)})` : "Unknown cell";

function showAvatar(portrait, name) {
  const slug = name.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase()
    .replace(/đ/g, "d").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const file = `${slug}.svg`;
  if (!availableAvatars.has(file)) return;

  const image = new Image();
  image.alt = "";
  image.onload = () => {
    portrait.classList.remove("letter-avatar");
    portrait.replaceChildren(image);
  };
  image.src = new URL(`../avatars/${file}`, import.meta.url).href;
}

async function loadAvatars() {
  try {
    const response = await fetch(new URL("../../avatars.json", import.meta.url));
    if (!response.ok) return;
    availableAvatars = new Set(await response.json());
  } catch {
    return;
  }

  for (const cell of state?.cells ?? []) {
    showAvatar(cardViews.get(cell.id).portrait, cell.character_name);
  }
}

function renderBoard() {
  const board = $("#board");
  board.style.setProperty("--columns", state.width);
  cardViews.clear();
  const grid = document.createDocumentFragment();
  const corner = document.createElement("span"); corner.className = "coord corner"; corner.textContent = "↘"; grid.append(corner);
  for (let column = 0; column < state.width; column++) { const label = document.createElement("span"); label.className = "coord col-label"; label.textContent = String.fromCharCode(65 + column); grid.append(label); }
  for (let row = 0; row < state.height; row++) {
    const rowLabel = document.createElement("span"); rowLabel.className = "coord row-label"; rowLabel.textContent = row + 1; grid.append(rowLabel);
    for (let column = 0; column < state.width; column++) {
      const cell = state.cells.find((item) => item.row === row && item.column === column);
      if (!cell) { const blank = document.createElement("div"); blank.className = "board-blank"; grid.append(blank); continue; }
      const view = makeCard(cell);
      cardViews.set(cell.id, view);
      grid.append(view.card);
    }
  }
  board.replaceChildren(grid);
}

function render() {
  for (const cell of state.cells) {
    const { card, flag } = cardViews.get(cell.id);
    const isRevealed = isProved(cell);
    card.classList.toggle("is-revealed", isRevealed);
    card.classList.toggle("is-hidden", !isRevealed);
    card.setAttribute("aria-label", `${coordinates(cell.row, cell.column)} ${cell.character_name}${isRevealed ? `, ${statusName(cell.is_criminal)}` : ", unrevealed"}`);
    flag.classList.toggle("flag-criminal", cell.is_criminal === true);
    flag.classList.toggle("flag-innocent", cell.is_criminal === false);
    flag.textContent = isRevealed ? statusLabel(cell.is_criminal) : "UNREVEALED";
  }
  const revealedCount = state.cells.filter(isProved).length;
  $("#case-name").textContent = state.puzzle_id;
  $("#board-size").textContent = `${state.height} × ${state.width}`;
  $("#known-count").textContent = `${revealedCount} revealed`;
  $("#progress-label").textContent = `${revealedCount} / ${state.cells.length}`;
  $("#progress-bar").style.width = `${state.cells.length ? revealedCount / state.cells.length * 100 : 0}%`;
  renderSelection();
}

function renderSelection() {
  const clue = state.revealed_clues.find((item) => item.id === selectedClueId);
  const highlighted = new Set(clue?.referenced_cell_ids);
  for (const [id, { card }] of cardViews) {
    card.classList.toggle("is-selected", id === selectedId);
    card.classList.toggle("is-highlighted", highlighted.has(id));
  }
  renderControls();
  renderInspector();
}

function renderControls() {
  const cell = cellById(selectedId);
  $("#selected-label").textContent = cell ? `${cell.character_name} · ${coordinates(cell.row, cell.column)}` : "No character selected";
  const live = api.mode === "live";
  const canSubmit = live && !busy && cell && !isProved(cell);
  document.querySelectorAll(".verdict-button").forEach((button) => {
    button.disabled = !canSubmit;
  });
  $("#load-case").disabled = busy;
  $("#restart-btn").disabled = busy;
  $("#hint-btn").disabled = busy || !live;
  $("#autosolve-btn").disabled = busy || !live;
  $("#inspect-toggle").disabled = busy;
  $("#board").setAttribute("aria-busy", String(busy));
}

function makeCard(cell) {
  const card = document.createElement("button");
  card.className = "character-card";
  card.type = "button";
  const portrait = document.createElement("span");
  portrait.className = "portrait letter-avatar";
  portrait.setAttribute("aria-hidden", "true");
  portrait.textContent = initials(cell.character_name);
  showAvatar(portrait, cell.character_name);
  card.append(portrait);
  const details = document.createElement("span"); details.className = "card-details";
  const name = document.createElement("strong"); name.textContent = cell.character_name;
  const job = document.createElement("small"); job.textContent = cell.profession;
  details.append(name, job); card.append(details);
  const flag = document.createElement("span"); flag.className = "card-flag";
  card.append(flag);
  const coord = document.createElement("span"); coord.className = "card-coordinate"; coord.textContent = coordinates(cell.row, cell.column); card.append(coord);
  card.addEventListener("click", () => onCardClick(cellById(cell.id)));
  return { card, flag, portrait };
}

function onCardClick(cell) {
  if (busy) return;

  const isRevealed = isProved(cell);
  if (inspectMode) {
    inspectMode = false; $("#inspect-toggle").classList.remove("active");
    if (!isRevealed) showToast("Only a revealed card can be inspected.");
  }
  if (isRevealed) {
    selectedId = cell.id;
    // Một ô có thể mở nhiều clue: bấm lại cùng ô để xoay vòng qua các clue của nó.
    const clues = state.revealed_clues.filter((item) => item.source_cell_id === cell.id);
    const current = clues.findIndex((item) => item.id === selectedClueId);
    selectedClueId = clues.length ? clues[(current + 1) % clues.length].id : null;
    if (!clues.length) showToast(`${cell.character_name} has no clue attached.`);
    $("#inspector").classList.add("open");
  } else {
    selectedId = selectedId === cell.id ? null : cell.id;
    selectedClueId = null;
    $("#inspector").classList.remove("open");
  }
  renderSelection();
}

function renderInspector() {
  const content = $("#inspector-content");
  const clue = state.revealed_clues.find((item) => item.id === selectedClueId);
  if (!clue) {
    content.innerHTML = `<div class="empty-state"><span class="empty-icon">⌕</span><strong>Nothing under the lens</strong><p>Select a revealed card or a clue below to highlight the cells it refers to.</p></div>${renderClueList()}`;
    bindClueList(content);
    return;
  }
  const source = clue.source_cell_id == null ? null : cellById(clue.source_cell_id);
  const targetCells = (clue.referenced_cell_ids || []).map(cellById).filter(Boolean);
  content.innerHTML = `<div class="clue-source"><span class="clue-bullet">✳</span><span><small>REVEALED BY</small><strong>${escapeHtml(source?.character_name ?? "Public starting clue")}</strong></span><span class="clue-id">#${String(clue.id).padStart(2, "0")}</span></div><blockquote>${escapeHtml(clue.description_nl)}</blockquote><div class="region-label">REFERENCED CELLS <span>${targetCells.length}</span></div><div class="target-list">${targetCells.map((cell) => `<span>${coordinates(cell.row, cell.column)} <b>${escapeHtml(cell.character_name)}</b></span>`).join("") || "<span class='no-targets'>No cell mapping provided.</span>"}</div><div class="truth-note"><span>✓</span> This clue is always true, regardless of its owner's status.</div>${renderClueList()}`;
  bindClueList(content);
}

function renderClueList() {
  if (!state.revealed_clues.length) return "";
  const items = state.revealed_clues.map((clue) => `<button type="button" class="clue-list-item${clue.id === selectedClueId ? " active" : ""}" data-clue-id="${clue.id}"><span>#${String(clue.id).padStart(2, "0")}</span>${escapeHtml(clue.description_nl)}</button>`).join("");
  return `<div class="region-label">PUBLIC CLUES <span>${state.revealed_clues.length}</span></div><div class="clue-list">${items}</div>`;
}

function bindClueList(container) {
  container.querySelectorAll("[data-clue-id]").forEach((button) => button.addEventListener("click", () => {
    if (busy) return;

    const id = Number(button.dataset.clueId);
    const clue = state.revealed_clues.find((item) => item.id === id);
    selectedId = clue.source_cell_id;
    selectedClueId = selectedClueId === id ? null : id;
    renderSelection();
  }));
}

function escapeHtml(value) { return String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]); }
function showToast(message) { const toast = $("#toast"); toast.textContent = message; toast.classList.add("visible"); clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.classList.remove("visible"), 3600); }
function showModal(title, message) { $("#modal-title").textContent = title; $("#modal-copy").textContent = message; $("#modal-backdrop").hidden = false; }

function setState(next, { announceComplete = true } = {}) {
  const samePuzzle = state?.puzzle_id === next.puzzle_id;
  const wasComplete = samePuzzle && state.is_complete;
  state = next;
  if (!samePuzzle) renderBoard();
  if (selectedId != null && !cellById(selectedId)) selectedId = null;
  if (!state.revealed_clues.some((clue) => clue.id === selectedClueId)) selectedClueId = null;
  render();
  if (announceComplete && state.is_complete && !wasComplete) showModal("Case closed", "Every character has a proven verdict. Well reasoned!");
}

function setConnection(mode) {
  const live = mode === "live";
  $("#connection-label").textContent = live ? "LIVE API" : "OFFLINE · MOCK";
  $("#footer-mode").textContent = live ? "Connected to backend API" : "Backend unreachable — showing local mock data (read-only)";
}

// Chạy một action gọi API: chặn bấm trùng và hiện lỗi thống nhất.
async function run(action) {
  if (busy || !state) return;
  busy = true; renderControls();
  try { await action(); }
  catch (error) {
    if (error instanceof ApiError) showModal(error.status === 0 ? "Backend unavailable" : `Request failed (${error.status})`, error.message);
    else { console.error(error); showModal("Unexpected error", error.message); }
  } finally { busy = false; renderControls(); }
}

async function connect() {
  try {
    api = new GameApi();
    state = null;
    setState(await api.getGame());
  } catch (error) {
    console.warn("Falling back to mock data:", error);
    api = new MockGameApi();
    state = null;
    setState(await api.getGame());
  }
  setConnection(api.mode);
}

$("#restart-btn").addEventListener("click", () => run(async () => {
  selectedId = null; selectedClueId = null;
  setState(await api.restart());
  showToast("Board restored to its initial public state.");
}));

$("#load-case").addEventListener("click", () => run(async () => {
  const puzzleIds = await api.listPuzzles();
  if (!puzzleIds.length) return showToast("The backend has no puzzles to load.");
  // Xoay vòng sang đề kế tiếp trong danh sách (hoặc nạp lại đề hiện tại nếu chỉ có 1).
  const next = puzzleIds[(puzzleIds.indexOf(state.puzzle_id) + 1) % puzzleIds.length];
  const nextState = await api.loadPuzzle(next);
  selectedId = null; selectedClueId = null; state = null;
  setState(nextState);
  showToast(`Case "${next}" is loaded.`);
}));

$("#hint-btn").addEventListener("click", () => run(async () => {
  const hint = await api.hint();
  const checks = `${hint.sat_queries.length} SAT check${hint.sat_queries.length === 1 ? "" : "s"}`;
  if (hint.status === "FOUND") {
    const cell = cellById(hint.verdict.cell_id);
    selectedId = hint.verdict.cell_id;
    selectedClueId = null;
    $("#inspector").classList.remove("open");
    renderSelection();
    showModal("A small nudge", `${cellLabel(cell)} can now be proven ${statusName(hint.verdict.is_criminal).toLowerCase()}. The card is selected for you. (${checks})`);
  } else if (hint.status === "SOLVED") showModal("Nothing left to prove", `Every character already has a verdict. (${checks})`);
  else if (hint.status === "UNKNOWN") showModal("No forced verdict", `The public clues do not force any remaining card yet. (${checks})`);
  else showModal("Inconsistent clues", `The public clues contradict each other — this puzzle has no solution. (${checks})`);
}));

$("#autosolve-btn").addEventListener("click", () => run(async () => {
  const result = await api.autoSolve();
  const before = state;
  const steps = result.trace.map((step) => {
    const cell = before.cells.find((item) => item.id === step.verdict.cell_id);
    const opened = step.revealed_clue_ids.length ? ` → opens clue ${step.revealed_clue_ids.map((id) => `#${id}`).join(", ")}` : "";
    return `${step.step}. ${cellLabel(cell)}: ${statusName(step.verdict.is_criminal)}${opened}`;
  });
  selectedId = null;
  setState(result.state, { announceComplete: false });
  const title = { SOLVED: "Solved", STUCK: "Stuck", INCONSISTENT: "Inconsistent clues" }[result.status] ?? result.status;
  const summary = result.status === "STUCK" ? "No further verdict is forced by the public clues." : result.status === "INCONSISTENT" ? "The public clues contradict each other." : "Every verdict was proven without guessing.";
  showModal(title, `${summary}\n\n${steps.length ? steps.join("\n") : "No new verdicts were made."}`);
}));

$(".verdict-controls").addEventListener("click", (event) => {
  const button = event.target.closest("[data-status]"); if (!button || selectedId == null) return;
  const cellId = selectedId;
  const isCriminal = button.dataset.status === "CRIMINAL";
  run(async () => {
    const result = await api.submitVerdict(cellId, isCriminal);
    const name = cellLabel(cellById(cellId));
    if (result.outcome === "ACCEPTED") {
      selectedId = cellId;
      const opened = result.state.revealed_clues.find((clue) => clue.source_cell_id === cellId);
      selectedClueId = opened?.id ?? null;
      setState(result.state);
      showToast(`Verdict accepted: ${name} is ${statusName(isCriminal).toLowerCase()}.`);
      return;
    }
    setState(result.state);
    if (result.outcome === "NOT_PROVABLE") showModal("Not provable yet", `The current public clues do not force a verdict for ${name}. The card remains unrevealed.`);
    else if (result.outcome === "CONTRADICTED") showModal("Contradicted", `The public clues force the opposite status for ${name}. The card remains unrevealed.`);
    else if (result.outcome === "ALREADY_PROVED") showModal("Already proved", `${name} already has a proven verdict.`);
    else showModal("Unexpected outcome", String(result.outcome));
  });
});

$("#inspect-toggle").addEventListener("click", () => { inspectMode = !inspectMode; $("#inspect-toggle").classList.toggle("active", inspectMode); showToast(inspectMode ? "Choose a revealed card to inspect its clue." : "Clue inspection closed."); });
$("#close-inspector").addEventListener("click", () => $("#inspector").classList.remove("open"));
$("#modal-close").addEventListener("click", () => { $("#modal-backdrop").hidden = true; });
$("#modal-ok").addEventListener("click", () => { $("#modal-backdrop").hidden = true; });
$("#modal-backdrop").addEventListener("click", (event) => { if (event.target.id === "modal-backdrop") event.currentTarget.hidden = true; });
window.addEventListener("keydown", (event) => { if (event.key === "Escape") { $("#modal-backdrop").hidden = true; $("#inspector").classList.remove("open"); } });

void loadAvatars();
await connect();
