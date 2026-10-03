"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { rollNumber } from "@/lib/motion";
import { useSeal } from "@/lib/useSeal";
import s from "./ui.module.css";

type Props = {
  label: string;
  value: number | null | undefined;
  unit: string;
  digits?: number;
  /** Gauge range; omit to hide the bar. */
  range?: [number, number];
  sealed?: boolean;
  trailing?: ReactNode;
  /** Owner view: clicking the tile opens the stats form on this field. */
  onEdit?: () => void;
};

// Delta color is always neutral (sky): a weight gain may be someone's goal.
export function StatRow({ label, value, unit, digits = 1, range, sealed, trailing, onEdit }: Props) {
  const ref = useRef<HTMLSpanElement>(null);
  const prev = useRef(value);
  const [delta, setDelta] = useState<{ v: number; id: number } | null>(null);
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

  return (
    <div
      className={`${s.statRow} ${onEdit ? s.tapTile : ""}`}
      // The whole tile opens the editor; the lock chip inside keeps its own click.
      onClick={onEdit && ((e) => !(e.target as Element).closest("[aria-pressed]") && onEdit())}
    >
      <span className="label">{label}</span>
      <span className={s.statTrail}>{trailing}</span>
      <span className={`num ${s.statValue} ${s.sealable} ${sealed ? s.sealed : ""}`}>
        {onEdit ? (
          <button type="button" className={s.editable} aria-label={`${label} 편집`}>
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
