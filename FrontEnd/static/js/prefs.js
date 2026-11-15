// Per-browser preferences. Storage can be unavailable (private mode), so every
// access is guarded and the app works without it.

const KEY = "griductive:prefs";
const SOLVED_KEY = "griductive:solved";

function read(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
}
function write(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* ignore */ }
}

export const prefs = {
  theme: null,          // "dark" | "light" | null (follow the system)
  sound: false,
  reduceMotion: false,
  speed: 1,             // AI playback speed multiplier
  tutorialDone: false,
  hideSpent: false,
  ...read(KEY, {}),
};

export function savePrefs(patch = {}) {
  Object.assign(prefs, patch);
  write(KEY, prefs);
  applyPrefs();
}

export function currentTheme() {
  if (prefs.theme) return prefs.theme;
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

export function applyPrefs() {
  const root = document.documentElement;
  root.dataset.theme = currentTheme();
  root.classList.toggle("reduce-motion", !!prefs.reduceMotion);
  document.querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", getComputedStyle(root).getPropertyValue("--surface").trim());
}

const solved = new Set(read(SOLVED_KEY, []));
export const isSolved = (puzzleId) => solved.has(puzzleId);
export function markSolved(puzzleId) {
  solved.add(puzzleId);
  write(SOLVED_KEY, [...solved]);
}
