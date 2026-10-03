"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { signOut } from "@/lib/supabase";
import { Logo } from "./Logo";
import s from "./ui.module.css";

function Nav({ handle }: { handle?: string | null }) {
  const router = useRouter();
  const path = usePathname();
  const viewing = useSearchParams().get("u");
  const links = [
    { href: "/me", label: "내 캐릭터", on: path === "/me" },
    { href: "/me/items", label: "인벤토리", on: path === "/me/items" },
    ...(handle ? [{ href: `/p?u=${handle}`, label: "공개 프로필", on: path === "/p" && viewing === handle }] : []),
    { href: "/settings", label: "설정", on: path === "/settings" },
  ];
  return (
    <nav className={s.nav}>
      {links.map((l) => (
        <Link key={l.href} href={l.href} className={s.navLink} aria-current={l.on ? "page" : undefined}>
          {l.label}
        </Link>
      ))}
      <button className={s.navLink} onClick={() => signOut().then(() => router.replace("/"))}>
        로그아웃
      </button>
    </nav>
  );
}

export function TopBar({ handle }: { handle?: string | null }) {
  return (
    <header className={s.topBar}>
      <Link href="/me" aria-label="Player One — 내 캐릭터">
        <Logo />
      </Link>
      <Suspense>
        <Nav handle={handle} />
      </Suspense>
    </header>
  );
}
