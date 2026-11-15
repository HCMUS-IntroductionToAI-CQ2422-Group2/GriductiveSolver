// Top bar (case picker, timer, counters, theme, offline chip), the segmented
// progress bar and the enabled/disabled state of the action buttons.
import { $, h, icon } from "../lib/dom.js";
import { pop } from "../lib/motion.js";
import { currentTheme, isSolved, savePrefs } from "../prefs.js";
import { T } from "../i18n/vi.js";
import { S, actions, cellById, elapsedMs, formatTime, on, puzzleInfo, startTimer, stopTimer } from "../store.js";

const caseBtn = $("#case-btn");
const menu = $("#case-menu");
const track = $("#progress-track");
const shown = { mistakes: 0, hints: 0 };

/** "medium-5x5-museum" -> "Bảo tàng" */
export const caseTitle = (id) => T.caseName(puzzleInfo(id).slug);
const caseMeta = (id) => {
  const info = puzzleInfo(id);
  return [info.size, info.level && T.levelName(info.level)].filter(Boolean).join(" · ");
};

// ---------- Case picker ----------

function renderCase() {
  $("#case-name").textContent = caseTitle(S.game.puzzle_id);
  $("#case-meta").textContent = caseMeta(S.game.puzzle_id);
  document.title = `${caseTitle(S.game.puzzle_id)} · Griductive`;
}

function openMenu(open) {
  if (open) {
    menu.replaceChildren(...S.puzzles.map((id) => {
      const info = puzzleInfo(id);
      return h("button", {
        class: "menu-item",
        type: "button",
        role: "option",
        "aria-selected": String(id === S.game?.puzzle_id),
        onclick: () => { openMenu(false); if (id !== S.game?.puzzle_id) actions.loadCase(id); },
      },
        isSolved(id) ? h("span", { class: "solved", title: T.solvedMark }, icon("check")) : h("span"),
        h("span", {}, h("strong", {}, caseTitle(id)), " ", h("small", {}, info.size ?? "")),
        info.level ? h("span", { class: "difficulty", dataset: { level: info.level } }, T.levelName(info.level)) : null);
    }));
  }
  menu.hidden = !open;
  caseBtn.setAttribute("aria-expanded", String(open));
  if (open) (menu.querySelector('[aria-selected="true"]') ?? menu.firstChild)?.focus();
}
export const closeMenu = () => { if (menu.hidden) return false; openMenu(false); return true; };

caseBtn.addEventListener("click", () => openMenu(menu.hidden));
document.addEventListener("pointerdown", (event) => {
  if (!menu.hidden && !event.target.closest(".case-picker")) openMenu(false);
});
menu.addEventListener("keydown", (event) => {
  const items = [...menu.children];
  const at = items.indexOf(document.activeElement);
  if (event.key === "ArrowDown") items[(at + 1) % items.length]?.focus();
  else if (event.key === "ArrowUp") items[(at - 1 + items.length) % items.length]?.focus();
  else if (event.key === "Escape") { openMenu(false); caseBtn.focus(); }
  else return;
  event.preventDefault();
  event.stopPropagation();
});

// ---------- Counters, timer, progress ----------

function renderStats() {
  for (const key of ["mistakes", "hints"]) {
    const el = $(`#stat-${key} b`);
    el.textContent = S[key];
    if (S[key] > shown[key]) pop(el, 1.4);
    shown[key] = S[key];
  }
}

function renderTimer() {
  $("#stat-timer b").textContent = formatTime(elapsedMs());
}
setInterval(renderTimer, 500);

let resumeOnShow = false;
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    resumeOnShow = S.timer.startedAt != null;
    stopTimer();
  } else if (resumeOnShow && !S.paused) {
    startTimer();
  }
});

function renderProgress() {
  const total = S.game.cells.length;
  if (track.children.length !== total) {
    track.replaceChildren(...Array.from({ length: total }, () => h("i", { class: "progress-seg" })));
  }
  [...track.children].forEach((seg, i) => {
    const cell = cellById(S.solveOrder[i]);
    seg.classList.toggle("is-innocent", cell?.is_criminal === false);
    seg.classList.toggle("is-criminal", cell?.is_criminal === true);
  });
  const [count, rest] = T.progress(S.solveOrder.length, total);
  $("#progress-label").replaceChildren(h("b", {}, count), rest);
}

// ---------- Controls ----------

function renderControls() {
  const live = S.mode === "live";
  const hint = $("#hint-btn");
  const auto = $("#auto-btn");
  hint.disabled = auto.disabled = S.busy || !live || S.paused;
  hint.title = auto.title = live ? "" : T.needsLive;
  auto.querySelector("span").textContent = S.working === "auto" ? T.autoWorking : T.autoBtn;
  $("#restart-btn").disabled = S.busy;
  caseBtn.disabled = S.busy || S.mode === "connecting";
  $("#offline-chip").hidden = S.mode !== "mock";
}

function renderTheme() {
  $("#theme-btn").replaceChildren(icon(currentTheme() === "dark" ? "sun" : "moon"));
}
$("#theme-btn").addEventListener("click", () => {
  const apply = () => { savePrefs({ theme: currentTheme() === "dark" ? "light" : "dark" }); renderTheme(); };
  if (document.startViewTransition && !document.documentElement.classList.contains("reduce-motion")) document.startViewTransition(apply);
  else apply();
});
export { renderTheme };

$("#offline-chip").addEventListener("click", () => actions.reconnect());
$("#hint-btn").addEventListener("click", () => actions.hint());
$("#auto-btn").addEventListener("click", () => actions.autoSolve());
$("#restart-btn").addEventListener("click", () => actions.restart());

renderTheme();

on((type) => {
  if (!S.game) { if (type === "controls") renderControls(); return; }
  if (type === "game") { renderCase(); renderProgress(); renderStats(); renderTimer(); renderControls(); }
  else if (type === "stats") { renderStats(); renderTimer(); }
  else if (type === "controls") renderControls();
});
