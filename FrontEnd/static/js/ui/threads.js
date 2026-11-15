// Clue Threads: red strings from the witness to everyone their clue mentions.
// Purely decorative (aria-hidden); the same information is in the clue chips.
import { $ } from "../lib/dom.js";
import { S, activeClues, isSpent, on } from "../store.js";
import { cellRect, stageEl } from "./board.js";

const svg = $("#threads");
const NS = "http://www.w3.org/2000/svg";
let lastKey = "";

const make = (tag, attrs) => {
  const el = document.createElementNS(NS, tag);
  for (const [key, value] of Object.entries(attrs)) el.setAttribute(key, value);
  return el;
};

/** The pin sits on the top edge of a card, centred. */
function pinOf(cellId) {
  const rect = cellRect(cellId);
  return rect ? { x: rect.x + rect.w / 2, y: rect.y - 1 } : null;
}

function draw(animate) {
  const clues = S.game ? activeClues() : [];
  const groups = [];
  for (const clue of clues) {
    const from = clue.source_cell_id == null
      ? { x: stageEl().clientWidth / 2, y: 6 }
      : pinOf(clue.source_cell_id);
    if (!from) continue;
    const group = make("g", isSpent(clue) ? { class: "is-spent" } : {});
    if (clue.source_cell_id == null) group.append(make("circle", { cx: from.x, cy: from.y, r: 5 }));
    for (const id of clue.referenced_cell_ids ?? []) {
      if (id === clue.source_cell_id) continue;
      const to = pinOf(id);
      if (!to) continue;
      const distance = Math.hypot(to.x - from.x, to.y - from.y);
      const sag = Math.min(46, distance * 0.16); // a hanging string dips in the middle
      const path = make("path", {
        d: `M${from.x} ${from.y} Q${(from.x + to.x) / 2} ${(from.y + to.y) / 2 + sag} ${to.x} ${to.y}`,
        pathLength: 1,
      });
      if (animate) path.classList.add("is-drawing");
      group.append(path);
    }
    groups.push(group);
  }
  svg.replaceChildren(...groups);
}

on((type) => {
  if (type !== "game" && type !== "select" && type !== "layout" && type !== "controls") return;
  const key = S.game ? activeClues().map((clue) => clue.id).join(",") : "";
  // Only replay the "pulling the string" animation when the set of clues changes.
  draw(key !== lastKey && key !== "");
  lastKey = key;
});
