import { ApiError, GameApi, MockGameApi } from "./api.js";

// State luôn có shape PublicStateResponse (BackEnd/APIs/schemas.py):
// { puzzle_id, height, width, is_complete,
//   cells: [{ id, row, column, character_name, profession, is_criminal: true|false|null }],
//   revealed_clues: [{ id, source_cell_id, description_nl, referenced_cell_ids }] }

// Toàn bộ chữ hiển thị trên UI nằm ở đây, để đổi ngôn ngữ hoặc thuật ngữ chỉ cần sửa một chỗ.
const TEXT = {
  innocent: "Innocent",
  criminal: "Criminal",
  flagInnocent: "INNOCENT",
  flagCriminal: "CRIMINAL",
  flagUnrevealed: "UNREVEALED",
  unrevealed: "unrevealed",
  revealedCount: (n) => `${n} revealed`,
  noSelection: "No character selected",
  unknownCell: "Unknown cell",
  publicClue: "Public starting clue",
  revealedBy: "REVEALED BY",
  newBadge: "NEW",
  noClues: "No clues yet. Prove a character to reveal their clue.",
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
  caseClosedBody: "Every character has a proven verdict. Well reasoned!",
  hintFoundTitle: "A small nudge",
  hintFoundBody: (label, status, checks) => `${label} can now be proven ${status.toLowerCase()}. The card is selected for you. (${checks})`,
  hintSolvedTitle: "Nothing left to prove",
  hintSolvedBody: (checks) => `Every character already has a verdict. (${checks})`,
  hintUnknownTitle: "No forced verdict",
  hintUnknownBody: (checks) => `The public clues do not force any remaining card yet. (${checks})`,
  inconsistentTitle: "Inconsistent clues",
  hintInconsistentBody: (checks) => `The public clues contradict each other — this puzzle has no solution. (${checks})`,
  satChecks: (n) => `${n} SAT check${n === 1 ? "" : "s"}`,
  solveTitles: { SOLVED: "Solved", STUCK: "Stuck", INCONSISTENT: "Inconsistent clues" },
  solveStuck: "No further verdict is forced by the public clues.",
  solveInconsistent: "The public clues contradict each other.",
  solveDone: "Every verdict was proven without guessing.",
  solveNone: "No new verdicts were made.",
  opensClues: (ids) => ` → opens clue ${ids.map((id) => `#${id}`).join(", ")}`,
  notProvableTitle: "Not provable yet",
  notProvableBody: (name) => `The current public clues do not force a verdict for ${name}. The card remains unrevealed.`,
  contradictedTitle: "Contradicted",
  contradictedBody: (name) => `The public clues force the opposite status for ${name}. The card remains unrevealed.`,
  alreadyProvedTitle: "Already proved",
  alreadyProvedBody: (name) => `${name} already has a proven verdict.`,
  unexpectedOutcome: "Unexpected outcome",
  backendUnavailable: "Backend unavailable",
  requestFailed: (status) => `Request failed (${status})`,
  unexpectedError: "Unexpected error",
};

let api = new GameApi();
const $ = (selector) => document.querySelector(selector);
let state;
let selectedId = null;      // nhân vật đang chọn (để phán quyết hoặc xem manh mối của họ)
let pinnedClueId = null;    // manh mối được bấm ghim: giữ highlight trên bảng
let hoverClueId = null;     // manh mối đang rê chuột
let hoverCellId = null;     // nhân vật đang rê chuột
let busy = false;
let toastTimer;
const cardViews = new Map();
let availableAvatars = new Set();
let clueOrder = [];         // id manh mối theo thứ tự xuất hiện
let newClueIds = new Set(); // manh mối vừa mở ở lần cập nhật gần nhất

const coordinates = (row, column) => `${String.fromCharCode(65 + column)}${row + 1}`;
const initials = (name) => name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
const isProved = (cell) => cell.is_criminal === true || cell.is_criminal === false;
const statusLabel = (isCriminal) => isCriminal ? TEXT.flagCriminal : TEXT.flagInnocent;
const statusName = (isCriminal) => isCriminal ? TEXT.criminal : TEXT.innocent;
const cellById = (id) => state.cells.find((cell) => cell.id === id);
const clueById = (id) => state.revealed_clues.find((clue) => clue.id === id);
const cellLabel = (cell) => cell ? `${cell.character_name} (${coordinates(cell.row, cell.column)})` : TEXT.unknownCell;
const clueTag = (id) => `#${String(id).padStart(2, "0")}`;

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

