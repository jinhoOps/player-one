"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { CLASSES, EQUIP_SLOTS, SLOT_LABELS } from "@/lib/game";
import { fetchPublicTrophies, type Trophy } from "@/lib/items";
import { fetchPublicProfile, sheetFromPublic, type PublicProfile } from "@/lib/profile";
import { ClassEmblem } from "./ClassEmblem";
import { ItemIcon } from "./ItemIcon";
import { Modal } from "./Modal";
import { SlotIcon } from "./SlotIcon";
import { TierBadge } from "./TierBadge";
import p from "./profileModal.module.css";

const STATS = [
  { key: "height_cm", label: "키", unit: "cm" },
  { key: "weight_kg", label: "몸무게", unit: "kg" },
  { key: "skeletal_muscle_kg", label: "골격근량", unit: "kg" },
  { key: "body_fat_pct", label: "체지방률", unit: "%" },
] as const;

type Loaded = { handle: string; profile: PublicProfile | null; trophies: Trophy[]; error?: string };

/**
 * A quick look at someone's public profile without leaving the page. Public
 * fields only (get_public_profile); the full sheet is one link away.
 */
export function ProfileModal({
  handle,
  name,
  onClose,
  actions,
}: {
  handle: string;
  /** Shown in the title while the profile loads. */
  name?: string;
  onClose: () => void;
  /** Extra buttons before "전체 프로필" (e.g. 말 걸기). */
  actions?: ReactNode;
}) {
  const [data, setData] = useState<Loaded | null>(null);

  useEffect(() => {
    let live = true;
    Promise.all([fetchPublicProfile(handle), fetchPublicTrophies(handle).catch(() => [])]).then(
      ([profile, trophies]) => live && setData({ handle, profile, trophies }),
      (e) => live && setData({ handle, profile: null, trophies: [], error: (e as Error).message }),
    );
    return () => {
      live = false;
    };
  }, [handle]);

  const ready = data?.handle === handle ? data : null;
  const pub = ready?.profile;
  const sheet = pub ? sheetFromPublic(pub) : null;
  const cls = sheet?.classKey ? CLASSES[sheet.classKey] : null;
  const stats = sheet ? STATS.filter((s) => sheet.stats[s.key] != null) : [];

  return (
    <Modal
      size="sm"
      onClose={onClose}
      title={
        <>
          {sheet?.classKey && <ClassEmblem classKey={sheet.classKey} size={22} />}
          {sheet?.nickname ?? name ?? handle}
        </>
      }
      actions={
        <>
          {actions}
          <Link className="btn btn-soft" href={`/p?u=${handle}`}>
            전체 프로필
          </Link>
        </>
      }
    >
      {!ready ? (
        <p className="label">불러오는 중…</p>
      ) : !pub || !sheet ? (
        <p className="label">{ready.error ?? "공개 프로필을 찾을 수 없어요"}</p>
      ) : (
        <div className={p.summary}>
          <p className={p.sub}>
            {[sheet.level != null && `Lv. ${sheet.level}`, sheet.title, `@${handle}`].filter(Boolean).join(" · ")}
          </p>

          {(cls || sheet.jobTitle || sheet.wealthTier != null) && (
            <div className={p.row}>
              {cls && (
                <span className={p.chip}>
                  {cls.name}
                  {sheet.jobTitle && <span className={p.dim}> · {sheet.jobTitle}</span>}
                </span>
              )}
              {sheet.wealthTier != null && <TierBadge tier={sheet.wealthTier} />}
            </div>
          )}

          <section>
            <h3 className="label">기본 스탯</h3>
            {stats.length ? (
              <dl className={p.stats}>
                {stats.map((s) => (
                  <div key={s.key}>
                    <dt className="label">{s.label}</dt>
                    <dd className="num">
                      {sheet.stats[s.key]}
                      <small>{s.unit}</small>
                    </dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className={p.dim}>공개한 스탯이 없어요</p>
            )}
          </section>

          <section>
            <h3 className="label">장비</h3>
            <ul className={p.gear}>
              {EQUIP_SLOTS.map((k) => {
                const e = sheet.equipment[k];
                return (
                  <li key={k} data-on={e.equipped || undefined} title={SLOT_LABELS[k]}>
                    <SlotIcon slot={k} size={18} />
                    <span>{e.detail ?? (e.equipped ? "장착" : "—")}</span>
                  </li>
                );
              })}
            </ul>
          </section>

          {ready.trophies.length > 0 && (
            <section>
              <h3 className="label">진열장</h3>
              <ul className={p.trophies}>
                {ready.trophies.map((t, i) => (
                  <li key={i} title={[t.brand, t.name, t.since].filter(Boolean).join(" · ")}>
                    <ItemIcon kind={t.category} size={18} />
                    <span>{t.name}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </Modal>
  );
}
