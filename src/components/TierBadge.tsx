"use client";

import { animate } from "animejs";
import { useRef, type CSSProperties } from "react";
import { WEALTH_TIERS } from "@/lib/game";
import { useGameEvent } from "@/lib/events";
import { MOTION, prefersReducedMotion } from "@/lib/motion";
import s from "./ui.module.css";

export function TierBadge({ tier }: { tier: number }) {
  const gem = useRef<SVGSVGElement>(null);
  useGameEvent((e) => {
    if (e.type !== "tier-change" || !gem.current) return;
    if (prefersReducedMotion()) animate(gem.current, { opacity: [0, 1], ...MOTION.base });
    else animate(gem.current, { rotate: [0, 360], scale: [0.4, 1], ...MOTION.epic });
  });
  const t = WEALTH_TIERS[tier];
  if (!t) return null;
  return (
    <span className={s.tier} style={{ "--tier-color": `var(--rarity-${t.rarity})` } as CSSProperties}>
      <svg ref={gem} width="12" height="12" viewBox="0 0 12 12" aria-hidden>
        <path d="M6 0 12 6 6 12 0 6Z" fill="currentColor" />
      </svg>
      <span className="label" style={{ color: "inherit" }}>
        {t.rarity}
      </span>
      <span>{t.label}</span>
    </span>
  );
}
