"use client";

import { useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import s from "./ui.module.css";

type Props = {
  label: string;
  value: number | null | undefined;
  unit: string;
  step: number;
  digits: number;
  min: number;
  max: number;
  onCommit: (v: number | null) => void;
  onCancel: () => void;
};

const PX_PER_STEP = 4;

// Stepper + scrub (docs/DESIGN.md §6): drag the grip sideways to dial a value,
// or type it. Enter or ✓ saves, Esc cancels, an empty field clears the stat.
export function StatInput({ label, value, unit, step, digits, min, max, onCommit, onCancel }: Props) {
  const [text, setText] = useState(value != null ? value.toFixed(digits) : "");
  const drag = useRef<{ x: number; from: number } | null>(null);

  const clamp = (v: number) => Math.min(max, Math.max(min, v));
  const current = () => (text.trim() === "" ? null : Number(text));
  const set = (v: number) => setText(clamp(Math.round(v / step) * step).toFixed(digits));
  const nudge = (dir: number) => set((current() ?? value ?? (min + max) / 2) + dir * step);

  function commit() {
    const v = current();
    if (v != null && !Number.isFinite(v)) return;
    onCommit(v == null ? null : clamp(v));
  }

  function key(e: KeyboardEvent) {
    if (e.key === "Enter") commit();
    if (e.key === "Escape") onCancel();
    if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      e.preventDefault();
      nudge((e.key === "ArrowUp" ? 1 : -1) * (e.shiftKey ? 10 : 1));
    }
  }

  function down(e: PointerEvent<HTMLButtonElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, from: current() ?? value ?? (min + max) / 2 };
  }
  function move(e: PointerEvent<HTMLButtonElement>) {
    if (!drag.current) return;
    set(drag.current.from + Math.trunc((e.clientX - drag.current.x) / PX_PER_STEP) * step);
  }

  return (
    <div className={s.statInput} onKeyDown={key}>
      <button
        type="button"
        className={s.scrub}
        aria-label={`${label} 드래그로 조절`}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={() => (drag.current = null)}
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.25" aria-hidden>
          <path d="M1 8h14M4 5 1 8l3 3M12 5l3 3-3 3" />
        </svg>
      </button>
      <button type="button" className={s.step} aria-label={`${label} 감소`} onClick={() => nudge(-1)}>
        −
      </button>
      <input
        className="num"
        aria-label={`${label} (${unit})`}
        inputMode="decimal"
        value={text}
        autoFocus
        onChange={(e) => setText(e.target.value)}
      />
      <button type="button" className={s.step} aria-label={`${label} 증가`} onClick={() => nudge(1)}>
        +
      </button>
      <button type="button" className={s.step} aria-label="저장" onClick={commit}>
        ✓
      </button>
      <button type="button" className={s.step} aria-label="취소" onClick={onCancel}>
        ✕
      </button>
    </div>
  );
}
