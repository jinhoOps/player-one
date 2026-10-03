"use client";

import type { CSSProperties } from "react";
import { SLOT_LABELS, type EquipSlotKey, type Rarity } from "@/lib/game";
import { useGameEvents } from "@/lib/events";
import { SlotIcon } from "./SlotIcon";
import s from "./ui.module.css";

/** Icon-only slot tile on the stage rail; its name shows as a tooltip on hover or focus. */
export function EquipSlot({
  slot,
  equipped,
  rarity = "common",
  onClick,
  expanded,
}: {
  slot: EquipSlotKey;
  equipped: boolean;
  rarity?: Rarity;
  onClick?: () => void;
  expanded?: boolean;
}) {
  const hoverSlot = useGameEvents((st) => st.hoverSlot);
  return (
    <button
      type="button"
      data-slot={slot}
      data-tip={SLOT_LABELS[slot]}
      className={s.slot}
      data-equipped={equipped}
      style={{ "--slot-rarity": `var(--rarity-${rarity})` } as CSSProperties}
      onMouseEnter={() => hoverSlot(slot)}
      onMouseLeave={() => hoverSlot(null)}
      onFocus={() => hoverSlot(slot)}
      onBlur={() => hoverSlot(null)}
      onClick={onClick}
      aria-expanded={onClick ? expanded : undefined}
      aria-label={`${SLOT_LABELS[slot]} ${equipped ? "장착됨" : "비어 있음"}${onClick ? " — 사이즈 편집" : ""}`}
    >
      <SlotIcon slot={slot} className={s.slotIcon} />
    </button>
  );
}
