"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { TopBar } from "@/components/TopBar";
import x from "@/components/village/village.module.css";
import { kstPhase, PHASES, type Phase } from "@/lib/daylight";
import { fetchPublicProfile } from "@/lib/profile";
import { useMyProfile } from "@/lib/useMyProfile";
import { lookFromPublic, SAY_MAX, useVillage, type Look, type Villager } from "@/lib/useVillage";

const BookVillage = dynamic(() => import("@/components/village/BookVillage"), { ssr: false });

export default function VillagePage() {
  const { profile, error } = useMyProfile();
  const router = useRouter();
  const [look, setLook] = useState<Look | null>(null);
  const [phase, setPhase] = useState<Phase>(kstPhase);
  const [draft, setDraft] = useState("");
  const { self, others, bubbles, status, moveTo, say } = useVillage(look);

  // You walk in looking the way others see you: public fields only.
  const handle = profile?.handle;
  useEffect(() => {
    if (handle) fetchPublicProfile(handle).then((p) => p && setLook(lookFromPublic(p)));
  }, [handle]);

  // The sky follows the Korea clock.
  useEffect(() => {
    const id = setInterval(() => setPhase(kstPhase()), 60_000);
    return () => clearInterval(id);
  }, []);

  // Left click on someone: their @name goes into what you are about to say.
  const input = useRef<HTMLInputElement>(null);
  const mention = useCallback((v: Villager) => {
    const tag = `@${v.nickname}`;
    setDraft((d) => (d.includes(tag) ? d : `${d.trimEnd()} ${tag} `.trimStart()));
    input.current?.focus();
  }, []);

  // "옆으로 가기": walk to just beside them.
  const approach = useCallback(
    (v: Villager) => {
      const clamp = (n: number) => Math.min(Math.max(n, 0.02), 0.98);
      moveTo([clamp(v.at[0] + 0.03), clamp(v.at[1] + 0.02)]);
    },
    [moveTo],
  );

  function send(e: FormEvent) {
    e.preventDefault();
    say(draft);
    setDraft("");
  }

  if (!profile) {
    return (
      <main style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>
        <p className="label">{error ?? "마을로 가는 중…"}</p>
      </main>
    );
  }

  return (
    <>
      <TopBar handle={profile.handle} />
      <main className={x.page}>
        {!profile.handle ? (
          <div className={x.notice}>
            <p>마을에서는 공개 프로필로 만나요. 먼저 공개 주소(핸들)를 정해 주세요.</p>
            <Link className="btn" href="/me">
              공개 주소 정하러 가기
            </Link>
          </div>
        ) : (
          <>
            <BookVillage
              phase={phase}
              villagers={self ? [self, ...others] : others}
              selfKey={self?.key ?? null}
              bubbles={bubbles}
              onMove={moveTo}
              onOpen={(h) => router.push(`/p?u=${h}`)}
              onMention={mention}
              onApproach={approach}
            />
            <div className={x.hud}>
              <span className={x.pill}>{PHASES[phase].label}</span>
              <span className={x.pill}>
                {status === "joining" ? "들어가는 중…" : status === "error" ? "연결이 끊겼어요" : `${others.length + 1}명 접속 중`}
              </span>
            </div>
            <p className={x.hint}>우클릭 이동 · 사람 클릭 @멘션 · 사람 우클릭 메뉴 · Space 꾹 내 시점</p>
            <form className={x.chat} onSubmit={send}>
              <input
                ref={input}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                maxLength={SAY_MAX}
                placeholder="말풍선으로 인사해요"
                aria-label="말하기"
                enterKeyHint="send"
              />
              <button type="submit" className="btn" disabled={!draft.trim() || status !== "here"}>
                말하기
              </button>
            </form>
            <p className={x.credit}>
              Map: <a href="https://sketchfab.com/3d-models/medieval-fantasy-book-06d5a80a04fc4c5ab552759e9a97d91a">&quot;Medieval Fantasy Book&quot;</a> by{" "}
              <a href="https://sketchfab.com/stefan.lengyel1">Pixel</a>, characters based on{" "}
              <a href="https://sketchfab.com/3d-models/free-pack-chibi-base-mesh-rigged-fed4fb329f224f1594f631eae8d2626b">&quot;Free Pack - Chibi Base Mesh (Rigged)&quot;</a> by{" "}
              <a href="https://sketchfab.com/dunguyn">DuNguyn Studio</a>, <a href="http://creativecommons.org/licenses/by/4.0/">CC-BY-4.0</a>
            </p>
          </>
        )}
      </main>
    </>
  );
}
