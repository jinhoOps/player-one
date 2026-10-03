"use client";

import { useState } from "react";
import type { EquipSlotKey } from "@/lib/game";
import type { Profile, ProfilePatch } from "@/lib/profile";
import s from "./ui.module.css";

type Field = {
  key: keyof Profile & keyof ProfilePatch;
  label: string;
  type: "number" | "text";
  unit?: string;
  step?: number;
  placeholder?: string;
  /** Text fields: common sizes offered as one-tap chips. */
  choices?: string[];
};

export const SLOT_FIELDS: Record<EquipSlotKey, Field[]> = {
  head: [
    { key: "head_cm", label: "머리둘레", type: "number", unit: "cm", step: 0.5, placeholder: "예: 57" },
    { key: "hat_size", label: "모자", type: "text", choices: ["S", "M", "L", "XL", "FREE"] },
  ],
  top: [{ key: "top_size", label: "사이즈", type: "text", choices: ["XS", "S", "M", "L", "XL", "2XL"] }],
  bottom: [
    { key: "waist_cm", label: "허리둘레", type: "number", unit: "cm", step: 0.5, placeholder: "예: 76" },
    { key: "bottom_size", label: "사이즈", type: "text", choices: ["26", "28", "30", "32", "34", "36"] },
  ],
  shoes: [{ key: "shoe_mm", label: "발 길이", type: "number", unit: "mm", step: 5, placeholder: "예: 260" }],
};

/** Reads one slot's fields out of a submitted form; blanks clear the field. */
export function readSlot(fd: FormData, slot: EquipSlotKey): ProfilePatch {
  const patch: Record<string, unknown> = {};
  for (const f of SLOT_FIELDS[slot]) {
    const raw = String(fd.get(f.key) ?? "").trim();
    patch[f.key] = raw === "" ? null : f.type === "number" ? Number(raw) : raw;
  }
  return patch as ProfilePatch;
}

/** Number box with its unit inside, sized for a dense label-left form. */
export function UnitInput({
  name,
  unit,
  defaultValue,
  step,
  min,
  max,
  placeholder,
  label,
  autoFocus,
}: {
  name: string;
  unit: string;
  defaultValue: number | null | undefined;
  step?: number;
  min?: number;
  max?: number;
  placeholder?: string;
  label: string;
  autoFocus?: boolean;
}) {
  return (
    <span className={s.unitInput}>
      <input
        name={name}
        type="number"
        inputMode="decimal"
        className="num"
        aria-label={`${label} (${unit})`}
        step={step}
        min={min}
        max={max}
        placeholder={placeholder}
        defaultValue={defaultValue ?? ""}
        autoFocus={autoFocus}
        onFocus={(e) => e.currentTarget.select()}
      />
      <span className={s.unit}>{unit}</span>
    </span>
  );
}

/** One-tap size chips plus a small box for anything else. Tapping the picked chip clears it. */
export function ChoiceChips({
  name,
  label,
  choices,
  defaultValue,
}: {
  name: string;
  label: string;
  choices: string[];
  defaultValue: string | null | undefined;
}) {
  const [value, setValue] = useState(defaultValue ?? "");
  const custom = value !== "" && !choices.includes(value);
  return (
    <span className={s.chips} role="group" aria-label={label}>
      <input type="hidden" name={name} value={value} />
      {choices.map((c) => (
        <button
          key={c}
          type="button"
          className={s.chip}
          aria-pressed={value === c}
          onClick={() => setValue(value === c ? "" : c)}
        >
          {c}
        </button>
      ))}
      <input
        className={`${s.chipOther} ${custom ? s.chipOtherOn : ""}`}
        aria-label={`${label} 직접 입력`}
        placeholder="직접"
        value={custom ? value : ""}
        onChange={(e) => setValue(e.target.value)}
      />
    </span>
  );
}

/** The fields of one slot, as label-left rows of a `.form` grid. */
export function SlotFields({ slot, profile, autoFocus }: { slot: EquipSlotKey; profile: Profile; autoFocus?: boolean }) {
  // Chip rows are not <label>s: a label would forward clicks on its text to the first chip.
  return SLOT_FIELDS[slot].map((f, i) =>
    f.choices ? (
      <div key={f.key} className={s.formRow}>
        <span className="label">{f.label}</span>
        <ChoiceChips name={f.key} label={f.label} choices={f.choices} defaultValue={profile[f.key] as string | null} />
      </div>
    ) : (
      <label key={f.key} className={s.formRow}>
        <span className="label">{f.label}</span>
        <UnitInput
          name={f.key}
          label={f.label}
          unit={f.unit ?? ""}
          step={f.step}
          placeholder={f.placeholder}
          defaultValue={profile[f.key] as number | null}
          autoFocus={autoFocus && i === 0}
        />
      </label>
    ),
  );
}
