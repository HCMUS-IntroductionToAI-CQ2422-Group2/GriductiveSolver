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
const missingAvatars = new Set(); // tránh request lại ảnh 404 mỗi lần render

const coordinates = (row, column) => `${String.fromCharCode(65 + column)}${row + 1}`;
const initials = (name) => name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
const isProved = (cell) => cell.is_criminal === true || cell.is_criminal === false;
const statusLabel = (isCriminal) => isCriminal ? "CRIMINAL" : "INNOCENT";
const statusName = (isCriminal) => isCriminal ? "Criminal" : "Innocent";
const cellById = (id) => state.cells.find((cell) => cell.id === id);
const cellLabel = (cell) => cell ? `${cell.character_name} (${coordinates(cell.row, cell.column)})` : "Unknown cell";
const avatarSlug = (name) => name.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/gi, "d").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

function render() {
  const board = $("#board");
  board.style.setProperty("--columns", state.width);
  board.innerHTML = "";
  const corner = document.createElement("span"); corner.className = "coord corner"; corner.textContent = "↘"; board.append(corner);
  for (let column = 0; column < state.width; column++) { const label = document.createElement("span"); label.className = "coord col-label"; label.textContent = String.fromCharCode(65 + column); board.append(label); }
  for (let row = 0; row < state.height; row++) {
    const rowLabel = document.createElement("span"); rowLabel.className = "coord row-label"; rowLabel.textContent = row + 1; board.append(rowLabel);
    for (let column = 0; column < state.width; column++) {
      const cell = state.cells.find((item) => item.row === row && item.column === column);
      if (!cell) { const blank = document.createElement("div"); blank.className = "board-blank"; board.append(blank); continue; }
      board.append(makeCard(cell));
    }
  }
  const revealedCount = state.cells.filter(isProved).length;
  $("#case-name").textContent = state.puzzle_id;
  $("#board-size").textContent = `${state.height} × ${state.width}`;
  $("#known-count").textContent = `${revealedCount} revealed`;
  $("#progress-label").textContent = `${revealedCount} / ${state.cells.length}`;
  $("#progress-bar").style.width = `${state.cells.length ? revealedCount / state.cells.length * 100 : 0}%`;
  const cell = cellById(selectedId);
  $("#selected-label").textContent = cell ? `${cell.character_name} · ${coordinates(cell.row, cell.column)}` : "No character selected";
  document.querySelectorAll(".verdict-button").forEach((button) => { button.disabled = !cell || busy || api.mode !== "live"; });
  renderInspector();
}

function makeCard(cell) {
  const isRevealed = isProved(cell);
  const card = document.createElement("button");
  card.className = `character-card ${isRevealed ? "is-revealed" : "is-hidden"}${cell.id === selectedId ? " is-selected" : ""}${isHighlighted(cell.id) ? " is-highlighted" : ""}`;
  card.type = "button";
  card.setAttribute("aria-label", `${coordinates(cell.row, cell.column)} ${cell.character_name}${isRevealed ? `, ${statusName(cell.is_criminal)}` : ", unrevealed"}`);
  const portrait = document.createElement("span"); portrait.className = "portrait";
  const slug = avatarSlug(cell.character_name);
  const useLetters = () => { portrait.classList.add("letter-avatar"); portrait.innerHTML = ""; const letters = document.createElement("span"); letters.textContent = initials(cell.character_name); portrait.append(letters); };
  if (missingAvatars.has(slug)) useLetters();
  else {
    const image = document.createElement("img"); image.src = `static/avatars/${slug}.svg`; image.alt = "";
    image.onerror = () => { missingAvatars.add(slug); useLetters(); };
    portrait.append(image);
  }
  card.append(portrait);
  const details = document.createElement("span"); details.className = "card-details";
  const name = document.createElement("strong"); name.textContent = cell.character_name;
  const job = document.createElement("small"); job.textContent = cell.profession;
  details.append(name, job); card.append(details);
  const flag = document.createElement("span"); flag.className = "card-flag";
  if (isRevealed) { flag.textContent = statusLabel(cell.is_criminal); flag.classList.add(cell.is_criminal ? "flag-criminal" : "flag-innocent"); }
  else flag.textContent = "UNREVEALED";
  card.append(flag);
  const coord = document.createElement("span"); coord.className = "card-coordinate"; coord.textContent = coordinates(cell.row, cell.column); card.append(coord);
  card.addEventListener("click", () => onCardClick(cell, isRevealed));
  return card;
}

