"use client";

import { useState, type FormEvent } from "react";
import { CLASSES, WEALTH_TIERS } from "@/lib/game";
import type { Profile, ProfilePatch } from "@/lib/profile";
import { HudPanel } from "./HudPanel";

type FieldDef = { key: keyof ProfilePatch; label: string; type: "text" | "number" | "date"; step?: number };

const FIELDS: FieldDef[] = [
  { key: "handle", label: "Handle (a-z, 0-9, _)", type: "text" },
  { key: "nickname", label: "Nickname", type: "text" },
  { key: "title", label: "Title", type: "text" },
  { key: "birth_date", label: "Birth date", type: "date" },
  { key: "job_title", label: "Job title", type: "text" },
  { key: "height_cm", label: "Height cm", type: "number", step: 0.1 },
  { key: "weight_kg", label: "Weight kg", type: "number", step: 0.1 },
  { key: "skeletal_muscle_kg", label: "Skeletal muscle kg", type: "number", step: 0.1 },
  { key: "body_fat_pct", label: "Body fat %", type: "number", step: 0.1 },
  { key: "head_cm", label: "Head cm", type: "number", step: 0.1 },
  { key: "hat_size", label: "Hat size", type: "text" },
  { key: "top_size", label: "Top size", type: "text" },
  { key: "waist_cm", label: "Waist cm", type: "number", step: 0.1 },
  { key: "bottom_size", label: "Bottom size", type: "text" },
  { key: "shoe_mm", label: "Shoe mm", type: "number", step: 5 },
];

// Plain form for now; inline editing + StatInput scrub come later (docs/DESIGN.md §6).
export function ProfileEditor({ profile, onSave }: { profile: Profile; onSave: (p: ProfilePatch) => Promise<void> }) {
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const patch: Record<string, unknown> = {};
    for (const f of FIELDS) {
      const raw = String(fd.get(f.key) ?? "").trim();
      patch[f.key] = raw === "" ? null : f.type === "number" ? Number(raw) : f.key === "handle" ? raw.toLowerCase() : raw;
    }
    const cls = String(fd.get("class_key") ?? "");
    patch.class_key = cls || null;
    const tier = String(fd.get("wealth_tier") ?? "");
    patch.wealth_tier = tier === "" ? null : Number(tier);
    setBusy(true);
    try {
      await onSave(patch as ProfilePatch);
    } finally {
      setBusy(false);
    }
  }

  return (
    <HudPanel label="Edit">
      <form onSubmit={submit} style={{ display: "grid", gap: 8 }}>
        {FIELDS.map((f) => (
          <label key={f.key} style={{ display: "grid", gap: 4 }}>
            <span className="label">{f.label}</span>
            <input
              name={f.key}
              type={f.type}
              step={f.step}
              defaultValue={(profile[f.key as keyof Profile] as string | number | null) ?? ""}
              className={f.type === "number" ? "num" : undefined}
            />
          </label>
        ))}
        <label style={{ display: "grid", gap: 4 }}>
          <span className="label">Class</span>
          <select name="class_key" defaultValue={profile.class_key ?? ""}>
            <option value="">—</option>
            {Object.entries(CLASSES).map(([k, c]) => (
              <option key={k} value={k}>
                {c.name} — {c.jobs}
              </option>
            ))}
          </select>
        </label>
        <label style={{ display: "grid", gap: 4 }}>
          <span className="label">Wealth tier (구간만 저장)</span>
          <select name="wealth_tier" defaultValue={profile.wealth_tier ?? ""}>
            <option value="">—</option>
            {WEALTH_TIERS.map((t, i) => (
              <option key={i} value={i}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
        <button className="btn" type="submit" disabled={busy} style={{ justifyContent: "center", marginTop: 8 }}>
          {busy ? "Saving…" : "Save"}
        </button>
      </form>
    </HudPanel>
  );
}
