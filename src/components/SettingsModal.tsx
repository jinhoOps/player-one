"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { VISIBILITY_LABELS } from "@/lib/fields";
import { VISIBILITY_KEYS, type Visibility } from "@/lib/game";
import { deleteMyAccount, profileErrorText } from "@/lib/profile";
import { signOut } from "@/lib/supabase";
import { clearMyProfile, useMyProfile } from "@/lib/useMyProfile";
import { Modal } from "./Modal";
import { VisibilityToggle } from "./VisibilityToggle";
import x from "./settings.module.css";

/**
 * Settings, over whatever page you're on (docs/DESIGN.md §6 Modal): what's
 * public, signing out, and — set apart as a danger zone — leaving for good.
 */
export function SettingsModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const { profile, error, save } = useMyProfile();

  async function leaveSession() {
    await signOut().catch(() => {});
    clearMyProfile();
    router.replace("/");
  }

  return (
    <Modal title="설정" size="lg" onClose={onClose}>
      {!profile ? (
        <p className="label">{error ?? "불러오는 중…"}</p>
      ) : (
        <div className={x.sections}>
          <section>
            <header className={x.head}>
              <h3>공개 설정</h3>
              <button
                type="button"
                className="btn btn-soft"
                onClick={() =>
                  save({ visibility: Object.fromEntries(VISIBILITY_KEYS.map((k) => [k, false])) as Visibility })
                }
              >
                전부 비공개
              </button>
            </header>
            <ul className={x.grid}>
              {VISIBILITY_KEYS.map((k) => (
                <li key={k}>
                  <span>{VISIBILITY_LABELS[k]}</span>
                  <span className={x.state}>
                    <span className="label">{profile.visibility[k] ? "공개" : "비공개"}</span>
                    <VisibilityToggle
                      field={k}
                      isPublic={profile.visibility[k]}
                      onChange={(next) => save({ visibility: { ...profile.visibility, [k]: next } })}
                    />
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <header className={x.head}>
              <h3>계정</h3>
              <button type="button" className="btn btn-soft" onClick={leaveSession}>
                로그아웃
              </button>
            </header>
          </section>

          <DangerZone handle={profile.handle} onGone={leaveSession} />
        </div>
      )}
    </Modal>
  );
}

/** Leaving for good: set apart, and confirmed by typing the handle (or "탈퇴"). */
function DangerZone({ handle, onGone }: { handle: string | null; onGone: () => void }) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const phrase = handle ?? "탈퇴";

  async function leave() {
    setBusy(true);
    setError(null);
    try {
      await deleteMyAccount();
      onGone();
    } catch (e) {
      setError(profileErrorText(e));
      setBusy(false);
    }
  }

  return (
    <section className={x.danger} aria-labelledby="danger-zone">
      <header className={x.head}>
        <h3 id="danger-zone">위험 구역</h3>
        {!open && (
          <button type="button" className={`btn ${x.dangerButton}`} onClick={() => setOpen(true)}>
            회원 탈퇴
          </button>
        )}
      </header>
      <p className={x.note}>탈퇴하면 캐릭터와 스탯, 인벤토리와 진열장, 공개 주소가 바로 지워지고 되돌릴 수 없어요.</p>
      {open && (
        <div className={x.confirm}>
          <label>
            <span className="label">
              계속하려면 <b>{phrase}</b> 를 그대로 입력해 주세요
            </span>
            <input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={phrase} autoComplete="off" autoFocus />
          </label>
          {error && <p className={x.error}>{error}</p>}
          <div className={x.actions}>
            <button
              type="button"
              className="btn btn-soft"
              disabled={busy}
              onClick={() => {
                setOpen(false);
                setTyped("");
                setError(null);
              }}
            >
              그만두기
            </button>
            <button type="button" className={`btn ${x.dangerButton}`} onClick={leave} disabled={busy || typed.trim() !== phrase}>
              {busy ? "지우는 중…" : "탈퇴하기"}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
