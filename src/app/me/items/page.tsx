"use client";

import { useMemo, useState } from "react";
import { Card } from "@/components/Card";
import { ItemForm } from "@/components/ItemForm";
import { ItemIcon } from "@/components/ItemIcon";
import { TopBar } from "@/components/TopBar";
import x from "@/components/items.module.css";
import {
  CATEGORIES,
  CATEGORY_KEYS,
  categoryLabel,
  needsRefill,
  yearsOwned,
  type CategoryKey,
  type Item,
} from "@/lib/items";
import { useMyItems } from "@/lib/useMyItems";
import { useMyProfile } from "@/lib/useMyProfile";

// Filter: everything, one built-in category, or one of the owner's own ("custom:<label>").
type Filter = "all" | CategoryKey | `custom:${string}`;
type Flag = "again" | "refill";

const matches = (i: Item, f: Filter) =>
  f === "all" || (f.startsWith("custom:") ? i.category === "custom" && i.custom_category === f.slice(7) : i.category === f);

export default function ItemsPage() {
  const { profile } = useMyProfile();
  const { items, error, save, remove } = useMyItems();
  const [filter, setFilter] = useState<Filter>("all");
  const [flag, setFlag] = useState<Flag | null>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<{ item?: Item } | null>(null);

  const all = useMemo(() => items ?? [], [items]);
  const customs = useMemo(
    () => [...new Set(all.flatMap((i) => (i.category === "custom" && i.custom_category ? [i.custom_category] : [])))],
    [all],
  );
  const brands = useMemo(() => [...new Set(all.flatMap((i) => (i.brand ? [i.brand] : [])))].sort(), [all]);
  const shelfCount = all.filter((i) => i.displayed).length;

  const q = query.trim().toLowerCase();
  const shown = all
    .filter((i) => matches(i, filter))
    .filter((i) => (flag === "again" ? i.verdict === "again" : flag === "refill" ? needsRefill(i) : true))
    .filter((i) => !q || [i.name, i.brand, i.model, i.note].some((v) => v?.toLowerCase().includes(q)))
    // Things given away stay on record, after the rest.
    .sort((a, b) => Number(a.status === "gone") - Number(b.status === "gone"));

  const count = (f: Filter) => all.filter((i) => matches(i, f)).length;
  const chips: { key: Filter; icon: CategoryKey | "all"; label: string; title?: string }[] = [
    { key: "all", icon: "all", label: "전체" },
    ...CATEGORY_KEYS.map((k) => ({ key: k, icon: k, label: CATEGORIES[k].label, title: CATEGORIES[k].hint })),
    ...customs.map((c) => ({ key: `custom:${c}` as const, icon: "custom" as const, label: c, title: "직접 만든 분류 (나만 보기)" })),
  ];

  if (!profile || !items) {
    return (
      <main style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>
        <p className="label">{error ?? "인벤토리 불러오는 중…"}</p>
      </main>
    );
  }

  return (
    <>
      <TopBar handle={profile.handle} />
      <main className={x.page}>
        <header className={x.head}>
          <h1 className={x.title}>
            인벤토리 <span className={`num ${x.total}`}>{all.length}</span>
          </h1>
          <input
            className={x.search}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="이름·브랜드·모델 검색"
            aria-label="인벤토리 검색"
          />
          <button type="button" className="btn" onClick={() => setOpen({})}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path d="M8 3v10M3 8h10" />
            </svg>
            추가
          </button>
        </header>

        <nav className={x.cats} aria-label="분류">
          {chips.map((c) => (
            <button
              key={c.key}
              type="button"
              className={x.cat}
              aria-pressed={filter === c.key}
              title={c.title}
              onClick={() => setFilter(c.key)}
            >
              <ItemIcon kind={c.icon} size={20} />
              <span className={x.catLabel}>{c.label}</span>
              <span className={`num ${x.catCount}`}>{count(c.key)}</span>
            </button>
          ))}
        </nav>
        <div className={x.flags}>
          {(
            [
              ["again", "다시 살 것"],
              ["refill", "보충 필요"],
            ] as const
          ).map(([k, label]) => (
            <button key={k} type="button" className={x.flag} aria-pressed={flag === k} onClick={() => setFlag(flag === k ? null : k)}>
              {label}
            </button>
          ))}
        </div>

        {shown.length === 0 ? (
          <p className={x.empty}>
            {all.length === 0 ? "오래 쓰려고 산 물건을 하나씩 모아 봐요" : "조건에 맞는 아이템이 없어요"}
          </p>
        ) : (
          <ul className={x.grid}>
            {shown.map((i) => {
              const years = yearsOwned(i.bought_on);
              return (
                <li key={i.id}>
                  <button
                    type="button"
                    className={x.tile}
                    data-gone={i.status === "gone" || undefined}
                    title={[categoryLabel(i), i.brand, i.model].filter(Boolean).join(" · ")}
                    onClick={() => setOpen({ item: i })}
                  >
                    <span className={x.tileIcon}>
                      <ItemIcon kind={i.category} size={26} />
                    </span>
                    <span className={x.tileName}>{i.name}</span>
                    <span className={x.tileMeta}>{[i.brand, years && `${years}년차`].filter(Boolean).join(" · ") || " "}</span>
                    <span className={x.badges}>
                      {i.displayed && (
                        <span className={x.badgeTrophy} title="진열 중">
                          <ItemIcon kind="trophy" size={12} />
                        </span>
                      )}
                      {needsRefill(i) && <span className={x.badge}>보충</span>}
                      {i.verdict === "again" && <span className={x.badge}>재구매</span>}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </main>

      {open && (
        <div className={x.overlay} onClick={(e) => e.target === e.currentTarget && setOpen(null)}>
          <div className={x.sheet} role="dialog" aria-modal="true" aria-label={open.item ? "아이템 편집" : "아이템 추가"}>
            <Card title={open.item ? open.item.name : "아이템 추가"}>
              <ItemForm
                key={open.item?.id ?? "new"}
                item={open.item}
                initialCategory={filter === "all" || filter.startsWith("custom:") ? undefined : (filter as CategoryKey)}
                customCategories={customs}
                brands={brands}
                shelfCount={shelfCount}
                onSave={(input) => save(input, open.item?.id)}
                onDelete={open.item ? () => remove(open.item!.id) : undefined}
                onClose={() => setOpen(null)}
              />
            </Card>
          </div>
        </div>
      )}
    </>
  );
}
