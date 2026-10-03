"use client";

import { useEffect, useState, type FormEvent } from "react";
import { fetchPublicProfile } from "@/lib/profile";
import { useSession } from "@/lib/useSession";
import { Card } from "./Card";
import s from "./ui.module.css";
import x from "./items.module.css";

const HANDLE = /^[a-z0-9_]{3,20}$/;

/** The account id (email local part) shaped into a valid handle. */
function fromEmail(email: string | undefined) {
  const base = (email?.split("@")[0] ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 20);
  return base.length >= 3 ? base : base ? `${base}_p1` : "";
}

/** First of base, base_2, base_3… that nobody has. */
async function firstFree(base: string) {
  for (let n = 1; n <= 9; n++) {
    const h = n === 1 ? base : `${base.slice(0, 18)}_${n}`;
    if (!(await fetchPublicProfile(h).catch(() => null))) return h;
  }
  return base;
}

/**
 * Owner view, no handle yet: offer the account id as the handle. Nothing goes
 * public until the owner confirms, because a Google account id is the email
 * address (docs/DESIGN.md §2 핸들).
 */
export function HandleClaim({ onSave }: { onSave: (handle: string) => Promise<void> }) {
  const email = useSession()?.user.email;
  const [value, setValue] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [later, setLater] = useState(false);
  const accountId = fromEmail(email);

  useEffect(() => {
    if (accountId) firstFree(accountId).then((h) => setValue((v) => v ?? h));
  }, [accountId]);

  if (later) return null;
  const handle = (value ?? "").trim().toLowerCase();
  const valid = HANDLE.test(handle);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!valid) return;
    setBusy(true);
    setError(null);
    try {
      await onSave(handle);
    } catch (err) {
      const msg = (err as Error).message;
      setError(/duplicate|unique/i.test(msg) ? "이미 누가 쓰고 있어요. 다른 이름으로 해 봐요" : msg);
      setBusy(false);
    }
  }

  return (
    <Card title="공개 주소 정하기">
      <form className={s.form} onSubmit={submit}>
        <label className={s.formRow}>
          <span className="label">핸들</span>
          <span className={x.withNote}>
            <input
              name="handle"
              value={value ?? ""}
              onChange={(e) => setValue(e.target.value)}
              placeholder="영소문자·숫자·_ 3–20자"
              maxLength={20}
              autoComplete="off"
              aria-invalid={value !== null && !valid}
            />
          </span>
        </label>
        <p className={s.formHint}>
          {valid ? `/p?u=${handle} 로 공개 프로필이 생겨요` : "영소문자·숫자·_ 3–20자"}
          {valid && handle.startsWith(accountId) && accountId && (
            <>
              <br />
              계정 아이디라서 이메일 주소를 짐작할 수 있어요. 바꿔도 돼요
            </>
          )}
        </p>
        {error && <p className={x.error}>{error}</p>}
        <div className={s.formActions}>
          <button type="button" className="btn btn-soft" onClick={() => setLater(true)} disabled={busy}>
            나중에
          </button>
          <button type="submit" className="btn" disabled={busy || !valid}>
            {busy ? "저장 중…" : "이 주소로 공개"}
          </button>
        </div>
      </form>
    </Card>
  );
}
