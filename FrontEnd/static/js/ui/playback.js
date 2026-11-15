// Auto-solve playback: replays the solver's trace on the board, step by step,
// entirely on the client (the backend has already solved the puzzle).
// Controls: restart, pause/resume, next step, skip to end, speed.
import { $, icon } from "../lib/dom.js";
import { prefs, savePrefs } from "../prefs.js";
import { T } from "../i18n/vi.js";
import { S, emit, setGame } from "../store.js";
import { hideBubble } from "./feedback.js";
import { addStep, truncateRun } from "./journal.js";
import { setTab } from "./rail.js";

const BASE_STEP_MS = 1100;
const TICK_MS = 40;
const bar = $("#playback");
const toggle = $("#pb-toggle");
const speedButtons = [...bar.querySelectorAll(".speed button")];
let rewind = null;

function renderBar() {
  const pb = S.playback;
  bar.hidden = !pb;
  $("#actions").hidden = !!pb;
  $("#app").classList.toggle("is-ai-mode", !!pb);
  if (!pb) return;
  $("#pb-label").textContent = T.playbackStep(Math.min(pb.i + 1, pb.n), pb.n);
  toggle.replaceChildren(icon(pb.paused ? "play" : "pause"));
  toggle.setAttribute("aria-label", pb.paused ? T.pbResume : T.pbPause);
  toggle.title = pb.paused ? T.pbResume : T.pbPause;
  for (const button of speedButtons) {
    button.setAttribute("aria-pressed", String(Number(button.dataset.speed) === prefs.speed));
  }
}

/** Wait a fraction of a step. Returns "ok" | "skip" | "jump" | "step". */
async function hold(fraction) {
  let left = BASE_STEP_MS * fraction;
  for (;;) {
    const pb = S.playback;
    if (!pb || pb.skip) return "skip";
    if (pb.jump) { pb.jump = false; return "jump"; }
    if (pb.stepOnce) { pb.stepOnce = false; return "step"; }
    if (left <= 0) return "ok";
    await new Promise((resolve) => setTimeout(resolve, TICK_MS));
    if (!S.playback?.paused) left -= TICK_MS * prefs.speed;
  }
}

/**
 * before: PublicState before solving. result: AutoSolveResponse.
 * run: id used to group this run's journal entries.
 */
export async function playTrace(before, result, run) {
  const { trace } = result;
  const finalClues = new Map(result.state.revealed_clues.map((clue) => [clue.id, clue]));
  const names = new Map(before.cells.map((cell) => [cell.id, cell.character_name]));

  // frames[i] = the public state after i steps.
  const frames = [structuredClone(before)];
  for (const step of trace) {
    const frame = structuredClone(frames.at(-1));
    const cell = frame.cells.find((item) => item.id === step.verdict.cell_id);
    if (cell) cell.is_criminal = step.verdict.is_criminal;
    for (const id of step.revealed_clue_ids) {
      if (finalClues.has(id) && !frame.revealed_clues.some((clue) => clue.id === id)) {
        frame.revealed_clues.push(finalClues.get(id));
      }
    }
    frame.is_complete = frame.cells.every((item) => item.is_criminal !== null);
    frames.push(frame);
  }

  const entryFor = (step) => ({
    kind: "ai",
    run,
    no: step.step,
    verdict: step.verdict,
    queries: step.sat_queries,
    openClues: step.active_clue_ids.length,
    unlockedBy: [...new Set(step.revealed_clue_ids
      .map((id) => names.get(finalClues.get(id)?.source_cell_id)).filter(Boolean))],
  });

  const pb = { i: 0, n: trace.length, paused: false, skip: false, jump: false, stepOnce: false, takeOver: false };
  // The player's own verdicts so far, in order (needed to rebuild the server state on take-over).
  const playedBefore = S.solveOrder.map((id) => before.cells.find((cell) => cell.id === id)).filter(Boolean);
  S.playback = pb;
  S.selectedId = S.pinnedClueId = S.hoverClueId = S.hoverCellId = null;
  hideBubble();
  setTab("ai");
  rewind = () => {
    pb.i = 0;
    pb.jump = true;
    truncateRun(run, 0);
    setGame(frames[0]);
    renderBar();
  };
  emit("controls");
  renderBar();

  try {
    while (pb.i < pb.n && !pb.skip) {
      const step = trace[pb.i];
      S.aiCellId = step.verdict.cell_id;
      emit("select");
      renderBar();

      const looked = await hold(0.4);
      if (looked === "skip" || looked === "jump") continue;

      pb.i += 1;
      setGame(frames[pb.i]);
      addStep(entryFor(step));
      if (looked === "step") continue;

      await hold(0.6);
    }
  } finally {
    // "Tự chơi tiếp": keep the AI's first pb.i verdicts and hand the board back.
    // The backend has already solved everything, so rebuild its state up to
    // here: restart, replay the player's own verdicts, then the AI's first pb.i.
    let handedBack = null;
    if (pb.takeOver && pb.i < pb.n) {
      try {
        await S.api.restart();
        const moves = [
          ...playedBefore.map((cell) => ({ cell_id: cell.id, is_criminal: cell.is_criminal })),
          ...trace.slice(0, pb.i).map((step) => step.verdict),
        ];
        for (const move of moves) await S.api.submitVerdict(move.cell_id, move.is_criminal);
        handedBack = await S.api.getGame();
      } catch (error) {
        console.error(error); // fall through: show the solved state the server has
      }
    }
    if (handedBack) {
      S.aiCellId = null;
      S.playback = null;
      rewind = null;
      S.aiSteps += pb.i;
      renderBar();
      for (const clue of handedBack.revealed_clues) S.seenClues.add(clue.id);
      setGame(handedBack);
      emit("controls");
      return { takenOverAt: pb.i };
    }
    for (let k = pb.i; k < pb.n; k++) addStep(entryFor(trace[k]));
    S.aiCellId = null;
    S.playback = null;
    rewind = null;
    if (result.status === "SOLVED") S.solvedByAuto = true;
    renderBar();
    setGame(result.state);
    // Clues the AI unlocked were shown during playback; don't flag them NEW.
    for (const clue of result.state.revealed_clues) S.seenClues.add(clue.id);
    emit("select");
    emit("controls");
  }
}

$("#pb-start").addEventListener("click", () => rewind?.());
toggle.addEventListener("click", () => {
  if (!S.playback) return;
  S.playback.paused = !S.playback.paused;
  renderBar();
});
$("#pb-next").addEventListener("click", () => { if (S.playback) S.playback.stepOnce = true; });
$("#pb-end").addEventListener("click", () => { if (S.playback) S.playback.skip = true; });
$("#pb-takeover").addEventListener("click", () => {
  if (!S.playback) return;
  S.playback.takeOver = true;
  S.playback.skip = true;
});
for (const button of speedButtons) {
  button.addEventListener("click", () => { savePrefs({ speed: Number(button.dataset.speed) }); renderBar(); });
}
