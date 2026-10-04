"use client";

import { useState, type FormEvent } from "react";
import { BODY_TYPES, HAIR_STYLES } from "@/lib/game";
import { formatWhen, nicknameQuota, profileErrorText, type Profile, type ProfilePatch } from "@/lib/profile";
import { Card } from "./Card";
import s from "./ui.module.css";
import x from "./items.module.css";

const HANDLE = /^[a-z0-9_]{3,20}$/;

// Identity and look. Stats, equipment and class are entered in their own
// cards (PanelForms, docs/DESIGN.md §6).
export function ProfileEditor({ profile, onSave }: { profile: Profile; onSave: (p: ProfilePatch) => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [handle, setHandle] = useState(profile.handle ?? "");
  // The clock is read once per opening; the server has the final say anyway.
  const [now] = useState(() => Date.now());
  const quota = nicknameQuota(profile, now);
  const nicknameLocked = !quota.free && quota.nextAt != null;

  const h = handle.trim().toLowerCase();
  const handleValid = h === "" || HANDLE.test(h);
  const handleMoved = profile.handle && h !== profile.handle;

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!handleValid) return;
    const fd = new FormData(e.currentTarget);
    const text = (k: string) => String(fd.get(k) ?? "").trim() || null;
    const patch: ProfilePatch = {
      handle: h || null,
      title: text("title"),
      birth_date: text("birth_date"),
      body_type: (text("body_type") as Profile["body_type"]) ?? null,
      hair_style: (text("hair_style") as Profile["hair_style"]) ?? null,
    };
    // Only send the nickname when it changed: each change counts against the weekly limit.
    const nickname = text("nickname");
    if (nickname !== profile.nickname) patch.nickname = nickname;
    setBusy(true);
    setError(null);
    try {
      await onSave(patch);
    } catch (err) {
      setError(profileErrorText(err));
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
        {options.map(([k, t]) => (
          <option key={k} value={k}>
            {t}
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <Card title="프로필 편집">
      <form onSubmit={submit} className={s.form}>
        <label className={s.formRow}>
          <span className="label">핸들</span>
          <input
            name="handle"
            value={handle}
            onChange={(e) => setHandle(e.target.value)}
            placeholder="영소문자·숫자·_ 3–20자"
            maxLength={20}
            autoComplete="off"
            aria-invalid={!handleValid}
          />
        </label>
        <p className={s.formHint}>
          {!handleValid
            ? "영소문자·숫자·_ 3–20자"
            : h === ""
              ? "비워 두면 공개 프로필이 닫혀요"
              : handleMoved
                ? `공개 주소가 /p?u=${h} 로 바뀌어요. 이전 주소(/p?u=${profile.handle})는 더 이상 열리지 않아요`
                : `공개 주소: /p?u=${h}`}
        </p>

        <label className={s.formRow}>
          <span className="label">닉네임</span>
          <input
            name="nickname"
            maxLength={24}
            defaultValue={profile.nickname ?? ""}
            readOnly={nicknameLocked}
            aria-describedby="nickname-quota"
          />
        </label>
        <p id="nickname-quota" className={s.formHint}>
          {quota.free
            ? "처음 정하는 닉네임은 횟수에 들어가지 않아요"
            : nicknameLocked
              ? `${formatWhen(quota.nextAt)} 이후에 바꿀 수 있어요`
              : `이번 주에 ${quota.left}번 더 바꿀 수 있어요 (일주일 3번, 3분 간격)`}
        </p>

        <label className={s.formRow}>
          <span className="label">칭호</span>
          <input name="title" maxLength={32} defaultValue={profile.title ?? ""} />
        </label>
        <label className={s.formRow}>
          <span className="label">생년월일</span>
          <input name="birth_date" type="date" defaultValue={profile.birth_date ?? ""} />
        </label>
        {select("body_type", "체형", profile.body_type, Object.entries(BODY_TYPES))}
        {select("hair_style", "헤어", profile.hair_style, Object.entries(HAIR_STYLES), "기본 (체형에 맞춤)")}
        {error && <p className={x.error}>{error}</p>}
        <button className={`btn ${s.formSubmit}`} type="submit" disabled={busy || !handleValid}>
          {busy ? "저장 중…" : "저장"}
        </button>
      </form>
    </Card>
  );
}
