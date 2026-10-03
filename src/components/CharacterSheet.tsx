"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState, type KeyboardEvent, type MouseEvent, type ReactNode } from "react";
import { bootOnce } from "@/lib/events";
import { CLASSES, EQUIP_SLOTS, SLOT_LABELS, type ClassKey, type EquipSlotKey } from "@/lib/game";
import type { BodyMorph } from "@/lib/morph";
import type { Profile, ProfilePatch } from "@/lib/profile";
import { ClassEmblem } from "./ClassEmblem";
import { EffectLayer } from "./EffectLayer";
import { EquipPopover } from "./EquipPopover";
import { EquipSlot } from "./EquipSlot";
import { Card } from "./Card";
import { ClassForm, EquipForm, StatsForm } from "./PanelForms";
import { SealedValue } from "./SealedValue";
import { SlotIcon } from "./SlotIcon";
import { StatRow } from "./StatRow";
import { TierBadge } from "./TierBadge";
import s from "./sheet.module.css";

const CharacterViewport = dynamic(() => import("./CharacterViewport"), { ssr: false });

/** Display model shared by /me (owner) and /p (public). Missing values render as "—" or sealed. */
export type SheetData = {
  nickname?: string | null;
  title?: string | null;
  level?: number | null;
  classKey?: ClassKey | null;
  jobTitle?: string | null;
  stats: {
    height_cm?: number | null;
    weight_kg?: number | null;
    skeletal_muscle_kg?: number | null;
    body_fat_pct?: number | null;
  };
  equipment: Record<EquipSlotKey, { equipped: boolean; detail?: string | null }>;
  wealthTier?: number | null;
  morph: BodyMorph;
};

type StatKey = keyof SheetData["stats"];

// Mobile: the panels below the character become tabs (docs/DESIGN.md §4).
const TABS = { stats: "스탯", equip: "장비", class: "클래스·자산" } as const;
type Tab = keyof typeof TABS;

// Gauge ranges are typical spans.
const STAT_ROWS: { key: StatKey; label: string; unit: string; range: [number, number] }[] = [
  { key: "height_cm", label: "키", unit: "cm", range: [140, 200] },
  { key: "weight_kg", label: "몸무게", unit: "kg", range: [40, 120] },
  { key: "skeletal_muscle_kg", label: "골격근량", unit: "kg", range: [15, 50] },
  { key: "body_fat_pct", label: "체지방률", unit: "%", range: [5, 40] },
];

type Panel = "stats" | "equip" | "class";

