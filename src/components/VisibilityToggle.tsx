"use client";

import s from "./hud.module.css";

// The most important component in the app: every field gets one. See docs/DESIGN.md §6.
export function VisibilityToggle({
  isPublic,
  onChange,
  field,
}: {
  isPublic: boolean;
  onChange: (next: boolean) => void;
  field: string;
}) {
  return (
    <button
      type="button"
      className={s.lock}
      aria-pressed={isPublic}
      aria-label={`${field} ${isPublic ? "공개" : "비공개"} — 전환`}
      title={isPublic ? "공개" : "비공개"}
      onClick={() => onChange(!isPublic)}
    >
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.25">
        <rect x="3" y="7" width="10" height="7" rx="1" />
        {isPublic ? <path d="M5 7V5a3 3 0 0 1 5.8-1" /> : <path d="M5 7V5a3 3 0 0 1 6 0v2" />}
      </svg>
    </button>
  );
}
