// Three tiers of feedback:
//   bubble  - right on the card (verdict results, hints)
//   toast   - system info, stacked, auto-dismissed
//   dialog  - only when a decision is needed (errors)
import { $, h, icon } from "../lib/dom.js";
import { T } from "../i18n/vi.js";
import { cellRect, stageEl } from "./board.js";

const toasts = $("#toasts");
const live = $("#live");
const bubbleEl = $("#bubble");
let bubbleTimer = null;
let bubbleCell = null;

/** Screen-reader announcement (kept separate from visual toasts). */
export function announce(text) {
  live.textContent = "";
  requestAnimationFrame(() => { live.textContent = text; });
}

export function toast(message) {
  const el = h("div", { class: "toast", role: "status" },
    h("span", {}, message),
    h("button", { class: "tool", type: "button", "aria-label": T.close, onclick: () => dismiss(el) }, icon("x")));
  toasts.append(el);
  while (toasts.children.length > 3) toasts.firstChild.remove();
  setTimeout(() => dismiss(el), 3200);
}

function dismiss(el) {
  if (!el.isConnected) return;
  el.classList.add("is-leaving");
  setTimeout(() => el.remove(), 220);
}

function placeBubble() {
  const rect = cellRect(bubbleCell);
  if (!rect) return hideBubble();
  const stage = stageEl();
  const w = bubbleEl.offsetWidth;
  const hgt = bubbleEl.offsetHeight;
  let x = rect.x + rect.w / 2 - w / 2;
  let y = rect.y - hgt - 14;
  if (y < -44) {
    // No room above (top row): sit beside the card instead.
    y = rect.y;
    x = rect.x + rect.w + 14;
    if (x + w > stage.clientWidth - 4) x = rect.x - w - 14;
  }
  x = Math.min(Math.max(x, 4), stage.clientWidth - w - 4);
  bubbleEl.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
}

/** kind: "ok" | "bad" | "hint". sticky bubbles stay until hideBubble(). */
export function bubble(cellId, { kind, title, text, sticky = false }) {
  clearTimeout(bubbleTimer);
  bubbleCell = cellId;
  bubbleEl.className = `bubble is-${kind}`;
  bubbleEl.replaceChildren(h("strong", {}, title), text ? h("span", {}, text) : null);
  bubbleEl.hidden = false;
  // Restart the entrance animation for consecutive bubbles.
  bubbleEl.style.animation = "none";
  void bubbleEl.offsetWidth;
  bubbleEl.style.animation = "";
  placeBubble();
  announce(`${title} ${text ?? ""}`);
  if (!sticky) bubbleTimer = setTimeout(hideBubble, 2600);
}

export function hideBubble() {
  clearTimeout(bubbleTimer);
  bubbleEl.hidden = true;
  bubbleCell = null;
}

window.addEventListener("resize", () => { if (!bubbleEl.hidden) placeBubble(); });

/** Blocking message with an optional retry. Uses the native <dialog>. */
export function message({ title, text, code, onRetry }) {
  const dialog = $("#dlg-message");
  $("#msg-title").textContent = title;
  $("#msg-text").textContent = text;
  $("#msg-code").textContent = code ?? "";
  $("#msg-code").hidden = !code;
  const retry = $("#msg-retry");
  retry.hidden = !onRetry;
  retry.onclick = () => { dialog.close(); onRetry?.(); };
  if (!dialog.open) dialog.showModal();
}
