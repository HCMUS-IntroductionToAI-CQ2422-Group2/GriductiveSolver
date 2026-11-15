// JS-driven motion (Web Animations API). All helpers no-op under reduced motion.

export function reducedMotion() {
  return document.documentElement.classList.contains("reduce-motion")
    || window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function anim(el, keyframes, options) {
  if (!el || reducedMotion() || !el.animate) return Promise.resolve();
  const animation = el.animate(keyframes, options);
  // Animations stall in background tabs; never let game state wait on one.
  const limit = (options.delay ?? 0) + (options.duration ?? 0) + 250;
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      if (animation.playState === "running") animation.finish();
      resolve();
    }, limit);
    animation.finished.catch(() => {}).then(() => { clearTimeout(timer); resolve(); });
  });
}

export const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export const pop = (el, scale = 1.12) => anim(el,
  [{ transform: "scale(1)" }, { transform: `scale(${scale})` }, { transform: "scale(1)" }],
  { duration: 220, easing: "ease-out" });

export const shake = (el) => anim(el,
  [0, -6, 5, -3, 2, 0].map((x) => ({ transform: `translateX(${x}px)` })),
  { duration: 320, easing: "ease-in-out" });

/** Card flip: rotate to edge-on, swap the face, rotate back. */
export async function flip(el, swap, delay = 0) {
  if (reducedMotion()) { swap(); return; }
  const p = "perspective(700px)";
  await anim(el, [{ transform: `${p} rotateY(0deg)` }, { transform: `${p} rotateY(90deg)` }],
    { duration: 210, easing: "ease-in", delay, fill: "forwards" });
  swap();
  el.getAnimations().forEach((a) => a.cancel());
  await anim(el, [{ transform: `${p} rotateY(-90deg)` }, { transform: `${p} rotateY(0deg)` }],
    { duration: 300, easing: "cubic-bezier(.2,.9,.3,1.25)" });
}

export const stampIn = (el) => anim(el,
  [{ opacity: 0, transform: "rotate(-14deg) scale(1.7)" }, { opacity: 1, transform: "rotate(-5deg) scale(1)" }],
  { duration: 280, easing: "cubic-bezier(.34,1.56,.64,1)" });

/**
 * FLIP reorder: remember where children are, let `mutate` change the DOM,
 * then animate each surviving child from its old spot to the new one.
 */
export function flipList(container, mutate) {
  if (reducedMotion()) { mutate(); return; }
  const before = new Map([...container.children].map((el) => [el, el.getBoundingClientRect().top]));
  mutate();
  for (const el of container.children) {
    const old = before.get(el);
    if (old == null) continue;
    const delta = old - el.getBoundingClientRect().top;
    if (Math.abs(delta) > 1) {
      el.animate([{ transform: `translateY(${delta}px)` }, { transform: "translateY(0)" }],
        { duration: 380, easing: "cubic-bezier(.2,.8,.2,1)" });
    }
  }
}

/** Short burst of paper confetti inside `host`. Removes itself. */
export function confetti(host, colors, count = 60) {
  if (reducedMotion()) return;
  const layer = document.createElement("div");
  layer.className = "confetti";
  layer.setAttribute("aria-hidden", "true");
  host.append(layer);
  let longest = 0;
  for (let i = 0; i < count; i++) {
    const piece = document.createElement("i");
    piece.style.background = colors[i % colors.length];
    layer.append(piece);
    const angle = Math.random() * Math.PI * 2;
    const reach = 120 + Math.random() * 260;
    const dx = Math.cos(angle) * reach;
    const dy = Math.sin(angle) * reach - 120;
    const duration = 900 + Math.random() * 600;
    longest = Math.max(longest, duration);
    piece.animate([
      { transform: "translate(0,0) rotate(0deg) scale(0.4)", opacity: 1 },
      { transform: `translate(${dx * 0.8}px, ${dy}px) rotate(${Math.random() * 360}deg) scale(1)`, opacity: 1, offset: 0.55 },
      { transform: `translate(${dx}px, ${dy + 260}px) rotate(${Math.random() * 720}deg) scale(0.9)`, opacity: 0 },
    ], { duration, easing: "cubic-bezier(.2,.7,.4,1)", fill: "forwards" });
  }
  setTimeout(() => layer.remove(), longest + 80);
}
