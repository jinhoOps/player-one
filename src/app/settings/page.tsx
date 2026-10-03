"use client";

import { HudPanel } from "@/components/HudPanel";
import { TopBar } from "@/components/TopBar";
import { VisibilityToggle } from "@/components/VisibilityToggle";
import { VISIBILITY_LABELS } from "@/lib/fields";
import { VISIBILITY_KEYS, type Visibility } from "@/lib/game";
import { useMyProfile } from "@/lib/useMyProfile";

export default function SettingsPage() {
  const { profile, error, save } = useMyProfile();

  if (!profile) {
    return (
      <main style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>
        <p className="label">{error ?? "Loading…"}</p>
      </main>
    );
  }

  const vis = profile.visibility;
  const setAll = (value: boolean) =>
    save({ visibility: Object.fromEntries(VISIBILITY_KEYS.map((k) => [k, value])) as Visibility });

  return (
    <>
      <TopBar handle={profile.handle} />
      <main style={{ maxWidth: 560, margin: "0 auto", padding: 24 }}>
        <HudPanel label="Visibility">
          {VISIBILITY_KEYS.map((k) => (
            <div
              key={k}
              style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid var(--line)" }}
            >
              <span>{VISIBILITY_LABELS[k]}</span>
              <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span className="label">{vis[k] ? "Public" : "Private"}</span>
                <VisibilityToggle field={k} isPublic={vis[k]} onChange={(next) => save({ visibility: { ...vis, [k]: next } })} />
              </span>
            </div>
          ))}
          <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
            <button className="btn" onClick={() => setAll(false)}>
              전부 비공개
            </button>
          </div>
        </HudPanel>
      </main>
    </>
  );
}
