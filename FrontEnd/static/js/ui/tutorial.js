// Interactive tutorial on a 2×2 grid. The puzzle is a fixed illustration that
// lives entirely in the browser (it is not one of the real cases), so it can
// carry its own tiny "is this verdict forced?" check.
import { $, h, icon } from "../lib/dom.js";
import { flip, shake, stampIn } from "../lib/motion.js";
import { play } from "../lib/sound.js";
import { savePrefs } from "../prefs.js";
import { T } from "../i18n/vi.js";
import { avatarEl, makeCell, paintCell } from "./cards.js";

const dialog = $("#dlg-tutorial");
const boardEl = $("#tut-board");
const msg = $("#tut-msg");
const nextBtn = $("#tut-next");
const verdictButtons = [...$("#tut-verdict").querySelectorAll("button")];

const PEOPLE = [
  { id: 0, pos: "A1", character_name: "Lan", profession: "Họa sĩ" },
  { id: 1, pos: "B1", character_name: "Minh", profession: "Kỹ sư" },
  { id: 2, pos: "A2", character_name: "Hà", profession: "Thợ may" },
  { id: 3, pos: "B2", character_name: "Tuấn", profession: "Thủ thư" },
];
// Each clue: who must be proved before it is revealed, and the rule itself.
const CLUES = [
  { by: null, text: T.tutPublic, holds: (v) => v.filter(Boolean).length === 1 },
  { by: 0, text: T.tutLan, holds: (v) => v[1] === false },
  { by: 1, text: T.tutMinh, holds: (v) => v[2] === false },
];

let step = 0;
let selected = null;
let known = [];
let views = [];

const openClues = () => CLUES.filter((clue) => clue.by === null || known[clue.by] !== null);

/** Which values can `id` still take, given what is public right now? */
function possible(id) {
  const values = new Set();
  for (let mask = 0; mask < 16; mask++) {
    const world = PEOPLE.map((_, i) => Boolean(mask & (1 << i)));
    if (known.every((value, i) => value === null || value === world[i])
      && openClues().every((clue) => clue.holds(world))) values.add(world[id]);
  }
  return values;
}

function say(text, kind = "") {
  msg.textContent = text;
  msg.className = `tut-msg${kind ? ` is-${kind}` : ""}`;
}

function render() {
  $("#tut-text").innerHTML = T.tutSteps[step]; // trusted static copy
  [...$("#tut-dots").children].forEach((dot, i) => dot.classList.toggle("is-on", i <= step));
  $("#tut-clues").replaceChildren(...openClues().map((clue) => {
    const who = clue.by === null ? null : PEOPLE[clue.by];
    return h("div", { class: `clue${who ? "" : " is-public"}` },
      h("div", { class: "clue-head" },
        who ? avatarEl(who.character_name, "clue-avatar")
          : h("span", { class: "clue-avatar is-public", "aria-hidden": "true" }, icon("diamond")),
        h("strong", {}, who ? who.character_name : T.publicClue),
        who ? h("span", { class: "coord" }, who.pos) : null),
      h("p", { class: "clue-text" }, clue.text));
  }));
  views.forEach((view, i) => {
    view.root.classList.toggle("is-selected", i === selected);
    view.root.classList.toggle("is-hinted", step === 1 && i === 1 && selected !== 1);
  });
  const canJudge = step >= 1 && step < 3 && selected !== null && known[selected] === null;
  $("#tut-verdict").hidden = step === 0 || step === 3;
  for (const button of verdictButtons) button.disabled = !canJudge;
  nextBtn.hidden = step === 1 || step === 2;
  nextBtn.textContent = step === 3 ? T.tutStart : T.tutNext;
  $("#tut-skip").hidden = step === 3;
}

function pick(id) {
  if (step === 0 || step === 3 || known[id] !== null) return;
  if (step === 1 && id !== 1) { say(T.tutPickMinh, "bad"); shake(views[id].card); return; }
  selected = id;
  say("");
  render();
}

function judge(isCriminal) {
  if (selected === null) return;
  const id = selected;
  const options = possible(id);
  if (!options.has(isCriminal)) { say(T.tutWrong, "bad"); shake(views[id].card); play("wrong"); return; }
  if (options.size > 1) { say(T.tutNotYet, "bad"); shake(views[id].card); play("wrong"); return; }

  known[id] = isCriminal;
  selected = null;
  say(T.tutRight, "ok");
  const person = { ...PEOPLE[id], is_criminal: isCriminal };
  flip(views[id].card, () => {
    paintCell(views[id], person, CLUES.find((clue) => clue.by === id)?.text ?? "");
    play(isCriminal ? "criminal" : "innocent");
  }).then(() => stampIn(views[id].stamp));
  if (step === 1) step = 2;
  if (known.every((value) => value !== null)) step = 3;
  render();
  if (step === 3) nextBtn.focus();
}

export function openTutorial() {
  step = 0;
  selected = null;
  known = [false, null, null, null]; // Lan starts proved innocent
  views = PEOPLE.map((person) => {
    const view = makeCell(person, person.pos);
    view.card.tabIndex = 0;
    view.card.addEventListener("click", () => pick(person.id));
    paintCell(view, { ...person, is_criminal: known[person.id] }, person.id === 0 ? T.tutLan : "");
    return view;
  });
  boardEl.replaceChildren(...views.map((view) => view.root));
  say("");
  render();
  if (!dialog.open) dialog.showModal();
  nextBtn.focus();
}

nextBtn.addEventListener("click", () => {
  if (step === 0) { step = 1; render(); }
  else if (step === 3) dialog.close();
});
for (const button of verdictButtons) {
  button.addEventListener("click", () => judge(button.dataset.verdict === "criminal"));
}
dialog.addEventListener("close", () => savePrefs({ tutorialDone: true }));
