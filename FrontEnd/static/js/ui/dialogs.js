// "Cách chơi" (rules, tips, shortcuts) and "Cài đặt" dialogs. Native <dialog>
// gives us focus trapping, Esc to close and focus return for free.
import { $, $$, h } from "../lib/dom.js";
import { currentTheme, prefs, savePrefs } from "../prefs.js";
import { T } from "../i18n/vi.js";
import { renderTheme } from "./topbar.js";
import { openTutorial } from "./tutorial.js";

// Shared behaviour for every dialog: [data-close] buttons and backdrop click.
for (const dialog of $$("dialog")) {
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog || event.target.closest("[data-close]")) dialog.close();
  });
}

function buildHelp() {
  $("#help-body").replaceChildren(
    h("section", {}, h("h3", {}, T.rulesTitle), h("ol", {}, T.rules.map((rule) => h("li", {}, rule)))),
    h("section", {}, h("h3", {}, T.tipsTitle), h("ul", {}, T.tips.map((tip) => h("li", {}, tip)))),
    h("section", {}, h("h3", {}, T.keysTitle),
      h("dl", { class: "keys" }, T.keys.flatMap(([keys, label]) => [
        h("dt", {}, keys.map((key) => h("kbd", {}, key))),
        h("dd", {}, label),
      ]))),
  );
}

export function openHelp() {
  const dialog = $("#dlg-help");
  if (!dialog.open) dialog.showModal();
}

function check(id, [label, hint], checked, onChange) {
  const input = h("input", { type: "checkbox", id, onchange: () => onChange(input.checked) });
  input.checked = checked;
  return h("label", { class: "setting", for: id }, h("span", {}, label, h("small", {}, hint)), input);
}

function buildSettings() {
  const speeds = h("div", { class: "speed", role: "group", "aria-label": T.setSpeed[0] },
    [0.5, 1, 2].map((speed) => h("button", {
      type: "button",
      "aria-pressed": String(prefs.speed === speed),
      onclick: () => { savePrefs({ speed }); buildSettings(); },
    }, `${speed}×`)));
  $("#settings-body").replaceChildren(
    check("set-light", T.setLight, currentTheme() === "light",
      (on) => { savePrefs({ theme: on ? "light" : "dark" }); renderTheme(); }),
    check("set-sound", T.setSound, prefs.sound, (on) => savePrefs({ sound: on })),
    check("set-motion", T.setMotion, prefs.reduceMotion, (on) => savePrefs({ reduceMotion: on })),
    h("div", { class: "setting" }, h("span", {}, T.setSpeed[0], h("small", {}, T.setSpeed[1])), speeds),
  );
}

export function openSettings() {
  buildSettings();
  const dialog = $("#dlg-settings");
  if (!dialog.open) dialog.showModal();
}

buildHelp();
$("#help-btn").addEventListener("click", openHelp);
$("#settings-btn").addEventListener("click", openSettings);
$("#settings-help").addEventListener("click", () => { $("#dlg-settings").close(); openHelp(); });
for (const button of $$("[data-tutorial]")) {
  button.addEventListener("click", () => { button.closest("dialog")?.close(); openTutorial(); });
}
