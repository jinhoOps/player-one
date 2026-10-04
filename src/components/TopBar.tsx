"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { useSession } from "@/lib/useSession";
import { Logo } from "./Logo";
import { SettingsModal } from "./SettingsModal";
import s from "./ui.module.css";

function Nav({ handle }: { handle?: string | null }) {
  const router = useRouter();
  const path = usePathname();
  const params = useSearchParams();
  const viewing = params.get("u");
  const session = useSession();
  // Settings open over the current page; /settings and ?settings=1 land here open.
  const [settings, setSettings] = useState(() => params.get("settings") === "1");

  // Someone who isn't signed in (looking at a shared profile) gets a way in instead.
  if (session === null) {
    return (
      <nav className={s.nav}>
        <Link href="/" className={s.navLink}>
          나도 시작하기
        </Link>
      </nav>
    );
  }
  const links = [
    { href: "/me", label: "내 캐릭터", on: path === "/me" },
    { href: "/me/items", label: "인벤토리", on: path === "/me/items" },
    { href: "/village", label: "마을", on: path === "/village" },
    ...(handle ? [{ href: `/p?u=${handle}`, label: "공개 프로필", on: path === "/p" && viewing === handle }] : []),
  ];
  const close = () => {
    setSettings(false);
    if (params.get("settings")) router.replace(path);
  };
  return (
    <nav className={s.nav}>
      {links.map((l) => (
        <Link key={l.href} href={l.href} className={s.navLink} aria-current={l.on ? "page" : undefined}>
          {l.label}
        </Link>
      ))}
      <button
        type="button"
        className={s.navLink}
        aria-haspopup="dialog"
        aria-expanded={settings}
        onClick={() => setSettings(true)}
      >
        설정
      </button>
      {settings && <SettingsModal onClose={close} />}
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
