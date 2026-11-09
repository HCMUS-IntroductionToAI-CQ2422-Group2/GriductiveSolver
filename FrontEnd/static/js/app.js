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
  verdictFor: (name) => `Verdict for ${name}`,
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

let api = new GameApi();
const $ = (selector) => document.querySelector(selector);
let state;
let selectedId = null;      // nhân vật đang chọn (để phán quyết hoặc xem manh mối của họ)
let pinnedClueId = null;    // manh mối được bấm ghim: giữ highlight trên bảng
let hoverClueId = null;     // manh mối đang rê chuột
let hoverCellId = null;     // nhân vật đang rê chuột
let busy = false;
let mistakes = 0;          // phán quyết bị từ chối (NOT_PROVABLE / CONTRADICTED) trong ván này
let hintsUsed = 0;         // số lần xin gợi ý trong ván này (không tính là lỗi)
let pendingHint = null;    // gợi ý nấc 1 đang chờ: { cellId, isCriminal }
let solvedByAuto = false;  // ván thắng nhờ Auto solve
let playback = null;       // phát lại Auto solve đang chạy: { paused, skip }
let playbackClueIds = new Set(); // manh mối solver đang dùng ở bước hiện tại
let playbackCellId = null;       // nhân vật solver đang kết luận ở bước hiện tại
const PLAYBACK_STEP_MS = 700;
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
  // Thẻ là div role=button để chứa được hai nút phán quyết bên trong.
  const card = document.createElement("div");
  card.className = "character-card";
  card.setAttribute("role", "button");
  card.tabIndex = -1;
  card.dataset.cellId = cell.id;
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
  const actions = document.createElement("span"); actions.className = "card-actions"; actions.setAttribute("role", "group");
  for (const [status, label] of [["INNOCENT", TEXT.innocent], ["CRIMINAL", TEXT.criminal]]) {
    const button = document.createElement("button");
    button.type = "button"; button.className = `card-verdict ${status.toLowerCase()}`; button.dataset.status = status;
    button.innerHTML = `${label} <kbd>${label[0]}</kbd>`;
    button.addEventListener("click", (event) => { event.stopPropagation(); submitVerdict(cell.id, status === "CRIMINAL"); });
    actions.append(button);
  }
  card.append(actions);
  card.addEventListener("click", () => onCardClick(cellById(cell.id)));
  card.addEventListener("keydown", (event) => {
    if ((event.key === "Enter" || event.key === " ") && event.target === card) { event.preventDefault(); onCardClick(cellById(cell.id)); }
  });
  card.addEventListener("animationend", () => card.classList.remove("is-wrong"));
  card.addEventListener("mouseenter", () => { hoverCellId = cell.id; renderHighlights(); });
  card.addEventListener("mouseleave", () => { if (hoverCellId === cell.id) { hoverCellId = null; renderHighlights(); } });
  card.addEventListener("focus", () => { hoverCellId = cell.id; renderHighlights(); });
  card.addEventListener("blur", () => { if (hoverCellId === cell.id) { hoverCellId = null; renderHighlights(); } });
  return { card, flag, portrait, actions };
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
  $("#mistake-count").textContent = mistakes;
  $("#hint-count").textContent = hintsUsed;
  renderClueFeed();
  renderSelection();
}

function renderSelection() {
  // Chỉ một thẻ nhận Tab (roving tabindex); mũi tên di chuyển giữa các thẻ.
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
    actions.querySelectorAll("button").forEach((button) => { button.disabled = !open || busy; button.tabIndex = open ? 0 : -1; });
  }
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
    card.classList.toggle("is-playback", id === playbackCellId);
  }

  const cellId = clue ? null : activeCellId();
  document.querySelectorAll(".clue-card").forEach((item) => {
    const id = Number(item.dataset.clueId);
    const data = clueById(id);
    item.classList.toggle("is-active", id === clue?.id);
    item.classList.toggle("is-solver-active", playbackClueIds.has(id));
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
  cardViews.get(cell.id).card.focus({ preventScroll: true });
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
  const progressed = !samePuzzle || next.cells.some((cell, i) => cell.is_criminal !== state.cells[i]?.is_criminal);
  if (progressed) pendingHint = null;
  state = next;
  if (!samePuzzle) renderBoard();
  if (selectedId != null && !cellById(selectedId)) selectedId = null;
  if (!clueById(pinnedClueId)) pinnedClueId = null;
  if (!clueById(hoverClueId)) hoverClueId = null;
  render();
  renderWin(announceComplete && state.is_complete && !wasComplete);
}

// Kết quả khi phá xong vụ án hiện ngay trên trang, không chặn bảng.
function renderWin(justWon) {
  const panel = $("#win-panel");
  panel.hidden = !state.is_complete;
  if (!state.is_complete) return;
  $("#win-title").textContent = TEXT.caseClosedTitle;
  $("#win-body").textContent = solvedByAuto ? TEXT.caseClosedAuto : TEXT.caseClosedBody;
  $("#win-mistakes").textContent = mistakes;
  $("#win-hints").textContent = hintsUsed;
  if (justWon) panel.scrollIntoView({ block: "nearest", behavior: "smooth" });
}

// Làm lại hoặc nạp đề: xoá trạng thái chọn và coi như ván mới.
function resetBoard(next) {
  selectedId = null; pinnedClueId = null; hoverClueId = null; hoverCellId = null;
  mistakes = 0; hintsUsed = 0; pendingHint = null; solvedByAuto = false;
  state = null;
  setState(next);
}

function setConnection(mode) {
  const live = mode === "live";
  $("#connection-label").textContent = live ? TEXT.live : TEXT.mock;
  $(".connection-pill").classList.toggle("is-live", live);
  $("#footer-mode").textContent = live ? TEXT.footerLive : TEXT.footerMock;
  $("#offline-banner").hidden = live;
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

// Gợi ý 2 nấc: nấc 1 chỉ ra nhân vật chứng minh được; bấm lần nữa mới nói phán quyết.
// Cả hai nấc dùng chung một lần gọi API; chỉ nấc 1 được tính vào bộ đếm Hints.
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
    } else if (hint.status === "SOLVED") showToast(TEXT.hintSolvedBody(checks));
    else if (hint.status === "UNKNOWN") showToast(TEXT.hintUnknownBody(checks));
    else showModal(TEXT.inconsistentTitle, TEXT.hintInconsistentBody(checks));
  });
}

