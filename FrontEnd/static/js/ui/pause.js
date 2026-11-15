// Pause: stops the clock and hides the board and the clues (blurred + inert),
// so a paused game cannot be studied for free. Not available while the AI is
// replaying (that has its own pause) or once the case is closed.
import { $, icon } from "../lib/dom.js";
import { T } from "../i18n/vi.js";
import { S, actions, emit, on, startTimer, stopTimer } from "../store.js";
import { announce, hideBubble } from "./feedback.js";

const app = $("#app");
const overlay = $("#pause");
const button = $("#pause-btn");
const hidden = [$("#board"), $(".rail"), $("#actions")];
let resumeTimer = false;

const canPause = () => !!S.game && !S.playback && !S.busy && !S.game.is_complete && S.mode !== "connecting";

export function setPaused(paused) {
  if (paused === S.paused || (paused && !canPause())) return;
  S.paused = paused;
  if (paused) {
    resumeTimer = S.timer.startedAt != null;
    stopTimer();
    S.selectedId = S.pinnedClueId = S.hoverCellId = S.hoverClueId = null;
    hideBubble();
  } else if (resumeTimer) {
    startTimer();
  }
  emit("select");
  emit("controls");
  emit("stats");
  announce(paused ? T.pausedTitle : T.resumed);
  (paused ? $("#pause-resume") : button).focus({ preventScroll: true });
}

function render() {
  app.classList.toggle("is-paused", S.paused);
  overlay.hidden = !S.paused;
  for (const el of hidden) el.inert = S.paused;
  const label = S.paused ? T.resume : T.pause;
  button.replaceChildren(icon(S.paused ? "play" : "pause"));
  button.setAttribute("aria-label", label);
  button.title = `${label} (P)`;
  button.setAttribute("aria-pressed", String(S.paused));
  button.disabled = !S.paused && !canPause();
}

actions.togglePause = () => setPaused(!S.paused);
button.addEventListener("click", actions.togglePause);
$("#pause-resume").addEventListener("click", () => setPaused(false));

on((type) => {
  if (type === "controls" || type === "game") render();
});
render();
