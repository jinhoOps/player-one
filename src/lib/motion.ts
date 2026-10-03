import { animate } from "animejs";
import { useMemo, useRef } from "react";

// Motion tokens (docs/BRAND.md, Motion): things settle with a soft overshoot,
// like a toy set down on a table.
export const MOTION = {
  instant: { duration: 120, ease: "outQuad" },
  quick: { duration: 240, ease: "outQuart" },
  base: { duration: 480, ease: "outQuart" },
  pop: { duration: 520, ease: "outBack(1.6)" },
  epic: { duration: 1400, ease: "outElastic(1, .55)" },
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

/** Start time of a one-shot effect; progress() is 0→1 while it runs, ≥1 after. */
export function useOneShot() {
  const start = useRef(-Infinity);
  return useMemo(
    () => ({
      fire: (delay = 0) => (start.current = performance.now() + delay),
      finish: () => (start.current = -Infinity),
      progress: (ms: number) => (performance.now() - start.current) / ms,
    }),
    [],
  );
}
