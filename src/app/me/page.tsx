"use client";

import Link from "next/link";
import { CharacterSheet } from "@/components/CharacterSheet";
import { ProfileEditor } from "@/components/ProfileEditor";
import { TopBar } from "@/components/TopBar";
import { VisibilityToggle } from "@/components/VisibilityToggle";
import { useGameEvents } from "@/lib/events";
import { FIELD_VISIBILITY } from "@/lib/fields";
import { sheetFromOwn, type Profile, type ProfilePatch } from "@/lib/profile";
import { useMyProfile } from "@/lib/useMyProfile";

const STAT_KEYS = ["height_cm", "weight_kg", "skeletal_muscle_kg", "body_fat_pct"] as const;

export default function MePage() {
  const { profile, error, save } = useMyProfile();
  const emit = useGameEvents((s) => s.emit);

  if (!profile) {
    return (
      <main style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>
        <p className="label">{error ?? "Loading character…"}</p>
      </main>
    );
  }

  const vis = profile.visibility;

  async function saveWithEvents(patch: ProfilePatch) {
    const before: Profile = profile!;
    await save(patch);
    for (const k of STAT_KEYS) {
      const a = before[k];
      const b = patch[k];
      if (a != null && b != null && a !== b) emit({ type: "stat-saved", key: k, delta: b - a });
    }
    if (patch.wealth_tier !== before.wealth_tier) emit({ type: "tier-change" });
    if (patch.class_key !== before.class_key) emit({ type: "class-change" });
  }

  const sealed = Object.fromEntries(Object.entries(FIELD_VISIBILITY).map(([f, v]) => [f, !vis[v]]));

  return (
    <>
      <TopBar handle={profile.handle} />
      {error && <p style={{ padding: "8px 24px", color: "var(--rarity-legendary)" }}>{error}</p>}
      <CharacterSheet
        data={sheetFromOwn(profile)}
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
        footer={
          <>
            {profile.handle ? (
              <Link className="btn" href={`/p?u=${profile.handle}`} style={{ justifyContent: "center" }}>
                타인에게 보이는 화면 미리보기
              </Link>
            ) : (
              <p className="label">Handle을 정하면 공개 프로필이 생겨요</p>
            )}
            <ProfileEditor key={profile.user_id} profile={profile} onSave={saveWithEvents} />
          </>
        }
      />
    </>
  );
}
