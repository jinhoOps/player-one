import Link from "next/link";
import { SHELF_SIZE, type Trophy } from "@/lib/items";
import { Card } from "./Card";
import { ItemIcon } from "./ItemIcon";
import x from "./items.module.css";

/** The few items a player chose to show off. Icon-level fields only (docs/DESIGN.md §2). */
export function TrophyShelf({ trophies, owner }: { trophies: Trophy[]; owner?: boolean }) {
  if (!owner && trophies.length === 0) return null;
  return (
    <Card
      title="진열장"
      action={
        owner && (
          <Link href="/me/items" className={x.shelfLink}>
            인벤토리
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
              <path d="M6 3l5 5-5 5" />
            </svg>
          </Link>
        )
      }
    >
      <ul className={x.shelf}>
        {Array.from({ length: owner ? SHELF_SIZE : trophies.length }, (_, i) => trophies[i]).map((t, i) =>
          t ? (
            <li key={i} className={x.trophy} title={[t.brand, t.name].filter(Boolean).join(" ")}>
              <span className={x.trophyIcon}>
                <ItemIcon kind={t.category} size={22} />
              </span>
              <span className={x.trophyName}>{t.name}</span>
              <span className={x.trophyMeta}>{[t.brand, t.since].filter(Boolean).join(" · ")}</span>
            </li>
          ) : (
            <li key={i} className={`${x.trophy} ${x.trophyEmpty}`} aria-label="빈 칸">
              <span className={x.trophyIcon}>
                <ItemIcon kind="trophy" size={18} />
              </span>
            </li>
          ),
        )}
      </ul>
      {owner && trophies.length === 0 && <p className={x.shelfHint}>인벤토리에서 아이템을 진열하면 공개 프로필에 보여요</p>}
    </Card>
  );
}
