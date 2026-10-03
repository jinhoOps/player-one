"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { rollNumber } from "@/lib/motion";
import { useSeal } from "@/lib/useSeal";
import { StatInput } from "./StatInput";
import s from "./ui.module.css";

type Props = {
  label: string;
  value: number | null | undefined;
  unit: string;
  digits?: number;
  /** Gauge range; omit to hide the bar. Also bounds the editor. */
  range?: [number, number];
  /** Editor bounds when they differ from the gauge range. */
  limits?: [number, number];
  step?: number;
  sealed?: boolean;
  trailing?: ReactNode;
  /** Owner view: click the value to edit it in place. */
  onCommit?: (v: number | null) => Promise<void> | void;
};

// Delta color is always neutral (sky): a weight gain may be someone's goal.
export function StatRow({ label, value, unit, digits = 1, range, limits, step = 0.1, sealed, trailing, onCommit }: Props) {
  const ref = useRef<HTMLSpanElement>(null);
  const prev = useRef(value);
  const [delta, setDelta] = useState<{ v: number; id: number } | null>(null);
  const [editing, setEditing] = useState(false);
  useSeal(ref, sealed);

  useEffect(() => {
    const from = prev.current;
    prev.current = value;
    if (ref.current && from != null && value != null && from !== value) {
      rollNumber(ref.current, from, value, digits);
      setDelta({ v: value - from, id: Date.now() });
    }
  }, [value, digits]);

  const ratio = range && value != null ? Math.min(1, Math.max(0, (value - range[0]) / (range[1] - range[0]))) : 0;
  const shown = <span ref={ref}>{value != null ? value.toFixed(digits) : "—"}</span>;
  const [min, max] = limits ?? range ?? [0, 999];

  if (editing && onCommit) {
    return (
      <div className={`${s.statRow} ${s.statRowEditing}`}>
        <span className="label">{label}</span>
        <div className={s.statEdit}>
          <StatInput
            label={label}
            value={value}
            unit={unit}
            step={step}
            digits={digits}
            min={min}
            max={max}
            onCancel={() => setEditing(false)}
            onCommit={async (v) => {
              setEditing(false);
              if (v !== value) await onCommit(v);
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className={s.statRow}>
      <span className="label">{label}</span>
      <span className={s.statTrail}>{trailing}</span>
      <span className={`num ${s.statValue} ${s.sealable} ${sealed ? s.sealed : ""}`}>
        {onCommit ? (
          <button type="button" className={s.editable} onClick={() => setEditing(true)} aria-label={`${label} 편집`}>
            {shown}
          </button>
        ) : (
          shown
        )}
        <span className={s.statUnit}>{unit}</span>
        {delta && (
          <span key={delta.id} className={`num ${s.delta}`}>
            {delta.v > 0 ? "+" : ""}
            {delta.v.toFixed(digits)}
            {unit}
          </span>
        )}
      </span>
      {range && (
        <div className={s.gauge}>
          <div className={s.gaugeFill} style={{ transform: `scaleX(${ratio})` }} />
        </div>
      )}
    </div>
  );
}
