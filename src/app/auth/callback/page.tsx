"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

// PKCE callback for a static export: supabase-js exchanges ?code= on init
// (detectSessionInUrl), so we only wait for the session and move on.
export default function AuthCallback() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const oauthError = params.get("error_description") ?? params.get("error");
    supabase.auth.getSession().then(({ data, error }) => {
      if (oauthError) setError(oauthError);
      else if (error || !data.session) setError(error?.message ?? "No session");
      else router.replace("/me");
    });
  }, [router]);

  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>
      {error ? (
        <p>
          로그인 실패: {error} — <Link href="/">돌아가기</Link>
        </p>
      ) : (
        <p className="label">Loading character…</p>
      )}
    </main>
  );
}
