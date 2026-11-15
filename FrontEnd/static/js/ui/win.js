// Win overlay: sits on top of the board (no layout shift), can be closed to
// admire the solved grid.
import { $, icon } from "../lib/dom.js";
import { anim, confetti } from "../lib/motion.js";
import { play } from "../lib/sound.js";
import { T } from "../i18n/vi.js";
import { S, actions, elapsedMs, formatTime } from "../store.js";
import { announce } from "./feedback.js";
import { wave } from "./board.js";

const overlay = $("#win");
const starsEl = $("#win-stars");

/** 3 stars: flawless. 2: at most two mistakes+hints. 1: otherwise. */
export function starsFor(mistakes, hints) {
  const slips = mistakes + hints;
  return slips === 0 ? 3 : slips <= 2 ? 2 : 1;
}

export function showWin({ celebrate }) {
  const byAi = S.solvedByAuto;
  // A game that was already solved when the page loaded has no stats to show.
  const scored = celebrate && !byAi;
  $("#win-note").textContent = byAi ? T.winByAi : S.aiSteps ? T.winAssisted(S.aiSteps) : T.winByPlayer;
  starsEl.hidden = !scored;
  $("#win-stats").hidden = !celebrate;
  if (scored) {
    const stars = S.aiSteps ? 1 : starsFor(S.mistakes, S.hints);
    starsEl.replaceChildren(...[1, 2, 3].map((n) => icon("star", n <= stars ? "is-on" : "")));
    starsEl.setAttribute("aria-label", T.stars(stars));
  }
  $("#win-time").textContent = formatTime(elapsedMs());
  $("#win-mistakes").textContent = S.mistakes;
  $("#win-hints").textContent = S.hints;

  overlay.hidden = false;
  announce(`${T.winStamp}. ${byAi ? T.winByAi : T.winByPlayer}`);
  if (celebrate) {
    wave();
    play("win");
    anim($("#win-stamp"),
      [{ opacity: 0, transform: "rotate(-14deg) scale(1.5)" }, { opacity: 1, transform: "rotate(-6deg) scale(1)" }],
      { duration: 420, easing: "cubic-bezier(.34,1.56,.64,1)" });
    const css = getComputedStyle(document.documentElement);
    confetti(overlay, ["--innocent", "--criminal", "--spotlight"].map((name) => css.getPropertyValue(name).trim()));
    [...starsEl.children].forEach((star, i) => anim(star,
      [{ transform: "scale(0)" }, { transform: "scale(1.25)" }, { transform: "scale(1)" }],
      { duration: 360, delay: 380 + i * 140, fill: "backwards", easing: "ease-out" }));
  }
  $("#win-next").focus({ preventScroll: true });
}

export function hideWin() {
  overlay.hidden = true;
}

$("#win-close").addEventListener("click", hideWin);
$("#win-again").addEventListener("click", () => actions.restart());
$("#win-next").addEventListener("click", () => actions.nextCase());
