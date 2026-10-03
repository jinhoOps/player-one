"use client";

import { useState, type FormEvent } from "react";
import { BODY_TYPES, HAIR_STYLES } from "@/lib/game";
import type { Profile, ProfilePatch } from "@/lib/profile";
import { Card } from "./Card";
import s from "./ui.module.css";

type FieldDef = {
  key: keyof ProfilePatch;
  label: string;
  type: "text" | "number" | "date";
  step?: number;
  hint?: string;
};

const FIELDS: FieldDef[] = [
  { key: "handle", label: "핸들", type: "text", hint: "영소문자·숫자·_ 3–20자" },
  { key: "nickname", label: "닉네임", type: "text" },
  { key: "title", label: "칭호", type: "text" },
  { key: "birth_date", label: "생년월일", type: "date" },
];

// Identity and look. Stats, equipment and class are entered in their own
// cards (PanelForms, docs/DESIGN.md §6).
export function ProfileEditor({ profile, onSave }: { profile: Profile; onSave: (p: ProfilePatch) => Promise<void> }) {
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const patch: Record<string, unknown> = {};
    for (const f of FIELDS) {
      const raw = String(fd.get(f.key) ?? "").trim();
      patch[f.key] =
        raw === "" ? null : f.type === "number" ? Number(raw) : f.key === "handle" ? raw.toLowerCase() : raw;
    }
    const body = String(fd.get("body_type") ?? "");
    patch.body_type = body || null;
    const hair = String(fd.get("hair_style") ?? "");
    patch.hair_style = hair || null;
    setBusy(true);
    try {
      await onSave(patch as ProfilePatch);
    } finally {
      setBusy(false);
    }
  }

  const select = (
    name: string,
    label: string,
    value: string | number | null,
    options: [string | number, string][],
    empty = "—",
  ) => (
    <label className={s.formRow}>
      <span className="label">{label}</span>
      <select name={name} defaultValue={value ?? ""}>
        <option value="">{empty}</option>
        {options.map(([k, text]) => (
          <option key={k} value={k}>
            {text}
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <Card title="프로필 편집">
      <form onSubmit={submit} className={s.form}>
        {FIELDS.map((f) => (
          <label key={f.key} className={s.formRow}>
            <span className="label">{f.label}</span>
            <input
              name={f.key}
              type={f.type}
              step={f.step}
              placeholder={f.hint}
              defaultValue={(profile[f.key as keyof Profile] as string | number | null) ?? ""}
              className={f.type === "number" ? "num" : undefined}
            />
          </label>
        ))}
        {select("body_type", "체형", profile.body_type, Object.entries(BODY_TYPES))}
        {select("hair_style", "헤어", profile.hair_style, Object.entries(HAIR_STYLES), "기본 (체형에 맞춤)")}
        <button className={`btn ${s.formSubmit}`} type="submit" disabled={busy}>
          {busy ? "저장 중…" : "저장"}
        </button>
      </form>
    </Card>
  );
}
