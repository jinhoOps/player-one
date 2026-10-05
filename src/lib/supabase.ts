import { createClient } from "@supabase/supabase-js";
import { BASE_PATH } from "./basePath";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!url || !key) {
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (see .env.example)");
}

// Browser-only client. The app is a static export, so OAuth uses PKCE and the
// code exchange happens on /auth/callback (detectSessionInUrl).
export const supabase = createClient(url, key, {
  auth: {
    flowType: "pkce",
    detectSessionInUrl: true,
    persistSession: true,
  },
  // Background tabs throttle timers; the village's heartbeat runs in a worker so
  // a hidden tab doesn't quietly drop out of presence.
  realtime: { worker: true },
});

export function signInWithGoogle() {
  return supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${window.location.origin}${BASE_PATH}/auth/callback` },
  });
}

export function signOut() {
  return supabase.auth.signOut();
}
