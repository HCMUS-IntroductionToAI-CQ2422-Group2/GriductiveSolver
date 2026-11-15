// Controller: connects to the backend, owns the game actions and the keyboard.
// Rendering lives in ui/*; state lives in store.js.
import { ApiError, GameApi, MockGameApi } from "./api.js";
import { applyPrefs, markSolved, prefs } from "./prefs.js";
import { T } from "./i18n/vi.js";
import {
  S, actions, cellById, coord, emit, isProved, on, resetRound, setGame, startTimer,
} from "./store.js";
import { loadAvatars } from "./ui/cards.js";
import { focusCell, shakeCell } from "./ui/board.js";
import "./ui/threads.js";
import { setTab } from "./ui/rail.js";
import { addStep, clearJournal, nextStepNo } from "./ui/journal.js";
import { announce, bubble, hideBubble, message, toast } from "./ui/feedback.js";
import { caseTitle, closeMenu } from "./ui/topbar.js";
import { playTrace } from "./ui/playback.js";
import { hideWin, showWin } from "./ui/win.js";
import { openHelp } from "./ui/dialogs.js";
import { openTutorial } from "./ui/tutorial.js";
import { setPaused } from "./ui/pause.js";
import { play } from "./lib/sound.js";
import { $ } from "./lib/dom.js";

applyPrefs();

let winShown = false;
let runCounter = 0;
const label = (cell) => `${cell.character_name} (${coord(cell)})`;

// ---------- Plumbing ----------

function showError(error, onRetry) {
  if (error instanceof ApiError) {
    const offline = error.status === 0;
    message({
      title: offline ? T.backendDown : T.requestFailed(error.status),
      text: offline ? T.stillOffline : T.errorTitle,
      code: error.message,
      onRetry: onRetry ?? (offline ? actions.reconnect : null),
    });
  } else {
    console.error(error);
    message({ title: T.errorTitle, text: String(error?.message ?? error) });
  }
}

/** Run one backend action at a time; `cellId` gets the loading spinner. */
async function run(action, cellId = null) {
  if (S.busy || !S.game) return;
  S.busy = true;
  S.busyCellId = cellId;
  emit("controls");
  try {
    await action();
  } catch (error) {
    showError(error);
  } finally {
    S.busy = false;
    S.busyCellId = null;
    emit("controls");
  }
}

function newRound(game) {
  resetRound();
  clearJournal();
  hideBubble();
  hideWin();
  winShown = false;
  $("#board-stage").classList.remove("is-loading");
  setGame(game, { fresh: true });
  emit("stats");
  emit("controls");
}

async function connect() {
  S.mode = "connecting";
  emit("controls");
  try {
    const api = new GameApi();
    const [game, puzzles] = await Promise.all([api.getGame(), api.listPuzzles()]);
    S.api = api;
    S.puzzles = puzzles;
    S.mode = "live";
    newRound(game);
  } catch (error) {
    // Only a missing backend falls back to demo data; real errors are shown.
    if (!(error instanceof ApiError) || error.status !== 0) {
      showError(error, connect);
      if (S.game) { S.mode = S.api?.mode ?? "mock"; emit("controls"); return; }
    }
    const api = new MockGameApi();
    S.api = api;
    S.puzzles = await api.listPuzzles();
    S.mode = "mock";
    newRound(await api.getGame());
  }
}

// ---------- Actions ----------

actions.select = (id) => {
  if (S.busy || S.playback || S.paused) return;
  startTimer();
  S.selectedId = S.selectedId === id ? null : id;
  S.pinnedClueId = null;
  if (S.hint?.cellId !== S.selectedId) hideBubble();
  focusCell(id);
  emit("select");
};

