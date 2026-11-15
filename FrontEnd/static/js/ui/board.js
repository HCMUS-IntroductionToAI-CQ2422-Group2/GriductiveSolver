// The suspect grid: builds cards, paints verdicts (with the flip), moves the
// spotlight and places the verdict popover.
import { $, h, isMobile, rectIn } from "../lib/dom.js";
import { flip, pop, shake, stampIn } from "../lib/motion.js";
import { play } from "../lib/sound.js";
import { T } from "../i18n/vi.js";
import { S, actions, activeClues, cellById, cluesOf, coord, emit, isProved, on } from "../store.js";
import { makeCell, paintCell } from "./cards.js";

const stage = $("#board-stage");
const boardEl = $("#board");
const spotlight = $("#spotlight");
const verdictPop = $("#verdict-pop");
const cluePop = $("#clue-pop");
const views = new Map();

export const cellView = (id) => views.get(id);
export const stageEl = () => stage;
export const cellRect = (id) => {
  const view = views.get(id);
  return view ? rectIn(view.root, stage) : null;
};
export const focusCell = (id) => views.get(id)?.card.focus({ preventScroll: true });

export function shakeCell(id) {
  const view = views.get(id);
  if (!view) return;
  view.root.classList.add("is-wrong");
  shake(view.card).then(() => view.root.classList.remove("is-wrong"));
  setTimeout(() => view.root.classList.remove("is-wrong"), 600);
}

/** Victory wave: cards pop along the diagonals. */
export function wave() {
  for (const [id, view] of views) {
    const cell = cellById(id);
    if (cell) setTimeout(() => pop(view.card, 1.08), (cell.row + cell.column) * 55);
  }
}

function build(game) {
  views.clear();
  boardEl.style.setProperty("--cols", game.width);
  boardEl.style.setProperty("--rows", game.height);
  boardEl.dataset.size = Math.max(game.width, game.height);
  boardEl.setAttribute("aria-rowcount", game.height + 1);
  boardEl.setAttribute("aria-colcount", game.width + 1);

  const head = h("div", { class: "board-row", role: "row" }, h("span", { class: "axis", role: "presentation" }));
  for (let column = 0; column < game.width; column++) {
    head.append(h("span", { class: "axis", role: "columnheader" }, String.fromCharCode(65 + column)));
  }
  const rows = [head];
  for (let row = 0; row < game.height; row++) {
    const rowEl = h("div", { class: "board-row", role: "row" },
      h("span", { class: "axis", role: "rowheader" }, String(row + 1)));
    for (let column = 0; column < game.width; column++) {
      const cell = game.cells.find((item) => item.row === row && item.column === column);
      if (!cell) { rowEl.append(h("div", { role: "gridcell" })); continue; }
      const view = makeCell(cell, coord(cell));
      views.set(cell.id, view);
      rowEl.append(view.root);
    }
    rows.push(rowEl);
  }
  boardEl.replaceChildren(...rows);
}

const clueTextOf = (cellId) => cluesOf(cellId).map((clue) => clue.description_nl).join(" ");

/**
 * Show as many whole lines of each testimony as the card has room for, and
 * remember which ones were cut so the full text can pop up on hover.
 */
function fitClues() {
  for (const view of views.values()) {
    const text = view.clueText;
    view.clipped = false;
    if (!view.root.classList.contains("has-clue")) continue;
    if (text.offsetHeight === 0) { view.clipped = true; continue; } // compact card: icon only
    const lineHeight = parseFloat(getComputedStyle(text).lineHeight) || 16;
    text.style.webkitLineClamp = Math.max(1, Math.floor((text.parentElement.clientHeight + 1) / lineHeight));
    view.clipped = text.scrollHeight > text.clientHeight + 1;
  }
}

function paint({ fresh, newlyProved }) {
  let order = 0;
  for (const cell of S.game.cells) {
    const view = views.get(cell.id);
    if (!view) continue;
    const count = clueTextOf(cell.id);
    if (!fresh && newlyProved.includes(cell.id)) {
      const first = order === 0;
      flip(view.card, () => {
        paintCell(view, cell, count);
        fitClues();
        if (first) play(cell.is_criminal ? "criminal" : "innocent");
      }, order++ * 70).then(() => { stampIn(view.stamp); });
    } else {
      paintCell(view, cell, count);
    }
  }
  fitClues();
}

function placeSpotlight() {
  const ai = S.aiCellId != null;
  const rect = cellRect(ai ? S.aiCellId : S.selectedId);
  if (!rect) { spotlight.hidden = true; return; }
  const wasHidden = spotlight.hidden;
  if (wasHidden) spotlight.classList.add("no-anim");
  spotlight.hidden = false;
  spotlight.classList.toggle("is-ai", ai);
  const pad = isMobile() ? 3 : 6;
  spotlight.style.width = `${rect.w + pad * 2}px`;
  spotlight.style.height = `${rect.h + pad * 2 + 4}px`;
  spotlight.style.transform = `translate(${rect.x - pad}px, ${rect.y - pad}px)`;
  if (wasHidden) { void spotlight.offsetWidth; spotlight.classList.remove("no-anim"); }
}

