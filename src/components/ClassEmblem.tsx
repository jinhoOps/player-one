"use client";

import { animate } from "animejs";
import { useRef } from "react";
import { CLASSES, type ClassKey } from "@/lib/game";
import { useGameEvent } from "@/lib/events";
import { MOTION, prefersReducedMotion } from "@/lib/motion";
import s from "./ui.module.css";

// One line glyph per class, drawn on a 24px grid inside a hexagon frame.
const GLYPHS: Record<ClassKey, string> = {
  warrior: "M12 5v11M9 13h6M12 16v3", // sword
  mage: "M12 5l1.6 4.4L18 11l-4.4 1.6L12 17l-1.6-4.4L6 11l4.4-1.6Z", // spark
  tank: "M12 5l6 2v5c0 3.5-2.6 5.9-6 7-3.4-1.1-6-3.5-6-7V7Z", // shield
  healer: "M10 6h4v4h4v4h-4v4h-4v-4H6v-4h4Z", // cross
  ranger: "M8 6c5 2 5 10 0 12M8 6v12M8 12h10M15 9l3 3-3 3", // bow + arrow
  merchant: "M12 6a6 6 0 1 0 0 12 6 6 0 0 0 0-12ZM12 9v6M10 10.5h3a1.5 1.5 0 0 1 0 3h-2", // coin
  bard: "M10 17a2 2 0 1 1-2-2 2 2 0 0 1 2 2ZM10 17V7l7-1.5v9M17 14.5a2 2 0 1 1-2-2 2 2 0 0 1 2 2Z", // notes
};

/** Class emblem; spins when the class changes (docs/DESIGN.md §7). */
export function ClassEmblem({ classKey, size = 28 }: { classKey: ClassKey; size?: number }) {
  const ref = useRef<SVGSVGElement>(null);
  useGameEvent((e) => {
    if (e.type !== "class-change" || !ref.current) return;
    if (prefersReducedMotion()) animate(ref.current, { opacity: [0, 1], ...MOTION.base });
    else animate(ref.current, { rotate: [0, 360], scale: [0.6, 1], ...MOTION.epic });
  });
  return (
    <svg
      ref={ref}
      className={s.emblem}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.25"
      strokeLinejoin="round"
      role="img"
      aria-label={CLASSES[classKey].name}
    >
      <path d="M12 1.5 21.1 6.75v10.5L12 22.5l-9.1-5.25V6.75Z" opacity="0.35" />
      <path d={GLYPHS[classKey]} />
    </svg>
  );
}