// ---------- Bảng nhân vật ----------

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
  card.addEventListener("mouseenter", () => { hoverCellId = cell.id; renderHighlights(); });
  card.addEventListener("mouseleave", () => { if (hoverCellId === cell.id) { hoverCellId = null; renderHighlights(); } });
  card.addEventListener("focus", () => { hoverCellId = cell.id; renderHighlights(); });
  card.addEventListener("blur", () => { if (hoverCellId === cell.id) { hoverCellId = null; renderHighlights(); } });
  return { card, flag, portrait };
}

function render() {
  for (const cell of state.cells) {
    const { card, flag } = cardViews.get(cell.id);
    const isRevealed = isProved(cell);
    card.classList.toggle("is-revealed", isRevealed);
    card.classList.toggle("is-hidden", !isRevealed);
    card.setAttribute("aria-label", `${coordinates(cell.row, cell.column)} ${cell.character_name}${isRevealed ? `, ${statusName(cell.is_criminal)}` : `, ${TEXT.unrevealed}`}`);
    flag.classList.toggle("flag-criminal", cell.is_criminal === true);
    flag.classList.toggle("flag-innocent", cell.is_criminal === false);
    flag.textContent = isRevealed ? statusLabel(cell.is_criminal) : TEXT.flagUnrevealed;
  }
  const revealedCount = state.cells.filter(isProved).length;
  $("#case-name").textContent = state.puzzle_id;
  $("#board-size").textContent = `${state.height} × ${state.width}`;
  $("#known-count").textContent = TEXT.revealedCount(revealedCount);
  $("#progress-label").textContent = `${revealedCount} / ${state.cells.length}`;
  $("#progress-bar").style.width = `${state.cells.length ? revealedCount / state.cells.length * 100 : 0}%`;
  renderClueFeed();
  renderSelection();
}

function renderSelection() {
  for (const [id, { card }] of cardViews) card.classList.toggle("is-selected", id === selectedId);
  renderControls();
  renderHighlights();
}

function renderControls() {
  const cell = cellById(selectedId);
  $("#selected-label").textContent = cell ? `${cell.character_name} · ${coordinates(cell.row, cell.column)}` : TEXT.noSelection;
  const live = api.mode === "live";
  const canSubmit = live && !busy && cell && !isProved(cell);
  document.querySelectorAll(".verdict-button").forEach((button) => { button.disabled = !canSubmit; });
  $("#load-case").disabled = busy;
  $("#restart-btn").disabled = busy;
  $("#hint-btn").disabled = busy || !live;
  $("#autosolve-btn").disabled = busy || !live;
  $("#board").setAttribute("aria-busy", String(busy));
}

// ---------- Liên kết hai chiều manh mối ↔ nhân vật ----------

// Manh mối đang được "soi": ưu tiên manh mối đang rê chuột, sau đó tới manh mối đã ghim.
function activeClue() { return clueById(hoverClueId ?? pinnedClueId); }

// Nhân vật đang được "soi": ưu tiên nhân vật đang rê chuột, sau đó tới nhân vật đang chọn.
function activeCellId() { return hoverCellId ?? selectedId; }

function renderHighlights() {
  const clue = activeClue();
  const mentioned = new Set(clue?.referenced_cell_ids);
  for (const [id, { card }] of cardViews) {
    card.classList.toggle("is-highlighted", mentioned.has(id));
    card.classList.toggle("is-clue-source", clue?.source_cell_id === id);
  }

  const cellId = clue ? null : activeCellId();
  document.querySelectorAll(".clue-card").forEach((item) => {
    const id = Number(item.dataset.clueId);
    const data = clueById(id);
    item.classList.toggle("is-active", id === clue?.id);
    item.classList.toggle("is-pinned", id === pinnedClueId);
    item.classList.toggle("is-own", cellId != null && data?.source_cell_id === cellId);
    item.classList.toggle("is-mentioning", cellId != null && (data?.referenced_cell_ids ?? []).includes(cellId));
    item.querySelectorAll("[data-target-id]").forEach((chip) => chip.classList.toggle("is-current", Number(chip.dataset.targetId) === cellId));
  });
}

function onCardClick(cell) {
  if (busy) return;
  selectedId = selectedId === cell.id ? null : cell.id;
  pinnedClueId = null;
  if (selectedId != null && isProved(cell)) {
    const own = state.revealed_clues.filter((clue) => clue.source_cell_id === cell.id);
    if (!own.length) showToast(TEXT.noClueAttached(cell.character_name));
    else document.querySelector(`.clue-card[data-clue-id="${own[0].id}"]`)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }
  renderSelection();
}

