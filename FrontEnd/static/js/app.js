import { GameApi } from "./api.js";

const api = new GameApi();
const $ = (selector) => document.querySelector(selector);
let state;
let selectedId = null;
let selectedClueId = null;
let inspectMode = false;
let toastTimer;

const coordinates = (row, column) => `${String.fromCharCode(65 + column)}${row + 1}`;
const initials = (name) => name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
const statusName = (status) => status === "CRIMINAL" ? "Criminal" : "Innocent";

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
  const revealedCount = Object.keys(state.provedStatuses).length;
  $("#board-size").textContent = `${state.height} × ${state.width}`;
  $("#known-count").textContent = `${revealedCount} revealed`;
  $("#progress-label").textContent = `${revealedCount} / ${state.cells.length}`;
  $("#progress-bar").style.width = `${revealedCount / state.cells.length * 100}%`;
  const cell = state.cells.find((item) => item.id === selectedId);
  $("#selected-label").textContent = cell ? `${cell.name} · ${coordinates(cell.row, cell.column)}` : "No character selected";
  document.querySelectorAll(".verdict-button").forEach((button) => { button.disabled = !cell; });
  renderInspector();
}

function makeCard(cell) {
  const isRevealed = Object.hasOwn(state.provedStatuses, cell.id);
  const card = document.createElement("button");
  card.className = `character-card ${isRevealed ? "is-revealed" : "is-hidden"}${cell.id === selectedId ? " is-selected" : ""}${isHighlighted(cell.id) ? " is-highlighted" : ""}`;
  card.type = "button";
  card.setAttribute("aria-label", `${coordinates(cell.row, cell.column)} ${cell.name}${isRevealed ? `, ${statusName(state.provedStatuses[cell.id])}` : ", unrevealed"}`);
  const portrait = document.createElement("span"); portrait.className = "portrait";
  const image = document.createElement("img"); image.src = `static/avatars/${cell.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.svg`; image.alt = "";
  image.onerror = () => { portrait.classList.add("letter-avatar"); portrait.innerHTML = `<span>${initials(cell.name)}</span>`; };
  portrait.append(image); card.append(portrait);
  const details = document.createElement("span"); details.className = "card-details";
  const name = document.createElement("strong"); name.textContent = cell.name;
  const job = document.createElement("small"); job.textContent = cell.profession;
  details.append(name, job); card.append(details);
  const flag = document.createElement("span"); flag.className = "card-flag";
  if (isRevealed) { flag.textContent = state.provedStatuses[cell.id] === "CRIMINAL" ? "CRIMINAL" : "INNOCENT"; flag.classList.add(state.provedStatuses[cell.id] === "CRIMINAL" ? "flag-criminal" : "flag-innocent"); }
  else flag.textContent = "UNREVEALED";
  card.append(flag);
  const coord = document.createElement("span"); coord.className = "card-coordinate"; coord.textContent = coordinates(cell.row, cell.column); card.append(coord);
  card.addEventListener("click", () => onCardClick(cell, isRevealed));
  return card;
}

function isHighlighted(cellId) {
  const clue = state.revealedClues.find((item) => item.id === selectedClueId);
  return Boolean(clue?.targetCellIds?.includes(cellId));
}

function onCardClick(cell, isRevealed) {
  if (inspectMode) {
    inspectMode = false; $("#inspect-toggle").classList.remove("active");
    if (!isRevealed) return showToast("Only a revealed card can be inspected.");
  }
  if (isRevealed) {
    const clue = state.revealedClues.find((item) => item.sourceCellId === cell.id);
    selectedClueId = clue?.id ?? null;
    $("#inspector").classList.add("open");
    render();
    return;
  }
  selectedId = selectedId === cell.id ? null : cell.id;
  render();
}

function renderInspector() {
  const content = $("#inspector-content");
  const clue = state.revealedClues.find((item) => item.id === selectedClueId);
  if (!clue) {
    content.innerHTML = `<div class="empty-state"><span class="empty-icon">⌕</span><strong>Nothing under the lens</strong><p>Select a revealed card to read its clue and highlight the cells it refers to.</p></div>`;
    return;
  }
  const source = state.cells.find((cell) => cell.id === clue.sourceCellId);
  const targetCells = (clue.targetCellIds || []).map((id) => state.cells.find((cell) => cell.id === id)).filter(Boolean);
  content.innerHTML = `<div class="clue-source"><span class="clue-bullet">✳</span><span><small>REVEALED BY</small><strong>${source?.name || "Public clue"}</strong></span><span class="clue-id">#${String(clue.id).padStart(2, "0")}</span></div><blockquote>${escapeHtml(clue.description)}</blockquote><div class="region-label">REFERENCED CELLS <span>${targetCells.length}</span></div><div class="target-list">${targetCells.map((cell) => `<span>${coordinates(cell.row, cell.column)} <b>${escapeHtml(cell.name)}</b></span>`).join("") || "<span class='no-targets'>No cell mapping provided.</span>"}</div><div class="truth-note"><span>✓</span> This clue is always true, regardless of its owner's status.</div>`;
}

function escapeHtml(value) { return String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]); }
function showToast(message) { const toast = $("#toast"); toast.textContent = message; toast.classList.add("visible"); clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.classList.remove("visible"), 3600); }
function showModal(title, message) { $("#modal-title").textContent = title; $("#modal-copy").textContent = message; $("#modal-backdrop").hidden = false; }

async function load() { state = await api.load(); selectedId = null; selectedClueId = null; render(); }
$("#restart-btn").addEventListener("click", async () => { await api.restart(); await load(); showToast("Board restored to its initial public state."); });
$("#load-case").addEventListener("click", async () => { await load(); showToast("The local demonstration case is loaded."); });
$("#hint-btn").addEventListener("click", async () => { const result = await api.hint(); showModal(result.available ? "A small nudge" : "Hint unavailable", result.message); });
$("#autosolve-btn").addEventListener("click", async () => { const result = await api.autoSolve(); showToast(result.available ? result.message : result.message); });
$(".verdict-controls").addEventListener("click", async (event) => {
  const button = event.target.closest("[data-status]"); if (!button || selectedId == null) return;
  const result = await api.submitVerdict(selectedId, button.dataset.status);
  if (result.outcome === "ACCEPTED") { state = result.publicState; selectedId = null; render(); showToast("Verdict accepted. The public card has been revealed."); }
  else if (result.outcome === "NOT_PROVABLE") showModal("Not provable yet", "The current public clues do not force a verdict. The card remains unrevealed.");
  else if (result.outcome === "CONTRADICTED") showModal("Contradicted", "The opposite status is forced by the public clues. The card remains unrevealed.");
  else showModal("Verdict checking unavailable", result.message || "The verdict endpoint is waiting for the agreed API contract. No card was revealed.");
});
$("#inspect-toggle").addEventListener("click", () => { inspectMode = !inspectMode; $("#inspect-toggle").classList.toggle("active", inspectMode); showToast(inspectMode ? "Choose a revealed card to inspect its clue." : "Clue inspection closed."); });
$("#close-inspector").addEventListener("click", () => $("#inspector").classList.remove("open"));
$("#modal-close").addEventListener("click", () => { $("#modal-backdrop").hidden = true; });
$("#modal-ok").addEventListener("click", () => { $("#modal-backdrop").hidden = true; });
$("#modal-backdrop").addEventListener("click", (event) => { if (event.target.id === "modal-backdrop") event.currentTarget.hidden = true; });
window.addEventListener("keydown", (event) => { if (event.key === "Escape") { $("#modal-backdrop").hidden = true; $("#inspector").classList.remove("open"); } });

await load();
