"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { SLOT_LABELS, type EquipSlotKey } from "@/lib/game";
import type { Profile, ProfilePatch } from "@/lib/profile";
import { Card } from "./Card";
import { readGear, readSlot, SLOT_FIELDS, SlotFields } from "./EquipFields";
import s from "./ui.module.css";

/** Size editor for one equipment slot (docs/DESIGN.md §6 EquipSlot: click → popover). */
export function EquipPopover({
  slot,
  profile,
  side,
  onSave,
  onClose,
}: {
  slot: EquipSlotKey;
  profile: Profile;
  side: "left" | "right";
  onSave: (patch: ProfilePatch) => Promise<void>;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  // Esc or a click outside closes it.
  useEffect(() => {
    const key = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    const down = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!root.current?.contains(t) && !(t as Element).closest?.(`[data-slot="${slot}"]`)) onClose();
    };
    window.addEventListener("keydown", key);
    window.addEventListener("pointerdown", down);
    return () => {
      window.removeEventListener("keydown", key);
      window.removeEventListener("pointerdown", down);
    };
  }, [onClose, slot]);

  async function save(patch: ProfilePatch) {
    setBusy(true);
    try {
      await onSave(patch);
      onClose();
    } finally {
      setBusy(false);
    }
  }

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    save({ ...readSlot(fd, slot), ...readGear(fd, [slot], profile) });
  }

  return (
    <div ref={root} className={`${s.popover} ${side === "left" ? s.popoverLeft : s.popoverRight}`} role="dialog" aria-label={`${SLOT_LABELS[slot]} 사이즈`}>
      <Card title={`${SLOT_LABELS[slot]} 사이즈`}>
        <form className={s.form} onSubmit={submit}>
          <SlotFields slot={slot} profile={profile} autoFocus />
          <div className={s.formActions}>
            <button
              type="button"
              className="btn btn-soft"
              disabled={busy}
              onClick={() => save(Object.fromEntries(SLOT_FIELDS[slot].map((f) => [f.key, null])) as ProfilePatch)}
            >
              해제
            </button>
            <button type="submit" className="btn" disabled={busy}>
              {busy ? "…" : "장착"}
            </button>
          </div>
        </form>
      </Card>
    </div>
  );
}
