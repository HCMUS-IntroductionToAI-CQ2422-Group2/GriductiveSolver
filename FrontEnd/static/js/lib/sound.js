// Optional synthesized sound effects (WebAudio, no files). Off by default.
import { prefs } from "../prefs.js";

let ctx = null;

function tone(freq, start, duration, type = "sine", gain = 0.07) {
  const osc = ctx.createOscillator();
  const amp = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  amp.gain.setValueAtTime(gain, ctx.currentTime + start);
  amp.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + start + duration);
  osc.connect(amp).connect(ctx.destination);
  osc.start(ctx.currentTime + start);
  osc.stop(ctx.currentTime + start + duration + 0.02);
}

const SOUNDS = {
  innocent: () => { tone(660, 0, 0.09, "triangle"); tone(990, 0.07, 0.16, "triangle"); },
  criminal: () => { tone(330, 0, 0.09, "triangle"); tone(220, 0.07, 0.2, "triangle"); },
  wrong: () => tone(130, 0, 0.18, "square", 0.05),
  clue: () => tone(1320, 0, 0.12, "sine", 0.04),
  win: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.11, 0.28, "triangle")),
};

export function play(name) {
  if (!prefs.sound) return;
  try {
    ctx ??= new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === "suspended") ctx.resume();
    SOUNDS[name]?.();
  } catch { /* audio is a nice-to-have */ }
}
