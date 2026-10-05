"use client";

import Link from "next/link";
import { useState } from "react";
import { CharacterSheet } from "@/components/CharacterSheet";
import { HandleClaim } from "@/components/HandleClaim";
import { ProfileEditor } from "@/components/ProfileEditor";
import { TopBar } from "@/components/TopBar";
import { TrophyShelf } from "@/components/TrophyShelf";
import { VisibilityToggle } from "@/components/VisibilityToggle";
import { SLOT_FIELDS } from "@/components/EquipFields";
import { useGameEvents } from "@/lib/events";
import { FIELD_VISIBILITY } from "@/lib/fields";
import { EQUIP_SLOTS, WEALTH_TIERS } from "@/lib/game";
import { sheetFromOwn, type Profile, type ProfilePatch } from "@/lib/profile";
import { toTrophy } from "@/lib/items";
import { useMyItems } from "@/lib/useMyItems";
import { useMyProfile } from "@/lib/useMyProfile";

const STAT_KEYS = ["height_cm", "weight_kg", "skeletal_muscle_kg", "body_fat_pct"] as const;

export default function MePage() {
  const { profile, error, save } = useMyProfile();
  const emit = useGameEvents((s) => s.emit);
  const [editing, setEditing] = useState(false);
  const { items } = useMyItems();

  if (!profile) {
    return (
      <main style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>
        <p className="label">{error ?? "캐릭터 불러오는 중…"}</p>
      </main>
    );
  }

  const vis = profile.visibility;

  // Every save path (inline stats, slot popovers, the form) goes through here,
  // so each data change fires its effect (docs/DESIGN.md §7).
  async function saveWithEvents(patch: ProfilePatch) {
    const before: Profile = profile!;
    await save(patch);
    const changed = (k: keyof ProfilePatch) => k in patch && patch[k] !== before[k as keyof Profile];
    for (const k of STAT_KEYS) {
      const a = before[k];
      const b = patch[k];
      if (a != null && b != null && a !== b) emit({ type: "stat-saved", key: k, delta: b - a });
    }
    for (const slot of EQUIP_SLOTS) {
      const fields = SLOT_FIELDS[slot].map((f) => f.key);
      if (fields.some(changed) && fields.some((k) => (patch[k] ?? null) != null)) emit({ type: "equip", slot });
    }
    // A new kind in a slot (cap → beanie) sparkles like an equip.
    for (const slot of EQUIP_SLOTS) {
      if (patch.gear && (patch.gear[slot] ?? null) !== (before.gear?.[slot] ?? null)) emit({ type: "equip", slot });
    }
    if (changed("wealth_tier") && patch.wealth_tier != null)
      emit({ type: "tier-change", rarity: WEALTH_TIERS[patch.wealth_tier].rarity });
    if (changed("class_key") && patch.class_key) emit({ type: "class-change" });
  }

  const sealed = Object.fromEntries(Object.entries(FIELD_VISIBILITY).map(([f, v]) => [f, !vis[v]]));

  return (
    <>
      <TopBar handle={profile.handle} />
      {error && <p style={{ padding: "8px 24px", color: "var(--rarity-legendary)" }}>{error}</p>}
      <CharacterSheet
        data={sheetFromOwn(profile)}
        owner={{ profile, save: saveWithEvents }}
        sealed={sealed}
        trailing={(field) => {
          const key = FIELD_VISIBILITY[field];
          if (!key) return null;
          return (
            <VisibilityToggle
              field={field}
              isPublic={vis[key]}
              onChange={(next) => {
                save({ visibility: { ...vis, [key]: next } });
                if (!next) emit({ type: "sealed", key });
              }}
            />
          );
        }}
        identityActions={
          <>
            <button type="button" className="btn" aria-expanded={editing} onClick={() => setEditing(!editing)}>
              {editing ? "편집 닫기" : "프로필 편집"}
            </button>
            {profile.handle ? (
              <Link className="btn btn-soft" href={`/p?u=${profile.handle}`} title="타인에게 보이는 화면 미리보기">
                공개 화면 보기
              </Link>
            ) : (
              <span className="label" title="핸들을 정하면 공개 프로필이 생겨요">
                핸들을 정하면 공개
              </span>
            )}
          </>
        }
        banner={!profile.handle && <HandleClaim onSave={(handle) => save({ handle })} />}
        footer={
          <>
            {editing && <ProfileEditor key={profile.user_id} profile={profile} onSave={saveWithEvents} />}
            {items && <TrophyShelf owner trophies={items.filter((i) => i.displayed).reverse().map(toTrophy)} />}
          </>
        }
      />
    </>
  );
}
