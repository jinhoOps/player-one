"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { CharacterSheet } from "@/components/CharacterSheet";
import { fetchPublicProfile, sheetFromPublic, type PublicProfile } from "@/lib/profile";

// Static export can't prebuild /p/[handle], so the handle comes from ?u= and
// the profile is fetched client-side through get_public_profile (public fields only).
function PublicProfileView() {
  const handle = useSearchParams().get("u");
  const [state, setState] = useState<{ handle: string; profile: PublicProfile | null; error?: string } | null>(null);

  useEffect(() => {
    if (!handle) return;
    fetchPublicProfile(handle).then(
      (profile) => setState({ handle, profile }),
      (e) => setState({ handle, profile: null, error: e.message }),
    );
  }, [handle]);

  const msg = (t: string) => (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>
      <p className="label">{t}</p>
    </main>
  );

  if (!handle) return msg("No player specified");
  if (state?.handle !== handle) return msg("Loading character…");
  if (state.error) return msg(state.error);
  if (!state.profile) return msg(`Player "${handle}" not found`);
  return <CharacterSheet data={sheetFromPublic(state.profile)} />;
}

export default function PublicProfilePage() {
  return (
    <Suspense>
      <PublicProfileView />
    </Suspense>
  );
}
