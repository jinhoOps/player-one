import type { CSSProperties } from "react";
import { WEALTH_TIERS } from "@/lib/game";
import s from "./hud.module.css";

export function TierBadge({ tier }: { tier: number }) {
  const t = WEALTH_TIERS[tier];
  if (!t) return null;
  return (
    <span className={s.tier} style={{ "--tier-color": `var(--rarity-${t.rarity})` } as CSSProperties}>
      <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden>
        <path d="M6 0 12 6 6 12 0 6Z" fill="currentColor" />
      </svg>
      <span className="label" style={{ color: "inherit" }}>
        {t.rarity}
      </span>
      <span>{t.label}</span>
    </span>
  );
}
