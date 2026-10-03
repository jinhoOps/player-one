"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { signInWithGoogle } from "@/lib/supabase";
import { useSession } from "@/lib/useSession";
import s from "./page.module.css";

export default function Landing() {
  const session = useSession();
  const router = useRouter();

  useEffect(() => {
    if (session) router.replace("/me");
  }, [session, router]);

  return (
    <main className={s.landing}>
      <div>
        <h1 className={s.logo}>PLAYER ONE</h1>
        <p className={s.tagline}>Life is an MMORPG. You are Player One.</p>
        <div className={s.start}>
          <button className="btn" onClick={() => signInWithGoogle()} disabled={session === undefined}>
            <span className={s.blink}>▶</span> Press Start — Google
          </button>
        </div>
      </div>
    </main>
  );
}
