"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { deleteMyAccount, profileErrorText } from "@/lib/profile";
import { signOut } from "@/lib/supabase";
import { Card } from "./Card";
import { Modal } from "./Modal";
import s from "./ui.module.css";
import x from "./items.module.css";

/** Leave for good: type the handle (or "탈퇴") to confirm, then everything is removed. */
export function DeleteAccount({ handle }: { handle: string | null }) {
  const router = useRouter();
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
      await signOut().catch(() => {});
      router.replace("/");
    } catch (e) {
      setError(profileErrorText(e));
      setBusy(false);
    }
  }

  const close = () => {
    if (busy) return;
    setOpen(false);
    setTyped("");
    setError(null);
  };

  return (
    <Card title="계정">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <p className={s.formHint} style={{ margin: 0 }}>
          탈퇴하면 캐릭터, 인벤토리, 공개 주소가 모두 지워지고 되돌릴 수 없어요.
        </p>
        <button type="button" className="btn btn-soft" onClick={() => setOpen(true)}>
          회원 탈퇴
        </button>
      </div>
      {open && (
        <Modal
          title="정말 떠나시나요?"
          size="sm"
          onClose={close}
          actions={
            <>
              <button type="button" className="btn btn-soft" onClick={close} disabled={busy}>
                취소
              </button>
              <button type="button" className="btn" onClick={leave} disabled={busy || typed.trim() !== phrase}>
                {busy ? "지우는 중…" : "탈퇴하기"}
              </button>
            </>
          }
        >
          <div className={s.form}>
            <p style={{ gridColumn: "1 / -1", lineHeight: 1.7 }}>
              캐릭터와 스탯, 인벤토리와 진열장, 공개 주소가 바로 지워져요. 지운 기록은 되살릴 수 없어요.
            </p>
            <label className={s.formRow}>
              <span className="label">확인</span>
              <input
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                placeholder={phrase}
                autoComplete="off"
                aria-describedby="delete-hint"
              />
            </label>
            <p id="delete-hint" className={s.formHint}>
              계속하려면 <b>{phrase}</b> 를 그대로 입력해 주세요
            </p>
            {error && <p className={x.error}>{error}</p>}
          </div>
        </Modal>
      )}
    </Card>
  );
}