function placeVerdict() {
  const cell = cellById(S.selectedId);
  const open = S.mode === "live" && cell && !isProved(cell) && !S.playback;
  verdictPop.hidden = !open;
  if (!open) return;
  verdictPop.setAttribute("aria-label", T.verdictFor(cell.character_name));
  for (const button of verdictPop.querySelectorAll("button")) button.disabled = S.busy;
  if (isMobile()) { verdictPop.style.left = verdictPop.style.top = ""; return; }

  const card = views.get(cell.id).root.getBoundingClientRect();
  const box = verdictPop.getBoundingClientRect();
  const left = Math.min(Math.max(card.left + card.width / 2 - box.width / 2, 8), window.innerWidth - box.width - 8);
  let top = card.bottom + 16;
  if (top + box.height > window.innerHeight - 8) top = card.top - box.height - 14;
  verdictPop.style.left = `${left}px`;
  verdictPop.style.top = `${top}px`;
}

/** Full testimony next to a card whose text did not fit (or is icon-only). */
function placeCluePop() {
  const id = [S.hoverCellId, S.selectedId].find((cellId) => views.get(cellId)?.clipped);
  const view = S.playback ? null : views.get(id);
  cluePop.hidden = !view;
  if (!view) return;
  const cell = cellById(id);
  cluePop.replaceChildren(
    h("strong", {}, `${cell.character_name} (${coord(cell)})`),
    h("span", {}, view.clueText.textContent));
  const rect = rectIn(view.root, stage);
  const width = cluePop.offsetWidth;
  const height = cluePop.offsetHeight;
  const x = Math.min(Math.max(rect.x + rect.w / 2 - width / 2, 4), stage.clientWidth - width - 4);
  let y = rect.y + rect.h + 12;
  if (y + height > stage.clientHeight - 4) y = rect.y - height - 12;
  cluePop.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
}

function renderSelection() {
  if (!S.game) return;
  const clues = activeClues();
  const mentioned = new Set(clues.flatMap((clue) => clue.referenced_cell_ids ?? []));
  const sources = new Set(clues.map((clue) => clue.source_cell_id));
  const tabStop = S.selectedId ?? S.game.cells[0]?.id;

  for (const [id, view] of views) {
    const classes = view.root.classList;
    classes.toggle("is-selected", id === S.selectedId);
    classes.toggle("is-source", sources.has(id));
    classes.toggle("is-mentioned", mentioned.has(id) && !sources.has(id));
    classes.toggle("is-hinted", id === S.hint?.cellId);
    classes.toggle("is-ai", id === S.aiCellId);
    classes.toggle("is-busy", id === S.busyCellId);
    view.root.setAttribute("aria-selected", String(id === S.selectedId));
    view.card.tabIndex = id === tabStop ? 0 : -1;
  }
  boardEl.classList.toggle("is-locked", !!S.playback);
  boardEl.setAttribute("aria-busy", String(S.busy));
  placeSpotlight();
  placeVerdict();
  placeCluePop();
}

// ---------- Events ----------

const idOf = (target) => {
  const el = target.closest?.(".cell[data-id]");
  return el && boardEl.contains(el) ? Number(el.dataset.id) : null;
};

function setHover(id) {
  if (S.hoverCellId === id) return;
  S.hoverCellId = id;
  emit("select");
}

boardEl.addEventListener("click", (event) => {
  const id = idOf(event.target);
  if (id != null) actions.select(id);
});
boardEl.addEventListener("mouseover", (event) => setHover(idOf(event.target)));
boardEl.addEventListener("mouseleave", () => setHover(null));
// Keyboard focus acts like hover. Focus that came from a mouse click does not,
// otherwise a clicked card would keep its threads up after the pointer leaves.
boardEl.addEventListener("focusin", (event) => {
  if (event.target.matches?.(":focus-visible")) setHover(idOf(event.target));
});
boardEl.addEventListener("focusout", () => setHover(null));

for (const button of verdictPop.querySelectorAll("button")) {
  button.addEventListener("click", () => {
    if (S.selectedId != null) actions.submitVerdict(S.selectedId, button.dataset.verdict === "criminal");
  });
}

new ResizeObserver(() => {
  if (!S.game) return;
  spotlight.classList.add("no-anim");
  fitClues();
  placeSpotlight();
  placeVerdict();
  placeCluePop();
  void spotlight.offsetWidth;
  spotlight.classList.remove("no-anim");
  emit("layout");
}).observe(stage);
window.addEventListener("resize", () => { if (S.game) placeVerdict(); });
$(".stage").addEventListener("scroll", () => { if (S.game) placeVerdict(); }, { passive: true });

on((type, detail) => {
  if (type === "game") {
    if (detail.fresh) build(S.game);
    paint(detail);
    renderSelection();
  } else if (type === "select" || type === "controls") {
    renderSelection();
  }
});
document.fonts?.ready.then(() => { if (S.game) fitClues(); });
