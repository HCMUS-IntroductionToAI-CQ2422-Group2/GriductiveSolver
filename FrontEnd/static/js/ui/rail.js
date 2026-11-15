// Right rail: tabs + the "Hồ sơ" (case file) list of every revealed clue.
import { $, h, icon } from "../lib/dom.js";
import { flipList } from "../lib/motion.js";
import { play } from "../lib/sound.js";
import { prefs, savePrefs } from "../prefs.js";
import { T } from "../i18n/vi.js";
import { S, activeClues, cellById, coord, emit, focusCellId, isProved, isSpent, on } from "../store.js";
import { avatarEl } from "./cards.js";

const tabs = { clues: $("#tab-clues"), ai: $("#tab-ai") };
const panels = { clues: $("#panel-clues"), ai: $("#panel-ai") };
const list = $("#clue-list");
const note = $("#clue-note");
const hideSpent = $("#hide-spent");
const views = new Map(); // clue id -> { root, tags, chips }

export function setTab(name) {
  for (const key of Object.keys(tabs)) {
    const active = key === name;
    tabs[key].setAttribute("aria-selected", String(active));
    tabs[key].tabIndex = active ? 0 : -1;
    panels[key].hidden = !active;
  }
}
for (const [name, tab] of Object.entries(tabs)) {
  tab.addEventListener("click", () => setTab(name));
  tab.addEventListener("keydown", (event) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    const other = name === "clues" ? "ai" : "clues";
    setTab(other);
    tabs[other].focus();
    event.stopPropagation();
  });
}

function markSeen(id) {
  if (S.seenClues.has(id)) return;
  S.seenClues.add(id);
  renderTags(clueOf(id));
}
const clueOf = (id) => S.game?.revealed_clues.find((clue) => clue.id === id);

function setHover(id) {
  if (id != null) markSeen(id);
  if (S.hoverClueId === id) return;
  S.hoverClueId = id;
  emit("select");
}

function togglePin(id) {
  if (S.playback) return;
  S.pinnedClueId = S.pinnedClueId === id ? null : id;
  emit("select");
}

function makeClue(clue) {
  const source = cellById(clue.source_cell_id);
  const tags = h("span", { class: "clue-tags" });
  const chips = h("div", { class: "clue-chips" });
  const head = source
    ? h("div", { class: "clue-head" },
        avatarEl(source.character_name, "clue-avatar"),
        h("strong", {}, source.character_name),
        h("span", { class: "coord" }, coord(source)),
        tags)
    : h("div", { class: "clue-head" },
        h("span", { class: "clue-avatar is-public", "aria-hidden": "true" }, icon("diamond")),
        h("strong", {}, T.publicClue),
        tags);
  const root = h("div", {
    class: `clue${source ? "" : " is-public"}`,
    role: "button",
    tabindex: "0",
    dataset: { id: clue.id },
    onmouseenter: () => setHover(clue.id),
    onmouseleave: () => setHover(null),
    onfocus: () => setHover(clue.id),
    onblur: () => setHover(null),
    onclick: () => togglePin(clue.id),
    onkeydown: (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      togglePin(clue.id);
    },
  }, head, h("p", { class: "clue-text" }, clue.description_nl), chips);
  root.addEventListener("animationend", () => root.classList.remove("is-entering"));
  return { root, tags, chips };
}

function renderTags(clue) {
  const view = clue && views.get(clue.id);
  if (!view) return;
  const tags = [];
  if (S.pinnedClueId === clue.id) tags.push(h("span", { class: "tag tag-pin" }, icon("pin"), T.tagPinned));
  if (!S.seenClues.has(clue.id)) tags.push(h("span", { class: "tag tag-new" }, T.tagNew));
  if (isSpent(clue)) tags.push(h("span", { class: "tag tag-spent" }, icon("check"), T.tagSpent));
  view.tags.replaceChildren(...tags);
}

