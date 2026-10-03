"use client";

import { animate, stagger, utils, type JSAnimation } from "animejs";
import { useLayoutEffect, useRef, type ReactNode } from "react";
import { isBooting, useEffectSkip } from "@/lib/events";
import { MOTION, prefersReducedMotion } from "@/lib/motion";
import s from "./ui.module.css";

// Entry (docs/BRAND.md, Motion): the card pops up with a little overshoot and
// its contents follow. During boot the cards cascade down the column.
export function Card({
  title,
  action,
  children,
  className,
}: {
  title?: string;
  /** Small control at the right of the title row (e.g. the panel edit button). */
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const root = useRef<HTMLElement>(null);
  const running = useRef<JSAnimation[]>([]);

  useLayoutEffect(() => {
    const el = root.current;
    if (!el) return;
    const content = el.children;
    if (prefersReducedMotion()) {
      running.current = [animate(el, { opacity: [0, 1], ...MOTION.quick })];
      return;
    }
    // Cascade by position in the column during boot.
    const order = el.parentElement ? Array.prototype.indexOf.call(el.parentElement.children, el) : 0;
    const start = isBooting() ? 160 + order * 80 : 0;
    // Hide before first paint; delayed animations don't apply their start values yet.
    utils.set(el, { opacity: 0 });
    utils.set(content, { opacity: 0 });
    const anims = [
      animate(el, { opacity: [0, 1], y: [14, 0], scale: [0.97, 1], ...MOTION.pop, delay: start }),
      animate(content, { opacity: [0, 1], y: [6, 0], ...MOTION.quick, delay: stagger(40, { start: start + 120 }) }),
    ];
    running.current = anims;
    return () => anims.forEach((a) => a.revert());
  }, []);

  useEffectSkip(() => running.current.forEach((a) => a.complete()));

  return (
    <section ref={root} className={`${s.card} ${className ?? ""}`}>
      {(title || action) && (
        <div className={s.cardHead}>
          {title && <h2 className={s.cardTitle}>{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}