actions.submitVerdict = (cellId, isCriminal) => {
  const cell = cellById(cellId);
  if (!cell || isProved(cell) || S.playback || S.paused) return;
  if (S.mode !== "live") { toast(T.needsLive); return; }
  startTimer();
  hideBubble();

  run(async () => {
    const result = await S.api.submitVerdict(cellId, isCriminal);
    const name = cell.character_name;
    if (result.outcome === "ACCEPTED") {
      S.selectedId = cellId;
      setGame(result.state);
      bubble(cellId, { kind: "ok", title: T.correctTitle, text: T.correctBody(name, isCriminal) });
      return;
    }
    if (result.outcome === "NOT_PROVABLE" || result.outcome === "CONTRADICTED") {
      S.mistakes += 1;
      setGame(result.state);
      emit("stats");
      shakeCell(cellId);
      play("wrong");
      const refused = result.outcome === "NOT_PROVABLE";
      bubble(cellId, {
        kind: "bad",
        title: refused ? T.notProvableTitle : T.contradictedTitle,
        text: refused ? T.notProvableBody(name) : T.contradictedBody(name),
      });
      return;
    }
    setGame(result.state);
    if (result.outcome === "ALREADY_PROVED") toast(T.alreadyProved(name));
    else message({ title: T.errorTitle, text: String(result.outcome) });
  }, cellId);
};

function revealHint() {
  const { cellId, isCriminal, queries } = S.hint;
  const cell = cellById(cellId);
  const refuted = queries.find((q) => q.assumption?.cell_id === cellId && !q.satisfiable);
  if (S.hint.stage === 1) {
    S.hint.stage = 2;
    addStep({
      kind: "hint",
      run: null,
      no: nextStepNo(),
      verdict: { cell_id: cellId, is_criminal: isCriminal },
      queries,
      openClues: S.game.revealed_clues.length,
    });
  }
  S.selectedId = cellId;
  emit("select");
  bubble(cellId, {
    kind: "hint",
    title: T.hintStage2Title(cell.character_name, isCriminal),
    text: refuted ? T.hintReason(cell.character_name, refuted.assumption.is_criminal) : "",
    sticky: true,
  });
}

actions.hint = () => {
  if (S.playback || S.paused || S.mode !== "live") return;
  const waiting = S.hint && cellById(S.hint.cellId);
  if (waiting && !isProved(waiting)) { revealHint(); return; }

  startTimer();
  run(async () => {
    const hint = await S.api.hint();
    if (hint.status === "FOUND") {
      S.hints += 1;
      S.hint = {
        cellId: hint.verdict.cell_id,
        isCriminal: hint.verdict.is_criminal,
        queries: hint.sat_queries,
        stage: 1,
      };
      S.selectedId = hint.verdict.cell_id;
      S.pinnedClueId = null;
      emit("stats");
      emit("select");
      focusCell(S.selectedId);
      bubble(S.selectedId, {
        kind: "hint",
        title: T.hintStage1Title,
        text: T.hintStage1Body(label(cellById(S.selectedId))),
        sticky: true,
      });
    } else if (hint.status === "SOLVED") {
      toast(T.hintSolved);
    } else if (hint.status === "UNKNOWN") {
      toast(T.hintUnknown);
    } else {
      message({ title: T.inconsistentTitle, text: T.inconsistentBody });
    }
  });
};

actions.autoSolve = () => {
  if (S.playback || S.paused || S.mode !== "live") return;
  run(async () => {
    const before = S.game;
    S.working = "auto";
    emit("controls");
    let result;
    try { result = await S.api.autoSolve(); } finally { S.working = null; emit("controls"); }
    if (!result.trace.length && result.status === "SOLVED") { toast(T.hintSolved); return; }
    const outcome = await playTrace(before, result, ++runCounter);
    if (outcome?.takenOverAt != null) { setTab("clues"); toast(T.takenOver(outcome.takenOverAt)); return; }
    if (result.status === "STUCK") toast(T.stuck(result.trace.length));
    else if (result.status === "INCONSISTENT") message({ title: T.inconsistentTitle, text: T.inconsistentBody });
  });
};

actions.restart = () => run(async () => {
  newRound(await S.api.restart());
  toast(T.restarted);
});

