"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import type { Resident } from "@/components/lab/BookVillage";
import { kstPhase, PHASES, type Phase } from "@/lib/daylight";
import x from "../lab.module.css";

// Village trial: not linked from the app; open /lab/village directly.
const BookVillage = dynamic(() => import("@/components/lab/BookVillage"), { ssr: false });

const ALL = { head: false, top: true, bottom: true, shoes: true };
const RESIDENTS: Resident[] = [
  { nickname: "나", classKey: "mage", say: "안녕하세요!", at: [0.46, 0.68], equipped: ALL, morph: { body: "female", hair: null, height: 0, weight: 0, muscle: 0 } },
  { nickname: "곰돌", classKey: "warrior", at: [0.55, 0.6], equipped: { ...ALL, head: true }, morph: { body: "male", hair: null, height: 0.6, weight: 0.5, muscle: 0.8 } },
  { nickname: "새벽별", classKey: "bard", at: [0.3, 0.52], equipped: ALL, morph: { body: "female", hair: "ponytail", height: -0.4, weight: -0.3, muscle: 0 } },
];

export default function VillageLabPage() {
  const [phase, setPhase] = useState<Phase>(kstPhase);
  return (
    <main className={x.page}>
      <header>
        <h1 className={x.title}>마을 시험판</h1>
        <p className={x.sub}>책 디오라마 위의 주민들. 하늘과 조명은 지금 한국 시간({PHASES[kstPhase()].label})으로 시작해요.</p>
      </header>
      <div style={{ height: "min(66vh, 620px)" }}>
        <BookVillage phase={phase} residents={RESIDENTS} />
      </div>
      <div className={x.chips}>
        {(Object.keys(PHASES) as Phase[]).map((p) => (
          <button key={p} type="button" className={x.chip} aria-pressed={phase === p} onClick={() => setPhase(p)}>
            {PHASES[p].label}
          </button>
        ))}
      </div>
      <footer className={x.credit}>
        This work is based on{" "}
        <a href="https://sketchfab.com/3d-models/medieval-fantasy-book-06d5a80a04fc4c5ab552759e9a97d91a">&quot;Medieval Fantasy Book&quot;</a> by{" "}
        <a href="https://sketchfab.com/stefan.lengyel1">Pixel</a> and{" "}
        <a href="https://sketchfab.com/3d-models/free-pack-chibi-base-mesh-rigged-fed4fb329f224f1594f631eae8d2626b">
          &quot;Free Pack - Chibi Base Mesh (Rigged)&quot;
        </a>{" "}
        by <a href="https://sketchfab.com/dunguyn">DuNguyn Studio</a>, licensed under{" "}
        <a href="http://creativecommons.org/licenses/by/4.0/">CC-BY-4.0</a>.
      </footer>
    </main>
  );
}