// ---------- Panel manh mối (luôn mở) ----------

function trackClues(next, { reset }) {
  const ids = next.revealed_clues.map((clue) => clue.id);
  if (reset) {
    clueOrder = ids;
    newClueIds = new Set();
    return;
  }
  const added = ids.filter((id) => !clueOrder.includes(id));
  clueOrder = [...clueOrder.filter((id) => ids.includes(id)), ...added];
  if (added.length) newClueIds = new Set(added);
}

function renderClueFeed() {
  const feed = $("#clue-feed");
  $("#clue-count").textContent = state.revealed_clues.length;
  if (!state.revealed_clues.length) {
    feed.innerHTML = `<div class="empty-state"><span class="empty-icon">⌕</span><p>${escapeHtml(TEXT.noClues)}</p></div>`;
    return;
  }
  // Mới nhất lên đầu.
  const ordered = [...clueOrder].reverse().map(clueById).filter(Boolean);
  feed.innerHTML = ordered.map(renderClueCard).join("");
  feed.querySelectorAll(".clue-card").forEach((item) => {
    const id = Number(item.dataset.clueId);
    item.addEventListener("mouseenter", () => { hoverClueId = id; renderHighlights(); });
    item.addEventListener("mouseleave", () => { if (hoverClueId === id) { hoverClueId = null; renderHighlights(); } });
    item.addEventListener("focus", () => { hoverClueId = id; renderHighlights(); });
    item.addEventListener("blur", () => { if (hoverClueId === id) { hoverClueId = null; renderHighlights(); } });
    item.addEventListener("click", () => {
      if (busy) return;
      pinnedClueId = pinnedClueId === id ? null : id;
      renderHighlights();
    });
  });
}

function renderClueCard(clue) {
  const source = clue.source_cell_id == null ? null : cellById(clue.source_cell_id);
  const sourceLabel = source ? `${source.character_name} · ${coordinates(source.row, source.column)}` : TEXT.publicClue;
  const targets = (clue.referenced_cell_ids || []).map(cellById).filter(Boolean);
  const chips = targets.map((cell) => `<span class="target-chip" data-target-id="${cell.id}">${coordinates(cell.row, cell.column)} <b>${escapeHtml(cell.character_name)}</b></span>`).join("")
    || `<span class="target-chip no-targets">${escapeHtml(TEXT.noTargets)}</span>`;
  const isNew = newClueIds.has(clue.id);
  return `<button type="button" class="clue-card${isNew ? " is-new" : ""}${source ? "" : " is-public"}" data-clue-id="${clue.id}">
    <span class="clue-card-head"><span class="clue-id">${clueTag(clue.id)}</span><small>${source ? TEXT.revealedBy : ""}</small><strong>${escapeHtml(sourceLabel)}</strong>${isNew ? `<span class="new-badge">${TEXT.newBadge}</span>` : ""}</span>
    <span class="clue-text">${escapeHtml(clue.description_nl)}</span>
    <span class="clue-targets">${chips}</span>
  </button>`;
}

// ---------- Tiện ích ----------

function escapeHtml(value) { return String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]); }
function showToast(message) { const toast = $("#toast"); toast.textContent = message; toast.classList.add("visible"); clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.classList.remove("visible"), 3600); }
function showModal(title, message) { $("#modal-title").textContent = title; $("#modal-copy").textContent = message; $("#modal-backdrop").hidden = false; }

function setState(next, { announceComplete = true } = {}) {
  const samePuzzle = state?.puzzle_id === next.puzzle_id;
  const wasComplete = samePuzzle && state.is_complete;
  trackClues(next, { reset: !samePuzzle });
  state = next;
  if (!samePuzzle) renderBoard();
  if (selectedId != null && !cellById(selectedId)) selectedId = null;
  if (!clueById(pinnedClueId)) pinnedClueId = null;
  if (!clueById(hoverClueId)) hoverClueId = null;
  render();
  if (announceComplete && state.is_complete && !wasComplete) showModal(TEXT.caseClosedTitle, TEXT.caseClosedBody);
}

// Làm lại hoặc nạp đề: xoá trạng thái chọn và coi như ván mới.
function resetBoard(next) {
  selectedId = null; pinnedClueId = null; hoverClueId = null; hoverCellId = null;
  state = null;
  setState(next);
}

