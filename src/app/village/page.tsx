"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { TopBar } from "@/components/TopBar";
import x from "@/components/village/village.module.css";
import { kstPhase, PHASES, type Phase } from "@/lib/daylight";
import { fetchPublicProfile } from "@/lib/profile";
import { useMyProfile } from "@/lib/useMyProfile";
import { lookFromPublic, SAY_MAX, useVillage, type Look } from "@/lib/useVillage";

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
            />
            <div className={x.hud}>
              <span className={x.pill}>{PHASES[phase].label}</span>
              <span className={x.pill}>
                {status === "joining" ? "들어가는 중…" : status === "error" ? "연결이 끊겼어요" : `${others.length + 1}명 접속 중`}
              </span>
            </div>
            <p className={x.hint}>땅을 누르면 걸어가요 · 이름을 누르면 프로필</p>
            <form className={x.chat} onSubmit={send}>
              <input
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
