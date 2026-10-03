"use client";

import { Card } from "@/components/Card";
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
        <p className="label">{error ?? "불러오는 중…"}</p>
      </main>
    );
  }

  const vis = profile.visibility;
  const setAll = (value: boolean) =>
    save({ visibility: Object.fromEntries(VISIBILITY_KEYS.map((k) => [k, value])) as Visibility });

  return (
    <>
      <TopBar handle={profile.handle} />
      <main style={{ maxWidth: 720, margin: "0 auto", padding: 24 }}>
        <Card title="공개 설정">
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(min(280px, 100%), 1fr))",
              columnGap: 24,
            }}
          >
            {VISIBILITY_KEYS.map((k) => (
              <div
                key={k}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "4px 0",
                  borderBottom: "1px solid var(--line)",
                }}
              >
                <span>{VISIBILITY_LABELS[k]}</span>
                <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span className="label">{vis[k] ? "공개" : "비공개"}</span>
                  <VisibilityToggle
                    field={k}
                    isPublic={vis[k]}
                    onChange={(next) => save({ visibility: { ...vis, [k]: next } })}
                  />
                </span>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
            <button className="btn btn-soft" onClick={() => setAll(false)}>
              전부 비공개
            </button>
          </div>
        </Card>
      </main>
    </>
  );
}
