"use client";

import s from "./ui.module.css";

/**
 * Eye chip: whether an equipped piece is drawn on the character (the helmet, for
 * now). Same shape as the lock, so it reads as "a switch about this field".
 */
export function WearToggle({ shown, onChange, label }: { shown: boolean; onChange: (next: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      className={s.lock}
      aria-pressed={shown}
      aria-label={`${label} ${shown ? "캐릭터에 보임" : "캐릭터에서 숨김"} — 전환`}
      title={shown ? "캐릭터에 보여요 (누르면 숨김)" : "장착은 하고 캐릭터에선 숨겨요 (누르면 보임)"}
      onClick={() => onChange(!shown)}
    >
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round">
        <path d="M1.5 8s2.4-4.5 6.5-4.5S14.5 8 14.5 8s-2.4 4.5-6.5 4.5S1.5 8 1.5 8z" />
        <circle cx="8" cy="8" r="2" />
        {!shown && <path d="M2.5 13.5l11-11" />}
      </svg>
    </button>
  );
}

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
