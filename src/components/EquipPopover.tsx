"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { SLOT_LABELS, type EquipSlotKey } from "@/lib/game";
import type { Profile, ProfilePatch } from "@/lib/profile";
import { Card } from "./Card";
import s from "./ui.module.css";

type Field = { key: keyof Profile & keyof ProfilePatch; label: string; type: "number" | "text"; step?: number };

export const SLOT_FIELDS: Record<EquipSlotKey, Field[]> = {
  head: [
    { key: "head_cm", label: "머리둘레 (cm)", type: "number", step: 0.5 },
    { key: "hat_size", label: "모자 사이즈", type: "text" },
  ],
  top: [{ key: "top_size", label: "상의 사이즈", type: "text" }],
  bottom: [
    { key: "waist_cm", label: "허리둘레 (cm)", type: "number", step: 0.5 },
    { key: "bottom_size", label: "하의 사이즈", type: "text" },
  ],
  shoes: [{ key: "shoe_mm", label: "신발 (mm)", type: "number", step: 5 }],
};

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
  const fields = SLOT_FIELDS[slot];

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
    const patch: Record<string, unknown> = {};
    for (const f of fields) {
      const raw = String(fd.get(f.key) ?? "").trim();
      patch[f.key] = raw === "" ? null : f.type === "number" ? Number(raw) : raw;
    }
    save(patch as ProfilePatch);
  }

  return (
    <div ref={root} className={`${s.popover} ${side === "left" ? s.popoverLeft : s.popoverRight}`} role="dialog" aria-label={`${SLOT_LABELS[slot]} 사이즈`}>
      <Card title={`${SLOT_LABELS[slot]} 사이즈`}>
        <form className={s.popoverForm} onSubmit={submit}>
          {fields.map((f, i) => (
            <label key={f.key}>
              <span className="label">{f.label}</span>
              <input
                name={f.key}
                type={f.type}
                step={f.step}
                inputMode={f.type === "number" ? "decimal" : undefined}
                className={f.type === "number" ? "num" : undefined}
                defaultValue={(profile[f.key] as string | number | null) ?? ""}
                autoFocus={i === 0}
              />
            </label>
          ))}
          <div className={s.popoverActions}>
            <button
              type="button"
              className="btn btn-soft"
              disabled={busy}
              onClick={() => save(Object.fromEntries(fields.map((f) => [f.key, null])) as ProfilePatch)}
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
