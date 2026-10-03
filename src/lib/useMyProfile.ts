"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { fetchMyProfile, updateMyProfile, type Profile, type ProfilePatch } from "./profile";
import { useSession } from "./useSession";

// Loads the signed-in user's profile; redirects to / when signed out.
export function useMyProfile() {
  const session = useSession();
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const userId = session?.user.id;

  useEffect(() => {
    if (session === null) router.replace("/");
    if (!userId) return;
    fetchMyProfile(userId).then(setProfile, (e) => setError(e.message));
  }, [session, userId, router]);

  const save = useCallback(
    async (patch: ProfilePatch) => {
      if (!userId) return;
      try {
        setProfile(await updateMyProfile(userId, patch));
        setError(null);
      } catch (e) {
        setError((e as Error).message);
        throw e;
      }
    },
    [userId],
  );

  return { profile, error, save };
}
