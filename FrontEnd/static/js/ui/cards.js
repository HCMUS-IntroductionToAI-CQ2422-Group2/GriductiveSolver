// Suspect card element + avatar lookup. Shared by the board and the tutorial.
import { h, icon } from "../lib/dom.js";
import { T } from "../i18n/vi.js";

let available = new Set();

/** Ask the backend which portraits exist (GET /app/avatars.json). */
export async function loadAvatars() {
  try {
    const response = await fetch(new URL("../../../avatars.json", import.meta.url));
    if (!response.ok) return;
    const list = await response.json();
    if (Array.isArray(list)) available = new Set(list);
  } catch { /* initials are the fallback */ }
}

const slug = (name) => name.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase()
  .replace(/đ/g, "d").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const initials = (name) => name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();

const TINTS = ["--ai", "--spotlight", "--innocent", "--thread", "--focus"];
function tintFor(name) {
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.codePointAt(0)) >>> 0;
  return `color-mix(in srgb, var(${TINTS[hash % TINTS.length]}) 32%, var(--surface))`;
}

/** Round portrait: the SVG if we have one, otherwise initials on a tint. */
export function avatarEl(name, className) {
  const el = h("span", { class: className, "aria-hidden": "true" });
  el.style.setProperty("--avatar-bg", tintFor(name));
  const file = `${slug(name)}.svg`;
  if (available.has(file)) {
    el.append(h("img", {
      src: new URL(`../../avatars/${file}`, import.meta.url).href,
      alt: "",
      loading: "lazy",
      onerror: (event) => event.target.replaceWith(initials(name)),
    }));
  } else {
    el.textContent = initials(name);
  }
  return el;
}

/**
 * One grid cell. The card itself is a single <button>; nothing interactive
 * is nested inside it.
 */
export function makeCell(cell, position) {
  const stampText = h("span");
  const clueText = h("span", { class: "card-clue-text" });
  const stamp = h("span", { class: "card-stamp" }, stampText);
  const card = h("button", { class: "card", type: "button", tabindex: "-1" },
    h("span", { class: "card-pin" }),
    h("span", { class: "card-coord" }, position),
    h("span", { class: "card-mark" }, "?"),
    stamp,
    avatarEl(cell.character_name, "card-avatar"),
    h("span", { class: "card-name" }, cell.character_name),
    h("span", { class: "card-job" }, cell.profession),
    h("span", { class: "card-clue" }, icon("chat"), clueText),
  );
  const root = h("div", { class: "cell", role: "gridcell", dataset: { id: cell.id } }, card);
  return { root, card, stamp, stampText, clueText, position, status: undefined };
}

/** Paint verdict + testimony. `clue` is the text this person said ("" if none). */
export function paintCell(view, cell, clue = "") {
  const status = cell.is_criminal ?? null;
  view.root.classList.toggle("is-innocent", status === false);
  view.root.classList.toggle("is-criminal", status === true);
  view.root.classList.toggle("has-clue", clue !== "");
  view.clueText.textContent = clue;
  if (status !== view.status) {
    view.stamp.querySelector("svg")?.remove();
    if (status !== null) view.stamp.prepend(icon(status ? "x" : "check"));
    view.stampText.textContent = status === null ? "" : T.verdictName(status);
    view.status = status;
  }
  view.card.setAttribute("aria-label", T.cellLabel(
    view.position, cell.character_name, cell.profession,
    status === null ? T.unknown : T.verdictName(status), clue,
  ));
}
