"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect } from "react";
import { create } from "zustand";
import { fetchMyProfile, profileErrorText, updateMyProfile, type Profile, type ProfilePatch } from "./profile";
import { useSession } from "./useSession";

// One copy of the signed-in profile for the whole page, so a change made in
// one place (the settings modal) shows everywhere (the sheet behind it).
const useStore = create<{ userId: string | null; profile: Profile | null; error: string | null }>(() => ({
  userId: null,
  profile: null,
  error: null,
}));

let loading: string | null = null;

// Loads the signed-in user's profile; redirects to / when signed out.
export function useMyProfile() {
  const session = useSession();
  const router = useRouter();
  const userId = session?.user.id;
  const owner = useStore((s) => s.userId);
  const profile = useStore((s) => (s.userId === userId ? s.profile : null));
  const error = useStore((s) => s.error);

  useEffect(() => {
    if (session === null) router.replace("/");
    if (!userId || owner === userId || loading === userId) return;
    loading = userId;
    fetchMyProfile(userId).then(
      (p) => useStore.setState({ userId, profile: p, error: null }),
      (e) => useStore.setState({ error: (e as Error).message }),
    ).finally(() => {
      loading = null;
    });
  }, [session, userId, owner, router]);

  const save = useCallback(
    async (patch: ProfilePatch) => {
      if (!userId) return;
      try {
        useStore.setState({ userId, profile: await updateMyProfile(userId, patch), error: null });
      } catch (e) {
        useStore.setState({ error: profileErrorText(e) });
        throw e;
      }
    },
    [userId],
  );

  return { profile, error, save };
}

/** Forget the cached profile (after signing out or leaving). */
export function clearMyProfile() {
  useStore.setState({ userId: null, profile: null, error: null });
}