$("#hint-btn").addEventListener("click", useHint);

// Auto solve: backend giải xong trong một lần gọi; UI phát lại `trace` từng bước trên bảng.
// Mỗi bước: sáng các manh mối solver dùng (active_clue_ids) → chứng minh nhân vật → hiện manh mối mới mở.
$("#autosolve-btn").addEventListener("click", () => run(async () => {
  const result = await api.autoSolve();
  await playTrace(state, result);
  if (result.status === "SOLVED") return;
  if (result.status === "STUCK") showToast(TEXT.solveStuckToast(result.trace.length));
  else showModal(TEXT.solveTitles[result.status] ?? result.status, TEXT.solveInconsistent);
}));

async function playTrace(before, result) {
  const finalClues = new Map(result.state.revealed_clues.map((clue) => [clue.id, clue]));
  let frame = structuredClone(before);
  selectedId = null; pinnedClueId = null; hoverClueId = null; hoverCellId = null;
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
        if (finalClues.has(id) && !frame.revealed_clues.some((clue) => clue.id === id)) frame.revealed_clues.push(finalClues.get(id));
      }
      setState(frame, { announceComplete: false });
      if (!await playbackWait(PLAYBACK_STEP_MS / 2)) break;
    }
  } finally {
    playbackClueIds = new Set(); playbackCellId = null; playback = null;
    showPlayback(false);
    if (result.status === "SOLVED") solvedByAuto = true;
    setState(result.state);
    // Người chơi vừa xem các manh mối mở ra trong lúc phát lại, không cần gắn nhãn NEW nữa.
    newClueIds = new Set();
    renderClueFeed(); renderHighlights();
  }
}

// Chờ ms mili-giây (không tính lúc tạm dừng). Trả về false nếu người chơi bấm Skip.
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
$("#playback-skip").addEventListener("click", () => { if (playback) playback.skip = true; });

$("#win-again").addEventListener("click", () => $("#restart-btn").click());
$("#win-next").addEventListener("click", () => $("#load-case").click());

$("#retry-btn").addEventListener("click", async () => {
  if (busy) return;
  busy = true; renderControls();
  $("#retry-btn").disabled = true;
  showToast(TEXT.retrying);
  try { await connect(); }
  finally { busy = false; $("#retry-btn").disabled = false; renderControls(); }
  showToast(api.mode === "live" ? TEXT.reconnected : TEXT.stillOffline);
});

// Đoán sai không mở modal: thẻ rung, toast giải thích, bộ đếm Mistakes tăng.
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
      if (card) { card.classList.remove("is-wrong"); void card.offsetWidth; card.classList.add("is-wrong"); }
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
  cardViews.get(target.id).card.focus();
}

function showShortcuts() { showModal(TEXT.shortcutsTitle, TEXT.shortcutsBody); }
$("#shortcuts-btn").addEventListener("click", showShortcuts);

$("#modal-close").addEventListener("click", () => { $("#modal-backdrop").hidden = true; });
$("#modal-ok").addEventListener("click", () => { $("#modal-backdrop").hidden = true; });
$("#modal-backdrop").addEventListener("click", (event) => { if (event.target.id === "modal-backdrop") event.currentTarget.hidden = true; });
const ARROWS = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
window.addEventListener("keydown", (event) => {
  const modalOpen = !$("#modal-backdrop").hidden;
  if (event.key === "Escape") {
    if (modalOpen) { $("#modal-backdrop").hidden = true; return; }
    selectedId = null; pinnedClueId = null;
    if (state) renderSelection();
    return;
  }
  if (modalOpen || !state || event.ctrlKey || event.metaKey || event.altKey) return;
  if (event.target.closest?.("input, textarea, select, [contenteditable]")) return;
  if (ARROWS[event.key]) { event.preventDefault(); moveSelection(...ARROWS[event.key]); return; }
  const key = event.key.toLowerCase();
  if (key === "?") { event.preventDefault(); showShortcuts(); }
  else if (key === "h") { event.preventDefault(); if (!$("#hint-btn").disabled) useHint(); }
  else if (key === "i" || key === "c") {
    event.preventDefault();
    const cell = cellById(selectedId);
    if (!cell || isProved(cell)) showToast(TEXT.selectFirst);
    else submitVerdict(cell.id, key === "c");
  }
});

void loadAvatars();
await connect();