actions.loadCase = (puzzleId) => run(async () => {
  newRound(await S.api.loadPuzzle(puzzleId));
  toast(T.caseLoaded(caseTitle(puzzleId)));
});

actions.nextCase = () => {
  const ids = S.puzzles;
  if (!ids.length) { toast(T.noPuzzles); return; }
  actions.loadCase(ids[(ids.indexOf(S.game.puzzle_id) + 1) % ids.length]);
};

actions.reconnect = async () => {
  if (S.busy) return;
  toast(T.retrying);
  await connect();
  toast(S.mode === "live" ? T.reconnected : T.stillOffline);
};

// ---------- Win ----------

on((type, detail) => {
  if (type !== "game") return;
  if (!S.game.is_complete) { winShown = false; return; }
  if (S.playback || winShown) return;
  winShown = true;
  const celebrate = !detail.fresh;
  if (celebrate && !S.solvedByAuto) markSolved(S.game.puzzle_id);
  S.selectedId = null;
  setTimeout(() => { hideBubble(); showWin({ celebrate }); }, celebrate ? 900 : 0);
});

// ---------- Keyboard ----------

function moveSelection(dRow, dColumn, toEdge = false) {
  const { cells, height, width } = S.game;
  const current = cellById(S.selectedId);
  const clamp = (value, max) => Math.min(max, Math.max(0, value));
  let target = cells[0];
  if (current) {
    const row = toEdge ? current.row : clamp(current.row + dRow, height - 1);
    const column = toEdge ? (dColumn < 0 ? 0 : width - 1) : clamp(current.column + dColumn, width - 1);
    target = cells.find((cell) => cell.row === row && cell.column === column);
  }
  if (!target) return;
  startTimer();
  S.selectedId = target.id;
  S.pinnedClueId = null;
  if (S.hint?.cellId !== target.id) hideBubble();
  emit("select");
  focusCell(target.id);
  announce(label(target));
}

const ARROWS = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };

window.addEventListener("keydown", (event) => {
  if (!S.game || document.querySelector("dialog[open]")) return;
  if (event.ctrlKey || event.metaKey || event.altKey) return;
  if (event.target.closest?.("input, textarea, select, summary, [contenteditable]")) return;

  if (S.paused) {
    // Only resuming is possible while paused.
    if (event.key === "Escape" || event.key.toLowerCase() === "p") { event.preventDefault(); setPaused(false); }
    return;
  }

  if (event.key === "Escape") {
    if (closeMenu() || S.playback) return;
    hideBubble();
    hideWin();
    S.selectedId = S.pinnedClueId = null;
    emit("select");
    return;
  }
  if (S.playback) return; // the board is locked while the AI replays

  if (ARROWS[event.key]) {
    if (event.target.closest?.(".rail, .menu")) return;
    event.preventDefault();
    moveSelection(...ARROWS[event.key]);
    return;
  }
  if (event.key === "Home" || event.key === "End") {
    if (S.selectedId == null) return;
    event.preventDefault();
    moveSelection(0, event.key === "Home" ? -1 : 1, true);
    return;
  }

  const key = event.key.toLowerCase();
  if (key === "?") {
    event.preventDefault();
    openHelp();
  } else if (key === "h") {
    event.preventDefault();
    actions.hint();
  } else if (key === "p") {
    event.preventDefault();
    setPaused(true);
  } else if (key === "n") {
    event.preventDefault();
    if (!S.busy) actions.nextCase();
  } else if (key === "i" || key === "c") {
    event.preventDefault();
    const cell = cellById(S.selectedId);
    if (!cell || isProved(cell)) toast(T.selectFirst);
    else actions.submitVerdict(cell.id, key === "c");
  }
});

// ---------- Boot ----------

setTab("clues");
await Promise.all([loadAvatars(), new Promise((resolve) => setTimeout(resolve, 0))]);
await connect();
if (!prefs.tutorialDone) openTutorial();
