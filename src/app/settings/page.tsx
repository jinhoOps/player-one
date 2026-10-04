"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

// Settings is a modal now (TopBar → SettingsModal). Old links land on the
// character sheet with it open.
export default function SettingsRedirect() {
  const router = useRouter();
  useEffect(() => router.replace("/me?settings=1"), [router]);
  return null;
}
