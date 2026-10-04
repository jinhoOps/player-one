"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { ClassEmblem } from "@/components/ClassEmblem";
import { ProfileModal } from "@/components/ProfileModal";
import { TopBar } from "@/components/TopBar";
import x from "@/components/village/village.module.css";
import { kstPhase, PHASES, type Phase } from "@/lib/daylight";
import { fetchPublicProfile } from "@/lib/profile";
import { useMyProfile } from "@/lib/useMyProfile";
import { lookFromPublic, SAY_MAX, useVillage, type Look, type Villager } from "@/lib/useVillage";

const BookVillage = dynamic(() => import("@/components/village/BookVillage"), { ssr: false });

const NOTICE_MS = 8000;
type Notice = { id: number; from: Villager; text: string };

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/** "@name" as a whole word: "@kim" doesn't call "@kimchi". */
const calls = (text: string, name: string) => new RegExp(`@${escapeRe(name)}(?![\\p{L}\\p{N}_])`, "u").test(text);

export default function VillagePage() {
  const { profile, error } = useMyProfile();
  const [look, setLook] = useState<Look | null>(null);
  const [phase, setPhase] = useState<Phase>(kstPhase);
  const [draft, setDraft] = useState("");
  const [viewing, setViewing] = useState<Villager | null>(null);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [unread, setUnread] = useState(0);

  // Someone said your @name: a notice on the map, and a count in the tab title if you're away.
  const crowd = useRef<{ others: Villager[]; me: string | null }>({ others: [], me: null });
  const heard = useCallback((key: string, text: string) => {
    const { others, me } = crowd.current;
    const from = others.find((o) => o.key === key);
    if (!from || !me || !calls(text, me)) return;
    const id = Date.now() + Math.random();
    setNotices((n) => [...n.slice(-2), { id, from, text }]);
    setTimeout(() => setNotices((n) => n.filter((m) => m.id !== id)), NOTICE_MS);
    if (document.hidden) setUnread((u) => u + 1);
  }, []);
  const { self, others, bubbles, status, moveTo, dropAt, say } = useVillage(look, heard);

  useEffect(() => {
    crowd.current = { others, me: self?.nickname ?? null };
  }, [others, self?.nickname]);

  useEffect(() => {
    const base = "Player One";
    document.title = unread ? `(${unread}) 누가 불렀어요 · ${base}` : base;
    const seen = () => !document.hidden && setUnread(0);
    document.addEventListener("visibilitychange", seen);
    return () => document.removeEventListener("visibilitychange", seen);
  }, [unread]);

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

  // Your figure stopped short (a wall, the edge): that's where you are now.
  const atNow = self?.at;
  const settle = useCallback(
    (at: [number, number]) => {
      if (!atNow || Math.hypot(at[0] - atNow[0], at[1] - atNow[1]) > 0.002) moveTo(at);
    },
    [atNow, moveTo],
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
              onSettle={settle}
              onDrop={dropAt}
              onOpen={setViewing}
              onMention={mention}
              onApproach={approach}
            />
            <div className={x.hud}>
              <span className={x.pill}>{PHASES[phase].label}</span>
              <span className={x.pill}>
                {status === "joining" ? "들어가는 중…" : status === "error" ? "연결이 끊겼어요" : `${others.length + 1}명 접속 중`}
              </span>
            </div>
            <p className={x.hint}>우클릭 이동 · 내 캐릭터 꾹 눌러 옮기기 · 사람 클릭 @멘션 · 우클릭 메뉴 · Space+드래그 시점 · 휠 확대 · Y 전경</p>

            {notices.length > 0 && (
              <ul className={x.notices} aria-live="polite">
                {notices.map((n) => (
                  <li key={n.id} className={x.callout}>
                    <span className={x.calloutBell} aria-hidden>
                      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round">
                        <path d="M4 11V7a4 4 0 0 1 8 0v4l1.5 1.5h-11zM6.5 14a1.5 1.5 0 0 0 3 0" />
                      </svg>
                    </span>
                    <span className={x.calloutText}>
                      <b>
                        {n.from.classKey && <ClassEmblem classKey={n.from.classKey} size={14} />}
                        {n.from.nickname}
                      </b>
                      님이 불렀어요
                      <span className={x.calloutQuote}>{n.text}</span>
                    </span>
                    <button
                      type="button"
                      className={x.calloutAction}
                      onClick={() => {
                        mention(n.from);
                        setNotices((all) => all.filter((m) => m.id !== n.id));
                      }}
                    >
                      답하기
                    </button>
                    <button
                      type="button"
                      className={x.calloutClose}
                      aria-label="알림 닫기"
                      onClick={() => setNotices((all) => all.filter((m) => m.id !== n.id))}
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            )}

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
            {viewing && (
              <ProfileModal
                handle={viewing.handle}
                name={viewing.nickname}
                onClose={() => setViewing(null)}
                actions={
                  <>
                    <button
                      type="button"
                      className="btn btn-soft"
                      onClick={() => {
                        setViewing(null);
                        approach(viewing);
                      }}
                    >
                      옆으로 가기
                    </button>
                    <button
                      type="button"
                      className="btn"
                      onClick={() => {
                        setViewing(null);
                        mention(viewing);
                      }}
                    >
                      말 걸기
                    </button>
                  </>
                }
              />
            )}
          </>
        )}
      </main>
    </>
  );
}