function renderChips(clue, view) {
  const cells = (clue.referenced_cell_ids ?? []).map(cellById).filter(Boolean);
  view.chips.replaceChildren(...(cells.length
    ? cells.map((cell) => h("span", {
        class: `chip${isProved(cell) ? (cell.is_criminal ? " is-criminal" : " is-innocent") : ""}`,
        dataset: { cell: cell.id },
      }, h("b", {}, coord(cell)), cell.character_name))
    : [h("span", { class: "chip" }, T.noRefs)]));
}

/** Public clues first, then live clues newest-first, then spent ones. */
function ordered() {
  const seq = (clue) => S.clueSeq.get(clue.id) ?? 0;
  const rank = (clue) => (clue.source_cell_id == null ? 0 : isSpent(clue) ? 2 : 1);
  return [...S.game.revealed_clues].sort((a, b) => rank(a) - rank(b)
    || (rank(a) === 0 ? a.id - b.id : seq(b) - seq(a)));
}

function renderList({ fresh, newClues }) {
  const clues = ordered();
  const alive = new Set(clues.map((clue) => clue.id));
  for (const id of [...views.keys()]) if (fresh || !alive.has(id)) views.delete(id);

  let scrollTo = null;
  const nodes = clues.map((clue) => {
    let view = views.get(clue.id);
    if (!view) {
      view = makeClue(clue);
      views.set(clue.id, view);
      if (newClues.includes(clue.id)) {
        view.root.classList.add("is-entering");
        scrollTo ??= view.root;
      }
    }
    const spent = isSpent(clue);
    view.root.classList.toggle("is-spent", spent);
    view.root.hidden = spent && prefs.hideSpent && clue.source_cell_id != null;
    renderChips(clue, view);
    renderTags(clue);
    return view.root;
  });

  const sameOrder = nodes.length === list.children.length && nodes.every((node, i) => list.children[i] === node);
  if (!sameOrder) {
    if (fresh) list.replaceChildren(...nodes);
    else flipList(list, () => { nodes.forEach((node, i) => { if (list.children[i] !== node) list.insertBefore(node, list.children[i] ?? null); }); while (list.children.length > nodes.length) list.lastChild.remove(); });
  }

  const open = clues.filter((clue) => !isSpent(clue)).length;
  note.textContent = T.cluesCount(open, clues.length);
  $("#clue-empty").hidden = clues.length > 0;
  $("#clue-tools").hidden = clues.length === 0;
  tabs.clues.querySelector(".count").textContent = clues.length;

  if (scrollTo) {
    play("clue");
    if (!panels.clues.hidden) scrollTo.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }
}

function renderActive() {
  if (!S.game) return;
  const active = new Set(activeClues().map((clue) => clue.id));
  const cellId = focusCellId();
  const lookingAt = cellById(cellId);
  let firstActive = null;
  for (const [id, view] of views) {
    const clue = clueOf(id);
    if (!clue) continue;
    const classes = view.root.classList;
    classes.toggle("is-active", active.has(id));
    classes.toggle("is-pinned", S.pinnedClueId === id);
    classes.toggle("is-related", !active.has(id) && lookingAt != null && !isProved(lookingAt)
      && (clue.referenced_cell_ids ?? []).includes(cellId));
    view.root.setAttribute("aria-pressed", String(S.pinnedClueId === id));
    for (const chip of view.chips.children) {
      chip.classList.toggle("is-current", chip.dataset.cell !== undefined && Number(chip.dataset.cell) === cellId);
    }
    renderTags(clue);
    if (active.has(id)) firstActive ??= view.root;
  }
  // When the board (not the rail) activated a clue, bring it into view.
  if (firstActive && S.hoverClueId == null && !panels.clues.hidden) {
    const box = firstActive.getBoundingClientRect();
    const host = panels.clues.getBoundingClientRect();
    if (box.top < host.top || box.bottom > host.bottom) firstActive.scrollIntoView({ block: "nearest" });
  }
}

hideSpent.checked = !!prefs.hideSpent;
hideSpent.addEventListener("change", () => {
  savePrefs({ hideSpent: hideSpent.checked });
  if (S.game) renderList({ fresh: false, newClues: [] });
});

on((type, detail) => {
  if (type === "game") { renderList(detail); renderActive(); }
  else if (type === "select") renderActive();
});
