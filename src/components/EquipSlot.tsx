"use client";

import type { CSSProperties } from "react";
import { SLOT_LABELS, type EquipSlotKey, type Rarity } from "@/lib/game";
import { useGameEvents } from "@/lib/events";
import s from "./hud.module.css";

export function EquipSlot({
  slot,
  equipped,
  rarity = "common",
  onClick,
}: {
  slot: EquipSlotKey;
  equipped: boolean;
  rarity?: Rarity;
  onClick?: () => void;
}) {
  const hoverSlot = useGameEvents((st) => st.hoverSlot);
  return (
    <button
      type="button"
      className={s.slot}
      data-equipped={equipped}
      style={{ "--slot-rarity": `var(--rarity-${rarity})` } as CSSProperties}
      onMouseEnter={() => hoverSlot(slot)}
      onMouseLeave={() => hoverSlot(null)}
      onFocus={() => hoverSlot(slot)}
      onBlur={() => hoverSlot(null)}
      onClick={onClick}
      aria-label={`${SLOT_LABELS[slot]} ${equipped ? "장착됨" : "비어 있음"}`}
    >
      <span className={`label ${s.slotLabel}`}>{SLOT_LABELS[slot]}</span>
    </button>
  );
}
