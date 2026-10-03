import { useEffect, useRef } from "react";
import { create } from "zustand";
import type { EquipSlotKey, Rarity } from "./game";

// Shared event bus: DOM effects (anime.js) and 3D effects (useFrame) subscribe to
// the same events so they stay in sync. See docs/DESIGN.md §7.

export type GameEvent =
  | { type: "boot" }
  | { type: "stat-saved"; key: string; delta: number }
  | { type: "equip"; slot: EquipSlotKey }
  | { type: "tier-change"; rarity: Rarity }
  | { type: "class-change" }
  | { type: "sealed"; key: string };

export type FiredEvent = GameEvent & { id: number };

const EPIC: GameEvent["type"][] = ["boot", "tier-change", "class-change"];

/** Longest an effect may run (docs/DESIGN.md §7, rule 6). */
export const EFFECT_MAX_MS = 1800;

type EventState = {
  last: FiredEvent | null;
  epicRunning: boolean;
  /** Bumped when the viewer clicks through an effect; running effects jump to their end. */
  skipId: number;
  hoveredSlot: EquipSlotKey | null;
  emit: (e: GameEvent) => void;
  endEpic: () => void;
  skip: () => void;
  hoverSlot: (slot: EquipSlotKey | null) => void;
};

let seq = 0;
let epicTimer: ReturnType<typeof setTimeout> | undefined;

export const useGameEvents = create<EventState>((set, get) => ({
  last: null,
  epicRunning: false,
  skipId: 0,
  hoveredSlot: null,
  emit: (e) => {
    const epic = EPIC.includes(e.type);
    // Only one epic effect at a time; it releases the slot after the max duration.
    if (epic) {
      if (get().epicRunning) return;
      clearTimeout(epicTimer);
      epicTimer = setTimeout(() => get().endEpic(), EFFECT_MAX_MS);
    }
    set({ last: { ...e, id: ++seq }, epicRunning: epic || get().epicRunning });
  },
  endEpic: () => set({ epicRunning: false }),
  skip: () => {
    clearTimeout(epicTimer);
    set((s) => ({ skipId: s.skipId + 1, epicRunning: false }));
  },
  hoverSlot: (slot) => set({ hoveredSlot: slot }),
}));

/** Calls `handler` once per emitted event (no replay of the last one on mount). */
export function useGameEvent(handler: (e: FiredEvent) => void) {
  const ref = useRef(handler);
  useEffect(() => {
    ref.current = handler;
  });
  useEffect(
    () =>
      useGameEvents.subscribe((s, prev) => {
        if (s.last && s.last !== prev.last) ref.current(s.last);
      }),
    [],
  );
}

/** Calls `handler` whenever the viewer skips the running effects. */
export function useEffectSkip(handler: () => void) {
  const ref = useRef(handler);
  useEffect(() => {
    ref.current = handler;
  });
  useEffect(
    () =>
      useGameEvents.subscribe((s, prev) => {
        if (s.skipId !== prev.skipId) ref.current();
      }),
    [],
  );
}

// Boot plays once per app load, not on every client-side navigation.
let bootedAt: number | null = null;
export function bootOnce() {
  if (bootedAt != null) return false;
  bootedAt = performance.now();
  useGameEvents.getState().emit({ type: "boot" });
  return true;
}

/** True during the boot sequence, so panels mounting now draw their frames in. */
export function isBooting() {
  return bootedAt == null || performance.now() - bootedAt < EFFECT_MAX_MS;
}

