import { create } from "zustand";
import type { EquipSlotKey } from "./game";

// Shared event bus: DOM effects (anime.js) and 3D effects (useFrame) subscribe to
// the same events so they stay in sync. See docs/DESIGN.md §7.

export type GameEvent =
  | { type: "boot" }
  | { type: "stat-saved"; key: string; delta: number }
  | { type: "equip"; slot: EquipSlotKey }
  | { type: "tier-change" }
  | { type: "class-change" }
  | { type: "sealed"; key: string };

const EPIC: GameEvent["type"][] = ["boot", "tier-change", "class-change"];

type EventState = {
  last: (GameEvent & { id: number }) | null;
  epicRunning: boolean;
  hoveredSlot: EquipSlotKey | null;
  emit: (e: GameEvent) => void;
  endEpic: () => void;
  hoverSlot: (slot: EquipSlotKey | null) => void;
};

let seq = 0;

export const useGameEvents = create<EventState>((set, get) => ({
  last: null,
  epicRunning: false,
  hoveredSlot: null,
  emit: (e) => {
    const epic = EPIC.includes(e.type);
    // Only one epic effect at a time.
    if (epic && get().epicRunning) return;
    set({ last: { ...e, id: ++seq }, epicRunning: epic || get().epicRunning });
  },
  endEpic: () => set({ epicRunning: false }),
  hoverSlot: (slot) => set({ hoveredSlot: slot }),
}));
