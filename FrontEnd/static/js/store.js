// Single source of truth for the UI + a tiny event bus.
//
// Modules read `S`, call `emit(type, detail)` after changing it, and listen
// with `on((type, detail) => ...)`. Event types:
//   "game"     the public state changed       detail: { prev, fresh, newlyProved, newClues }
//   "select"   selection / hover / highlight changed
//   "controls" busy / mode / playback changed
//   "stats"    mistakes / hints / timer changed
//   "layout"   the board was resized
//
// Game shape (PublicStateResponse, see api.js):
//   { puzzle_id, height, width, is_complete,
//     cells: [{ id, row, column, character_name, profession, is_criminal: bool|null }],
//     revealed_clues: [{ id, source_cell_id: int|null, description_nl, referenced_cell_ids }] }

export const S = {
  api: null,
  mode: "connecting",     // "connecting" | "live" | "mock"
  game: null,
  puzzles: [],

  busy: false,
  busyCellId: null,
  working: null,          // "auto" while waiting for the solver

  selectedId: null,
  pinnedClueId: null,
  hoverClueId: null,
  hoverCellId: null,
  aiCellId: null,         // cell the solver is looking at (playback / journal hover)

  hint: null,             // { cellId, isCriminal, queries, stage: 1 | 2 }
  mistakes: 0,
  hints: 0,
  solvedByAuto: false,
  aiSteps: 0,             // verdicts the AI made before the player took over
  playback: null,         // see ui/playback.js

  solveOrder: [],         // cell ids in the order they were proved (for the progress bar)
  clueSeq: new Map(),     // clue id -> order of first appearance
  seenClues: new Set(),   // clue ids that no longer show the NEW tag
  seq: 0,

  timer: { startedAt: null, elapsed: 0 },
};

const listeners = new Set();
export const on = (listener) => listeners.add(listener);
export function emit(type, detail = {}) {
  for (const listener of listeners) listener(type, detail);
}

/** Controller functions, filled in by main.js so UI modules can call them. */
export const actions = {};

// ---------- Selectors ----------

export const isProved = (cell) => cell?.is_criminal === true || cell?.is_criminal === false;
export const cellById = (id) => S.game?.cells.find((cell) => cell.id === id);
export const clueById = (id) => S.game?.revealed_clues.find((clue) => clue.id === id);
export const coord = (cell) => `${String.fromCharCode(65 + cell.column)}${cell.row + 1}`;
export const cluesOf = (cellId) => S.game?.revealed_clues.filter((clue) => clue.source_cell_id === cellId) ?? [];

/** A clue is "spent" once every cell it talks about has a verdict. */
export function isSpent(clue) {
  const ids = clue.referenced_cell_ids ?? [];
  return ids.length > 0 && ids.every((id) => isProved(cellById(id)));
}

const canHover = window.matchMedia("(hover: hover)").matches;

/**
 * Clues whose threads are showing right now: the hovered clue/card, or a clue
 * pinned from the rail. With a mouse, merely having a card selected does not
 * keep threads up (they go away when the pointer leaves). On touch screens
 * there is no hover, so the selected card counts.
 */
export function activeClues() {
  if (!S.game || S.playback) return [];
  const hovered = clueById(S.hoverClueId);
  if (hovered) return [hovered];
  if (S.hoverCellId != null) {
    const own = cluesOf(S.hoverCellId);
    if (own.length) return own;
  }
  const pinned = clueById(S.pinnedClueId);
  if (pinned) return [pinned];
  return !canHover && S.selectedId != null ? cluesOf(S.selectedId) : [];
}

/** The cell the player is looking at (for "clues that mention this person"). */
export const focusCellId = () => S.hoverCellId ?? S.selectedId;

// ---------- Mutations ----------

export function resetRound() {
  S.selectedId = S.pinnedClueId = S.hoverClueId = S.hoverCellId = S.aiCellId = null;
  S.hint = null;
  S.mistakes = S.hints = 0;
  S.solvedByAuto = false;
  S.aiSteps = 0;
  S.playback = null;
  S.solveOrder = [];
  S.clueSeq = new Map();
  S.seenClues = new Set();
  S.seq = 0;
  S.timer = { startedAt: null, elapsed: 0 };
}

export function setGame(next, { fresh = false } = {}) {
  const prev = S.game;
  const same = !fresh && prev && prev.puzzle_id === next.puzzle_id && prev.cells.length === next.cells.length;
  const before = new Map(same ? prev.cells.map((cell) => [cell.id, cell.is_criminal]) : []);

  const newlyProved = same
    ? next.cells.filter((cell) => isProved(cell) && before.get(cell.id) == null).map((cell) => cell.id)
    : [];
  const changed = !same || next.cells.some((cell) => cell.is_criminal !== before.get(cell.id));

  const byId = new Map(next.cells.map((cell) => [cell.id, cell]));
  S.solveOrder = (same ? S.solveOrder : []).filter((id) => isProved(byId.get(id)));
  for (const cell of next.cells) {
    if (isProved(cell) && !S.solveOrder.includes(cell.id)) S.solveOrder.push(cell.id);
  }

  const newClues = [];
  for (const clue of next.revealed_clues) {
    if (S.clueSeq.has(clue.id)) continue;
    S.clueSeq.set(clue.id, ++S.seq);
    if (same) newClues.push(clue.id);
    else S.seenClues.add(clue.id); // clues present at load are not "new"
  }

  S.game = next;
  if (changed) S.hint = null;
  if (S.selectedId != null && !cellById(S.selectedId)) S.selectedId = null;
  if (S.hoverCellId != null && !cellById(S.hoverCellId)) S.hoverCellId = null;
  if (!clueById(S.pinnedClueId)) S.pinnedClueId = null;
  if (!clueById(S.hoverClueId)) S.hoverClueId = null;
  if (next.is_complete) stopTimer();

  emit("game", { prev, fresh: !same, newlyProved, newClues });
}

// ---------- Timer ----------

export function startTimer() {
  if (S.timer.startedAt != null || S.game?.is_complete) return;
  S.timer.startedAt = performance.now();
}
export function stopTimer() {
  if (S.timer.startedAt == null) return;
  S.timer.elapsed += performance.now() - S.timer.startedAt;
  S.timer.startedAt = null;
}
export function elapsedMs() {
  const { startedAt, elapsed } = S.timer;
  return elapsed + (startedAt == null ? 0 : performance.now() - startedAt);
}
export function formatTime(ms) {
  const total = Math.floor(ms / 1000);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

// ---------- Puzzle ids ----------

/** "medium-5x5-museum" -> { level: "medium", size: "5×5", slug: "museum" } */
export function puzzleInfo(id) {
  const parts = String(id).split("-");
  const sizeAt = parts.findIndex((part) => /^\d+x\d+$/i.test(part));
  if (sizeAt === -1) return { level: null, size: null, slug: id };
  return {
    level: parts.slice(0, sizeAt).join("-") || null,
    size: parts[sizeAt].toLowerCase().replace("x", "×"),
    slug: parts.slice(sizeAt + 1).join("-") || parts.slice(0, sizeAt).join("-") || id,
  };
}