export function CharacterSheet({
  data,
  owner,
  sealed = {},
  trailing,
  identityActions,
  banner,
  footer,
}: {
  data: SheetData;
  /** Owner view: edit stats in place and equipment through slot popovers. */
  owner?: { profile: Profile; save: (patch: ProfilePatch) => Promise<void> };
  /** Owner view: dim/blur fields that are private so the owner sees what is sealed. */
  sealed?: Partial<Record<string, boolean>>;
  /** Owner view: per-field slot for a VisibilityToggle. */
  trailing?: (field: string) => ReactNode;
  /** Buttons beside the name (owner: edit profile, preview). */
  identityActions?: ReactNode;
  /** Owner view: a prompt right under the name card (e.g. HandleClaim). */
  banner?: ReactNode;
  footer?: ReactNode;
}) {
  const [openSlot, setOpenSlot] = useState<EquipSlotKey | null>(null);
  const [tab, setTab] = useState<Tab>("stats");
  // Owner view: which card is open as a form, and the field to focus in it.
  const [edit, setEdit] = useState<{ panel: Panel; focus?: string } | null>(null);
  const close = () => setEdit(null);
  const editButton = (panel: Panel) =>
    owner && edit?.panel !== panel ? (
      <button type="button" className={s.editButton} onClick={() => setEdit({ panel })}>
        <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
          <path d="M10.5 2.5l3 3L5 14H2v-3z" />
        </svg>
        입력
      </button>
    ) : null;
  // Owner view: tapping a tile opens its card form on that field. The lock chip keeps its own click.
  const tap = (panel: Panel, focus: string) =>
    owner
      ? {
          role: "button",
          tabIndex: 0,
          onClick: (e: MouseEvent) => !(e.target as Element).closest("[aria-pressed]") && setEdit({ panel, focus }),
          onKeyDown: (e: KeyboardEvent) =>
            e.target === e.currentTarget && (e.key === "Enter" || e.key === " ") && (e.preventDefault(), setEdit({ panel, focus })),
        }
      : {};
  const cls = data.classKey ? CLASSES[data.classKey] : null;

  useEffect(() => {
    bootOnce();
  }, []);

  // Mobile: as the panels scroll up, the pinned stage shrinks from 52vh to 28vh
  // so the character stays in view (docs/DESIGN.md §4).
  const sheet = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 900px)");
    let frame = 0;
    const update = () => {
      frame = 0;
      const vh = window.innerHeight / 100;
      const h = mq.matches ? Math.max(28 * vh, 52 * vh - window.scrollY) : 0;
      sheet.current?.style.setProperty("--stage-h", mq.matches ? `${h}px` : "");
    };
    const onScroll = () => (frame ||= requestAnimationFrame(update));
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    mq.addEventListener("change", update);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      mq.removeEventListener("change", update);
    };
  }, []);

  const slot = (k: EquipSlotKey, side: "left" | "right") => (
    <div key={k} className={s.slotWrap}>
      <EquipSlot
        slot={k}
        equipped={data.equipment[k].equipped}
        expanded={openSlot === k}
        onClick={owner ? () => setOpenSlot(openSlot === k ? null : k) : undefined}
      />
      {owner && openSlot === k && (
        <EquipPopover
          slot={k}
          side={side}
          profile={owner.profile}
          onSave={owner.save}
          onClose={() => setOpenSlot(null)}
        />
      )}
    </div>
  );
  const equipped = Object.fromEntries(EQUIP_SLOTS.map((k) => [k, data.equipment[k].equipped])) as Record<
    EquipSlotKey,
    boolean
  >;

  return (
    <div ref={sheet} className={s.sheet}>
      <EffectLayer />
      <div className={s.stageWrap}>
        <div className={s.stage} data-stage>
          <CharacterViewport morph={data.morph} equipped={equipped} />
        </div>
        {/* Equipment rail: head to toe, in body order, along the stage edge. Kept
            outside the stage so its popovers aren't clipped by the rounded card. */}
        <div className={s.rail} role="group" aria-label="장비 슬롯">
          {EQUIP_SLOTS.map((k) => slot(k, "left"))}
        </div>
      </div>

      <div className={s.side} data-tab={tab}>
        <div className={s.tabs} role="tablist" aria-label="캐릭터 정보">
          {(Object.keys(TABS) as Tab[]).map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={tab === t}
              className="label"
              onClick={() => setTab(t)}
            >
              {TABS[t]}
            </button>
          ))}
        </div>
        <Card>
          <div className={s.identity}>
            <div className={s.identityText}>
              <div className={s.identityName}>
                <h1>{data.nickname || "Player One"}</h1>
                {data.level != null && <span className={`num ${s.level}`}>Lv. {data.level}</span>}
              </div>
              {data.title && <p className={s.title}>{data.title}</p>}
            </div>
            {identityActions && <div className={s.identityActions}>{identityActions}</div>}
          </div>
        </Card>
        {banner}

        <div data-panel="stats">
          <Card title="기본 스탯" action={editButton("stats")}>
            {owner && edit?.panel === "stats" ? (
              <StatsForm profile={owner.profile} onSave={owner.save} onClose={close} focus={edit.focus} />
            ) : (
            <div className={s.grid}>
              {STAT_ROWS.map((r) => (
                <StatRow
                  key={r.key}
                  label={r.label}
                  unit={r.unit}
                  value={data.stats[r.key]}
                  range={r.range}
                  sealed={sealed[r.key]}
                  trailing={trailing?.(r.key)}
                  onEdit={owner ? () => setEdit({ panel: "stats", focus: r.key }) : undefined}
                />
              ))}
            </div>
            )}
          </Card>
        </div>

        <div data-panel="equip">
          <Card title="장비" action={editButton("equip")}>
            {owner && edit?.panel === "equip" ? (
              <EquipForm profile={owner.profile} onSave={owner.save} onClose={close} focus={edit.focus} />
            ) : (
            <div className={s.grid}>
              {EQUIP_SLOTS.map((k) => (
                <div key={k} className={`${s.tile} ${owner ? s.tapTile : ""}`} {...tap("equip", k)} aria-label={owner ? `${SLOT_LABELS[k]} 입력` : undefined}>
                  <span className={s.tileIcon} title={SLOT_LABELS[k]}>
                    <SlotIcon slot={k} size={18} />
                    <span className={s.srOnly}>{SLOT_LABELS[k]}</span>
                  </span>
                  {trailing?.(k)}
                  <span className={`num ${s.tileValue}`}>
                    <SealedValue sealed={sealed[k]}>
                      {data.equipment[k].detail ?? (data.equipment[k].equipped ? "장착" : "—")}
                    </SealedValue>
                  </span>
                </div>
              ))}
            </div>
            )}
          </Card>
        </div>

        <div data-panel="class">
          <Card title="클래스 · 자산" action={editButton("class")}>
            {owner && edit?.panel === "class" ? (
              <ClassForm profile={owner.profile} onSave={owner.save} onClose={close} focus={edit.focus} />
            ) : (
            <div className={s.grid}>
              <div className={`${s.tile} ${owner ? s.tapTile : ""}`} {...tap("class", "class")} aria-label={owner ? "클래스 입력" : undefined}>
                <span className="label">클래스</span>
                {trailing?.("class")}
                <span className={`${s.tileValue} ${s.classValue}`}>
                  {data.classKey && <ClassEmblem classKey={data.classKey} size={22} />}
                  <SealedValue sealed={sealed.class}>{cls ? cls.name : "—"}</SealedValue>
                </span>
              </div>
              {data.jobTitle !== undefined && (
                <div className={`${s.tile} ${owner ? s.tapTile : ""}`} {...tap("class", "job_title")} aria-label={owner ? "직업 입력" : undefined}>
                  <span className="label">직업</span>
                  {trailing?.("job_title")}
                  <span className={s.tileValue}>
                    <SealedValue sealed={sealed.job_title}>{data.jobTitle || "—"}</SealedValue>
                  </span>
                </div>
              )}
              <div className={`${s.tile} ${s.tileWide} ${owner ? s.tapTile : ""}`} {...tap("class", "wealth")} aria-label={owner ? "자산 티어 입력" : undefined}>
                <span className="label">자산 티어</span>
                {trailing?.("wealth")}
                <span className={s.tileValue}>
                  <SealedValue sealed={sealed.wealth}>
                    {data.wealthTier != null ? <TierBadge tier={data.wealthTier} /> : "—"}
                  </SealedValue>
                </span>
              </div>
            </div>
            )}
          </Card>
        </div>

        {footer}
      </div>
    </div>
  );
}
