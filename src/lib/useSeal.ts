"use client";

import { animate } from "animejs";
import { useEffect, useRef, type RefObject } from "react";
import { prefersReducedMotion } from "./motion";

/**
 * Seal effect (docs/BRAND.md, Effects): when a value turns private it gives a
 * little squish, as if tucked away. Only a visitor sees it frosted (the `sealed`
 * CSS class); the owner keeps reading it beside the lock chip.
 */
export function useSeal(ref: RefObject<HTMLElement | null>, sealed: boolean | undefined) {
  const prev = useRef(sealed);
  useEffect(() => {
    const was = prev.current;
    prev.current = sealed;
    const el = ref.current;
    if (!el || !sealed || was !== false || prefersReducedMotion()) return;
    animate(el, { scaleX: [1, 1.12, 0.94, 1], scaleY: [1, 0.82, 1.06, 1], duration: 360, ease: "outQuad" });
  }, [ref, sealed]);
}
