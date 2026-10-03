import { animate } from "animejs";

// Motion tokens (docs/DESIGN.md §5).
export const MOTION = {
  instant: { duration: 120, ease: "outQuad" },
  quick: { duration: 240, ease: "outExpo" },
  base: { duration: 480, ease: "outExpo" },
  epic: { duration: 1500, ease: "outElastic(1, .6)" },
} as const;

export function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function rollNumber(el: HTMLElement, from: number, to: number, digits = 1) {
  if (prefersReducedMotion()) {
    el.textContent = to.toFixed(digits);
    return;
  }
  const obj = { v: from };
  animate(obj, {
    v: to,
    ...MOTION.base,
    onUpdate: () => {
      el.textContent = obj.v.toFixed(digits);
    },
  });
}

const GLITCH = "█▓▒░#@$%&*<>/\\";

// Seal effect for VisibilityToggle: scramble the text, then the caller blurs it.
export function scramble(el: HTMLElement, durationMs = 360) {
  const original = el.textContent ?? "";
  if (prefersReducedMotion()) return;
  const start = performance.now();
  const tick = (now: number) => {
    const t = (now - start) / durationMs;
    if (t >= 1) {
      el.textContent = original;
      return;
    }
    el.textContent = original
      .split("")
      .map((c) => (c === " " || Math.random() > t ? GLITCH[(Math.random() * GLITCH.length) | 0] : c))
      .join("");
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}
