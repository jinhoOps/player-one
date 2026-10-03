"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { signOut } from "@/lib/supabase";

export function TopBar({ handle }: { handle?: string | null }) {
  const router = useRouter();
  return (
    <header
      style={{
        height: 64,
        display: "flex",
        alignItems: "center",
        gap: 24,
        padding: "0 24px",
        borderBottom: "1px solid var(--line)",
      }}
    >
      <Link href="/me" className="num" style={{ letterSpacing: "0.08em" }}>
        PLAYER ONE
      </Link>
      <nav className="label" style={{ display: "flex", gap: 16, marginLeft: "auto" }}>
        <Link href="/me">Sheet</Link>
        {handle && <Link href={`/p?u=${handle}`}>Public view</Link>}
        <Link href="/settings">Settings</Link>
        <button className="label" onClick={() => signOut().then(() => router.replace("/"))}>
          Log out
        </button>
      </nav>
    </header>
  );
}