function isHighlighted(cellId) {
  const clue = state.revealed_clues.find((item) => item.id === selectedClueId);
  return Boolean(clue?.referenced_cell_ids?.includes(cellId));
}

function onCardClick(cell, isRevealed) {
  if (inspectMode) {
    inspectMode = false; $("#inspect-toggle").classList.remove("active");
    if (!isRevealed) return showToast("Only a revealed card can be inspected.");
  }
  if (isRevealed) {
    // Một ô có thể mở nhiều clue: bấm lại cùng ô để xoay vòng qua các clue của nó.
    const clues = state.revealed_clues.filter((item) => item.source_cell_id === cell.id);
    const current = clues.findIndex((item) => item.id === selectedClueId);
    selectedClueId = clues.length ? clues[(current + 1) % clues.length].id : null;
    if (!clues.length) showToast(`${cell.character_name} has no clue attached.`);
    $("#inspector").classList.add("open");
    render();
    return;
  }
  selectedId = selectedId === cell.id ? null : cell.id;
  render();
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
    const id = Number(button.dataset.clueId);
    selectedClueId = selectedClueId === id ? null : id;
    render();
  }));
}

function escapeHtml(value) { return String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]); }
function showToast(message) { const toast = $("#toast"); toast.textContent = message; toast.classList.add("visible"); clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.classList.remove("visible"), 3600); }
function showModal(title, message) { $("#modal-title").textContent = title; $("#modal-copy").textContent = message; $("#modal-backdrop").hidden = false; }

function setState(next) {
  const wasComplete = state?.puzzle_id === next.puzzle_id && state?.is_complete;
  state = next;
  if (selectedId != null && (!cellById(selectedId) || isProved(cellById(selectedId)))) selectedId = null;
  if (!state.revealed_clues.some((clue) => clue.id === selectedClueId)) selectedClueId = null;
  render();
  if (state.is_complete && !wasComplete) showModal("Case closed", "Every character has a proven verdict. Well reasoned!");
}

function setConnection(mode) {
  const live = mode === "live";
  $("#connection-label").textContent = live ? "LIVE API" : "OFFLINE · MOCK";
  $("#footer-mode").textContent = live ? "Connected to backend API" : "Backend unreachable — showing local mock data (read-only)";
}

// Chạy một action gọi API: chặn bấm trùng và hiện lỗi thống nhất.
async function run(action) {
  if (busy) return;
  busy = true; render();
  try { await action(); }
  catch (error) {
    if (error instanceof ApiError) showModal(error.status === 0 ? "Backend unavailable" : `Request failed (${error.status})`, error.message);
    else { console.error(error); showModal("Unexpected error", error.message); }
  } finally { busy = false; render(); }
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
  selectedId = null; selectedClueId = null; state = null;
  setState(await api.loadPuzzle(next));
  showToast(`Case "${next}" is loaded.`);
}));

$("#hint-btn").addEventListener("click", () => run(async () => {
  const hint = await api.hint();
  const checks = `${hint.sat_queries.length} SAT check${hint.sat_queries.length === 1 ? "" : "s"}`;
  if (hint.status === "FOUND") {
    const cell = cellById(hint.verdict.cell_id);
    selectedId = hint.verdict.cell_id;
    render();
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
  // Gán trực tiếp (không qua setState) để modal tóm tắt dưới đây không bị modal "Case closed" đè.
  selectedId = null;
  state = result.state;
  if (!state.revealed_clues.some((clue) => clue.id === selectedClueId)) selectedClueId = null;
  render();
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
      selectedId = null;
      setState(result.state);
      const opened = result.state.revealed_clues.find((clue) => clue.source_cell_id === cellId);
      if (opened) selectedClueId = opened.id;
      render();
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

await connect();
