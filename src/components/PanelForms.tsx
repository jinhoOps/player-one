"use client";

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { CLASSES, EQUIP_SLOTS, SLOT_LABELS, WEALTH_TIERS, type ClassKey } from "@/lib/game";
import { prefersReducedMotion } from "@/lib/motion";
import type { Profile, ProfilePatch } from "@/lib/profile";
import { ClassEmblem } from "./ClassEmblem";
import { readGear, readSlot, SlotFields, UnitInput } from "./EquipFields";
import { SlotIcon } from "./SlotIcon";
import s from "./ui.module.css";

// A card turns into one of these in place (docs/DESIGN.md §6 PanelForm): every
// field of the panel at once, Tab between them, Enter or 저장 saves, Esc cancels.

type FormProps = {
  profile: Profile;
  onSave: (patch: ProfilePatch) => Promise<void>;
  onClose: () => void;
  /** Field to focus first: the tile that was clicked. */
  focus?: string;
};

function PanelForm({
  read,
  profile,
  onSave,
  onClose,
  focus,
  children,
}: FormProps & { read: (fd: FormData) => ProfilePatch; children: ReactNode }) {
  const [busy, setBusy] = useState(false);
  const form = useRef<HTMLFormElement>(null);

  useEffect(() => {
    const controls = "input:not([type=hidden]), select, button";
    const root = form.current;
    if (!root) return;
    const hit = focus ? root.querySelector<HTMLElement>(`[name="${focus}"]:not([type=hidden]), [data-field="${focus}"]`) : null;
    const el = hit && !hit.matches(controls) ? hit.querySelector<HTMLElement>(controls) : hit;
    // Bring the whole card into view, not just the field. On mobile its top goes just
    // under the pinned stage. The stage shrinks as the page scrolls and pulls the
    // panels up by the same amount, so the stage's current height cancels out.
    (el ?? root.querySelector<HTMLElement>(controls))?.focus({ preventScroll: true });
    const behavior = prefersReducedMotion() ? "auto" : "smooth";
    const card = root.closest("section") ?? root;
    const wrap = document.querySelector<HTMLElement>("[data-stage]")?.parentElement;
    if (wrap && window.matchMedia("(max-width: 900px)").matches) {
      const top = window.scrollY + card.getBoundingClientRect().top - wrap.getBoundingClientRect().height - 64 - 8;
      window.scrollTo({ top: Math.max(0, top), behavior });
    } else {
      card.scrollIntoView({ block: "nearest", behavior });
    }
  }, [focus]);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const next = read(new FormData(e.currentTarget));
    // Only send what changed, so each change fires exactly its own effect.
    const patch = Object.fromEntries(
      Object.entries(next).filter(([k, v]) => (profile[k as keyof Profile] ?? null) !== v),
    ) as ProfilePatch;
    if (Object.keys(patch).length === 0) return onClose();
    setBusy(true);
    try {
      await onSave(patch);
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      ref={form}
      className={s.form}
      onSubmit={submit}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          onClose();
        }
      }}
    >
      {children}
      <div className={s.formActions}>
        <button type="button" className="btn btn-soft" onClick={onClose} disabled={busy}>
          취소
        </button>
        <button type="submit" className="btn" disabled={busy}>
          {busy ? "저장 중…" : "저장"}
        </button>
      </div>
    </form>
  );
}

export const STAT_FIELDS = [
  { key: "height_cm", label: "키", unit: "cm", limits: [50, 250], placeholder: "170" },
  { key: "weight_kg", label: "몸무게", unit: "kg", limits: [20, 300], placeholder: "65" },
  { key: "skeletal_muscle_kg", label: "골격근량", unit: "kg", limits: [5, 100], placeholder: "28" },
  { key: "body_fat_pct", label: "체지방률", unit: "%", limits: [1, 70], placeholder: "22" },
] as const;

export function StatsForm(props: FormProps) {
  const read = (fd: FormData) =>
    Object.fromEntries(
      STAT_FIELDS.map(({ key }) => {
        const raw = String(fd.get(key) ?? "").trim();
        return [key, raw === "" ? null : Number(raw)];
      }),
    ) as ProfilePatch;
  return (
    <PanelForm {...props} read={read}>
      {STAT_FIELDS.map((f) => (
        <label key={f.key} className={s.formRow}>
          <span className="label">{f.label}</span>
          <UnitInput
            name={f.key}
            label={f.label}
            unit={f.unit}
            step={0.1}
            min={f.limits[0]}
            max={f.limits[1]}
            placeholder={`예: ${f.placeholder}`}
            defaultValue={props.profile[f.key]}
          />
        </label>
      ))}
    </PanelForm>
  );
}

export function EquipForm(props: FormProps) {
  const read = (fd: FormData) =>
    Object.assign({}, ...EQUIP_SLOTS.map((k) => readSlot(fd, k)), readGear(fd, EQUIP_SLOTS, props.profile)) as ProfilePatch;
  return (
    <PanelForm {...props} read={read}>
      {EQUIP_SLOTS.map((k) => (
        <div key={k} role="group" aria-label={SLOT_LABELS[k]} className={s.formGroup} data-field={k}>
          <span className={s.formGroupTitle}>
            <SlotIcon slot={k} size={16} />
            {SLOT_LABELS[k]}
          </span>
          <SlotFields slot={k} profile={props.profile} />
        </div>
      ))}
    </PanelForm>
  );
}

export function ClassForm(props: FormProps) {
  const [cls, setCls] = useState<ClassKey | "">(props.profile.class_key ?? "");
  const read = (fd: FormData) => {
    const tier = String(fd.get("wealth_tier") ?? "");
    const job = String(fd.get("job_title") ?? "").trim();
    return { class_key: cls || null, job_title: job || null, wealth_tier: tier === "" ? null : Number(tier) } as ProfilePatch;
  };
  return (
    <PanelForm {...props} read={read}>
      <div className={s.formRow}>
        <span className="label">클래스</span>
        <div className={s.classPick} role="radiogroup" aria-label="클래스" data-field="class">
          {(Object.keys(CLASSES) as ClassKey[]).map((k) => (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={cls === k}
              className={s.classChoice}
              title={CLASSES[k].jobs}
              onClick={() => setCls(cls === k ? "" : k)}
            >
              <ClassEmblem classKey={k} size={20} />
              <span>{CLASSES[k].name}</span>
            </button>
          ))}
        </div>
      </div>
      <p className={s.formHint}>{cls ? `${CLASSES[cls].jobs} — ${CLASSES[cls].concept}` : "직업에 가까운 클래스를 골라요"}</p>
      <label className={s.formRow}>
        <span className="label">직업명</span>
        <input name="job_title" defaultValue={props.profile.job_title ?? ""} placeholder="예: 프론트엔드 개발자" />
      </label>
      <label className={s.formRow}>
        <span className="label">자산 티어</span>
        <select name="wealth_tier" data-field="wealth" defaultValue={props.profile.wealth_tier ?? ""}>
          <option value="">—</option>
          {WEALTH_TIERS.map((t, i) => (
            <option key={i} value={i}>
              {t.label}
            </option>
          ))}
        </select>
      </label>
    </PanelForm>
  );
}
