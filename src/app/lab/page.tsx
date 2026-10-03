"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { BODY_TYPES, EQUIP_SLOTS, HAIR_STYLES, SLOT_LABELS, type EquipSlotKey, type HairStyle } from "@/lib/game";
import type { BodyMorph } from "@/lib/morph";
import x from "./lab.module.css";

// Trial page: today's procedural toy next to the chibi base mesh, same inputs.
// Not linked from the app; open /lab directly.
const CharacterViewport = dynamic(() => import("@/components/CharacterViewport"), { ssr: false });
const ChibiViewport = dynamic(() => import("@/components/lab/ChibiViewport"), { ssr: false });

const AXES = [
  ["height", "키"],
  ["weight", "체중(BMI)"],
  ["muscle", "근육"],
] as const;

export default function LabPage() {
  const [morph, setMorph] = useState<BodyMorph>({ body: "female", hair: null, height: 0, weight: 0, muscle: 0 });
  const [equipped, setEquipped] = useState<Record<EquipSlotKey, boolean>>({ head: false, top: true, bottom: true, shoes: true });
  const set = (patch: Partial<BodyMorph>) => setMorph((m) => ({ ...m, ...patch }));

  return (
    <main className={x.page}>
      <header className={x.head}>
        <h1 className={x.title}>캐릭터 시험판</h1>
        <p className={x.sub}>왼쪽은 지금 쓰는 절차 생성 캐릭터, 오른쪽은 치비 베이스 메쉬에 같은 재질·체형 규칙을 입힌 시험판이에요.</p>
      </header>

      <div className={x.stages}>
        <figure className={x.figure}>
          <div className={x.stage}>
            <CharacterViewport morph={morph} equipped={equipped} />
          </div>
          <figcaption>지금 · 절차 생성 SD</figcaption>
        </figure>
        <figure className={x.figure}>
          <div className={x.stage}>
            <ChibiViewport morph={morph} equipped={equipped} />
          </div>
          <figcaption>시험판 · 치비 베이스 메쉬</figcaption>
        </figure>
      </div>

      <section className={x.controls}>
        <div className={x.row}>
          <span className="label">체형</span>
          <div className={x.chips}>
            {(["female", "male", "neutral"] as const).map((b) => (
              <button key={b} type="button" className={x.chip} aria-pressed={morph.body === b} onClick={() => set({ body: b })}>
                {b === "neutral" ? "중성" : BODY_TYPES[b]}
              </button>
            ))}
          </div>
        </div>
        <div className={x.row}>
          <span className="label">헤어</span>
          <div className={x.chips}>
            <button type="button" className={x.chip} aria-pressed={morph.hair === null} onClick={() => set({ hair: null })}>
              기본
            </button>
            {(Object.keys(HAIR_STYLES) as HairStyle[]).map((h) => (
              <button key={h} type="button" className={x.chip} aria-pressed={morph.hair === h} onClick={() => set({ hair: h })}>
                {HAIR_STYLES[h]}
              </button>
            ))}
          </div>
        </div>
        {AXES.map(([k, label]) => (
          <label key={k} className={x.row}>
            <span className="label">{label}</span>
            <input
              type="range"
              min={-1}
              max={1}
              step={0.05}
              value={morph[k] ?? 0}
              onChange={(e) => set({ [k]: Number(e.target.value) })}
            />
            <span className={`num ${x.val}`}>{(morph[k] ?? 0).toFixed(2)}</span>
          </label>
        ))}
        <div className={x.row}>
          <span className="label">장비</span>
          <div className={x.chips}>
            {EQUIP_SLOTS.map((k) => (
              <button
                key={k}
                type="button"
                className={x.chip}
                aria-pressed={equipped[k]}
                onClick={() => setEquipped((e) => ({ ...e, [k]: !e[k] }))}
              >
                {SLOT_LABELS[k]}
              </button>
            ))}
          </div>
        </div>
      </section>

      <footer className={x.credit}>
        This work is based on{" "}
        <a href="https://sketchfab.com/3d-models/free-pack-chibi-base-mesh-rigged-fed4fb329f224f1594f631eae8d2626b">
          &quot;Free Pack - Chibi Base Mesh (Rigged)&quot;
        </a>{" "}
        by <a href="https://sketchfab.com/dunguyn">DuNguyn Studio</a>, licensed under{" "}
        <a href="http://creativecommons.org/licenses/by/4.0/">CC-BY-4.0</a>.
      </footer>
    </main>
  );
}