function setConnection(mode) {
  const live = mode === "live";
  $("#connection-label").textContent = live ? TEXT.live : TEXT.mock;
  $(".connection-pill").classList.toggle("is-live", live);
  $("#footer-mode").textContent = live ? TEXT.footerLive : TEXT.footerMock;
}

// Chạy một action gọi API: chặn bấm trùng và hiện lỗi thống nhất.
async function run(action) {
  if (busy || !state) return;
  busy = true; renderControls();
  try { await action(); }
  catch (error) {
    if (error instanceof ApiError) showModal(error.status === 0 ? TEXT.backendUnavailable : TEXT.requestFailed(error.status), error.message);
    else { console.error(error); showModal(TEXT.unexpectedError, error.message); }
  } finally { busy = false; renderControls(); }
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

// ---------- Hành động ----------

$("#restart-btn").addEventListener("click", () => run(async () => {
  resetBoard(await api.restart());
  showToast(TEXT.restartToast);
}));

$("#load-case").addEventListener("click", () => run(async () => {
  const puzzleIds = await api.listPuzzles();
  if (!puzzleIds.length) return showToast(TEXT.noPuzzles);
  // Xoay vòng sang đề kế tiếp trong danh sách (hoặc nạp lại đề hiện tại nếu chỉ có 1).
  const next = puzzleIds[(puzzleIds.indexOf(state.puzzle_id) + 1) % puzzleIds.length];
  resetBoard(await api.loadPuzzle(next));
  showToast(TEXT.loadedToast(next));
}));

$("#hint-btn").addEventListener("click", () => run(async () => {
  const hint = await api.hint();
  const checks = TEXT.satChecks(hint.sat_queries.length);
  if (hint.status === "FOUND") {
    const cell = cellById(hint.verdict.cell_id);
    selectedId = hint.verdict.cell_id;
    pinnedClueId = null;
    renderSelection();
    showModal(TEXT.hintFoundTitle, TEXT.hintFoundBody(cellLabel(cell), statusName(hint.verdict.is_criminal), checks));
  } else if (hint.status === "SOLVED") showModal(TEXT.hintSolvedTitle, TEXT.hintSolvedBody(checks));
  else if (hint.status === "UNKNOWN") showModal(TEXT.hintUnknownTitle, TEXT.hintUnknownBody(checks));
  else showModal(TEXT.inconsistentTitle, TEXT.hintInconsistentBody(checks));
}));

$("#autosolve-btn").addEventListener("click", () => run(async () => {
  const result = await api.autoSolve();
  const before = state;
  const steps = result.trace.map((step) => {
    const cell = before.cells.find((item) => item.id === step.verdict.cell_id);
    const opened = step.revealed_clue_ids.length ? TEXT.opensClues(step.revealed_clue_ids) : "";
    return `${step.step}. ${cellLabel(cell)}: ${statusName(step.verdict.is_criminal)}${opened}`;
  });
  selectedId = null;
  setState(result.state, { announceComplete: false });
  const title = TEXT.solveTitles[result.status] ?? result.status;
  const summary = result.status === "STUCK" ? TEXT.solveStuck : result.status === "INCONSISTENT" ? TEXT.solveInconsistent : TEXT.solveDone;
  showModal(title, `${summary}\n\n${steps.length ? steps.join("\n") : TEXT.solveNone}`);
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
      setState(result.state);
      showToast(TEXT.acceptedToast(name, statusName(isCriminal)));
      return;
    }
    setState(result.state);
    if (result.outcome === "NOT_PROVABLE") showModal(TEXT.notProvableTitle, TEXT.notProvableBody(name));
    else if (result.outcome === "CONTRADICTED") showModal(TEXT.contradictedTitle, TEXT.contradictedBody(name));
    else if (result.outcome === "ALREADY_PROVED") showModal(TEXT.alreadyProvedTitle, TEXT.alreadyProvedBody(name));
    else showModal(TEXT.unexpectedOutcome, String(result.outcome));
  });
});

$("#modal-close").addEventListener("click", () => { $("#modal-backdrop").hidden = true; });
$("#modal-ok").addEventListener("click", () => { $("#modal-backdrop").hidden = true; });
$("#modal-backdrop").addEventListener("click", (event) => { if (event.target.id === "modal-backdrop") event.currentTarget.hidden = true; });
window.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  $("#modal-backdrop").hidden = true;
  selectedId = null; pinnedClueId = null;
  if (state) renderSelection();
});

void loadAvatars();
await connect();
