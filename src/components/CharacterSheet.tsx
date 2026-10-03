"use client";

import dynamic from "next/dynamic";
import type { ReactNode } from "react";
import { CLASSES, type ClassKey, type EquipSlotKey } from "@/lib/game";
import type { BodyMorph } from "@/lib/morph";
import { EquipSlot } from "./EquipSlot";
import { HudPanel } from "./HudPanel";
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

const STAT_ROWS: { key: StatKey; label: string; unit: string; range: [number, number] }[] = [
  { key: "height_cm", label: "Height", unit: "cm", range: [140, 200] },
  { key: "weight_kg", label: "Weight", unit: "kg", range: [40, 120] },
  { key: "skeletal_muscle_kg", label: "Skeletal Muscle", unit: "kg", range: [15, 50] },
  { key: "body_fat_pct", label: "Body Fat", unit: "%", range: [5, 40] },
];

export function CharacterSheet({
  data,
  sealed = {},
  trailing,
  footer,
}: {
  data: SheetData;
  /** Owner view: dim/blur fields that are private so the owner sees what is sealed. */
  sealed?: Partial<Record<string, boolean>>;
  /** Owner view: per-field slot for a VisibilityToggle. */
  trailing?: (field: string) => ReactNode;
  footer?: ReactNode;
}) {
  const cls = data.classKey ? CLASSES[data.classKey] : null;
  const slot = (k: EquipSlotKey) => <EquipSlot slot={k} equipped={data.equipment[k].equipped} />;

  return (
    <div className={s.sheet}>
      <div className={s.slotsLeft}>
        {slot("head")}
        {slot("top")}
      </div>
      <div className={s.stage}>
        <CharacterViewport morph={data.morph} />
      </div>
      <div className={s.slotsRight}>
        {slot("bottom")}
        {slot("shoes")}
      </div>

      <div className={s.side}>
        <HudPanel label="Character">
          <div className={s.identity}>
            <h1>{data.nickname || "Player One"}</h1>
            {data.title && <p className={s.title}>{data.title}</p>}
            {data.level != null && <p className={`num ${s.level}`}>Lv. {data.level}</p>}
          </div>
        </HudPanel>

        <HudPanel label="Base Stats">
          {STAT_ROWS.map((r) => (
            <StatRow
              key={r.key}
              label={r.label}
              unit={r.unit}
              value={data.stats[r.key]}
              range={r.range}
              sealed={sealed[r.key]}
              trailing={trailing?.(r.key)}
            />
          ))}
        </HudPanel>

        <HudPanel label="Equipment">
          {(Object.keys(data.equipment) as EquipSlotKey[]).map((k) => (
            <div key={k} className={s.kv}>
              <span className="label">{k}</span>
              <span className="num">
                {data.equipment[k].detail ?? (data.equipment[k].equipped ? "■" : "—")} {trailing?.(k)}
              </span>
            </div>
          ))}
        </HudPanel>

        <HudPanel label="Class · Wealth">
          <div className={s.kv}>
            <span className="label">Class</span>
            <span>
              {cls ? cls.name : "—"} {trailing?.("class")}
            </span>
          </div>
          {data.jobTitle !== undefined && (
            <div className={s.kv}>
              <span className="label">Subclass</span>
              <span>
                {data.jobTitle || "—"} {trailing?.("job_title")}
              </span>
            </div>
          )}
          <div className={s.kv}>
            <span className="label">Tier</span>
            <span>
              {data.wealthTier != null ? <TierBadge tier={data.wealthTier} /> : "—"} {trailing?.("wealth")}
            </span>
          </div>
        </HudPanel>

        {footer}
      </div>
    </div>
  );
}
