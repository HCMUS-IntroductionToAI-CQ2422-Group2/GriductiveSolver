// "AI" tab: the solver's reasoning, showing only what the backend returned.
//
// Each entry shows the two SAT checks for the concluded cell (assume criminal /
// assume innocent). Every other check of that step sits in a closed <details>.
// We do NOT claim which clues a step is "based on": the API only tells us which
// clues were open, not a minimal explanation.
import { $, h, icon } from "../lib/dom.js";
import { T } from "../i18n/vi.js";
import { S, cellById, coord, emit } from "../store.js";

const list = $("#journal-list");
const empty = $("#journal-empty");
const base = $("#journal-base");
const badge = $("#tab-ai .count");
let entries = []; // { el, run, cellId }

function refresh() {
  empty.hidden = entries.length > 0;
  base.hidden = entries.length === 0;
  badge.textContent = entries.length;
  badge.hidden = entries.length === 0;
}

function proofRow(text, satisfiable, raw = false) {
  return h("div", { class: "proof-row" },
    h("span", {}, text),
    h("b", { class: satisfiable ? "sat" : "unsat" },
      raw ? null : icon(satisfiable ? "check" : "x"),
      raw ? (satisfiable ? T.satRaw : T.unsatRaw) : (satisfiable ? T.sat : T.unsat)));
}

const nameOf = (cellId) => cellById(cellId)?.character_name ?? `#${cellId}`;

/**
 * entry: { kind: "hint" | "ai", run, no, verdict: {cell_id, is_criminal},
 *          queries: [{assumption, satisfiable}], openClues: number, unlockedBy: string[] }
 */
export function addStep(entry) {
  const cell = cellById(entry.verdict.cell_id);
  const name = nameOf(entry.verdict.cell_id);
  const own = entry.queries.filter((query) => query.assumption?.cell_id === entry.verdict.cell_id);
  own.sort((a, b) => Number(b.assumption.is_criminal) - Number(a.assumption.is_criminal));
  const guilty = entry.verdict.is_criminal;

  const el = h("article", { class: "step is-entering", dataset: { kind: entry.kind } },
    h("div", { class: "step-head" },
      h("span", { class: "step-no" }, T.stepNo(entry.no)),
      h("span", {}, entry.kind === "hint" ? T.fromHint : T.fromAi),
      h("span", { class: `step-verdict ${guilty ? "is-criminal" : "is-innocent"}` },
        icon(guilty ? "x" : "check"), T.verdictName(guilty))),
    h("div", { class: "step-who" }, name, cell ? h("span", { class: "coord" }, coord(cell)) : null),
    h("div", { class: "proof" },
      ...own.map((query) => proofRow(T.assume(name, query.assumption.is_criminal), query.satisfiable))),
    h("div", { class: "proof-so" }, T.conclusion(guilty)),
    h("div", { class: "step-meta" },
      T.openClues(entry.openClues),
      entry.unlockedBy?.length ? ` · ${T.unlocked(entry.unlockedBy.join(", "))}` : ""),
    h("details", {},
      h("summary", {}, T.details(entry.queries.length)),
      h("div", { class: "proof" }, ...entry.queries.map((query) => proofRow(
        query.assumption ? T.assume(nameOf(query.assumption.cell_id), query.assumption.is_criminal) : T.baseline,
        query.satisfiable, true)))),
  );
  el.addEventListener("animationend", () => el.classList.remove("is-entering"));
  el.addEventListener("mouseenter", () => peek(entry.verdict.cell_id));
  el.addEventListener("mouseleave", () => peek(null));

  for (const item of entries) item.el.classList.remove("is-current");
  el.classList.add("is-current");
  list.append(el);
  entries.push({ el, run: entry.run });
  refresh();
  if (!$("#panel-ai").hidden) el.scrollIntoView({ block: "nearest", behavior: "smooth" });
}

/** Hovering a step points at its cell on the board (not during playback). */
function peek(cellId) {
  if (S.playback || S.aiCellId === cellId) return;
  S.aiCellId = cellId;
  emit("select");
}

/** Drop the steps of one auto-solve run beyond `keep` (playback rewind). */
export function truncateRun(run, keep) {
  let seen = 0;
  entries = entries.filter((item) => {
    if (item.run !== run) return true;
    if (seen++ < keep) return true;
    item.el.remove();
    return false;
  });
  refresh();
}

export function clearJournal() {
  entries = [];
  list.replaceChildren();
  refresh();
}

export const nextStepNo = () => entries.length + 1;

refresh();
