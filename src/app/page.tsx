"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Logo } from "@/components/Logo";
import { signInWithGoogle } from "@/lib/supabase";
import { useSession } from "@/lib/useSession";
import s from "./page.module.css";

const CharacterViewport = dynamic(() => import("@/components/CharacterViewport"), { ssr: false });

// The landing shows the toy itself: the neutral character, nothing equipped.
const PREVIEW = { body: "neutral", hair: null, height: null, weight: null, muscle: null } as const;
const NOTHING = { head: false, top: false, bottom: false, shoes: false };

const POINTS = [
  { title: "나를 캐릭터로", body: "키·몸무게·사이즈가 스탯과 장비가 되고, 체형이 그대로 캐릭터가 돼요." },
  { title: "보여줄 만큼만", body: "항목마다 공개와 비공개를 정해요. 숨긴 값은 다른 사람에게 절대 닿지 않아요." },
  { title: "성장할 때 반짝", body: "기록을 바꾸면 캐릭터가 함께 반응해요. 티어가 오르면 작은 축하가 터져요." },
];

export default function Landing() {
  const session = useSession();
  const router = useRouter();

  useEffect(() => {
    if (session) router.replace("/me");
  }, [session, router]);

  return (
    <main className={s.landing}>
      <header className={s.header}>
        <Logo />
      </header>
      <section className={s.hero}>
        <div className={s.copy}>
          <h1 className={`display ${s.headline}`}>
            인생이라는 게임,
            <br />
            주인공은 나.
          </h1>
          <p className={s.lede}>내 몸과 일, 자산을 캐릭터 스탯처럼 기록하고 키워요. 무엇을 보여줄지는 항상 내가 정해요.</p>
          <button className={`btn ${s.cta}`} onClick={() => signInWithGoogle()} disabled={session === undefined}>
            모험 시작하기 — Google로 계속
          </button>
        </div>
        <div className={s.stage} aria-label="Player One 캐릭터 미리보기">
          <CharacterViewport morph={PREVIEW} equipped={NOTHING} />
        </div>
      </section>
      <ul className={s.points}>
        {POINTS.map((p) => (
          <li key={p.title}>
            <h2 className="display">{p.title}</h2>
            <p>{p.body}</p>
          </li>
        ))}
      </ul>
    </main>
  );
}
