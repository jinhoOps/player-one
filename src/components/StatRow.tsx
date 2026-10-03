"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { rollNumber } from "@/lib/motion";
import s from "./hud.module.css";

type Props = {
  label: string;
  value: number | null | undefined;
  unit: string;
  digits?: number;
  /** Gauge range; omit to hide the bar. */
  range?: [number, number];
  sealed?: boolean;
  trailing?: ReactNode;
};

// Delta color is always neutral (accent): a weight gain may be someone's goal.
export function StatRow({ label, value, unit, digits = 1, range, sealed, trailing }: Props) {
  const ref = useRef<HTMLSpanElement>(null);
  const prev = useRef(value);
  const [delta, setDelta] = useState<{ v: number; id: number } | null>(null);

  useEffect(() => {
    const from = prev.current;
    prev.current = value;
    if (ref.current && from != null && value != null && from !== value) {
      rollNumber(ref.current, from, value, digits);
      setDelta({ v: value - from, id: Date.now() });
    }
  }, [value, digits]);

  const ratio = range && value != null ? Math.min(1, Math.max(0, (value - range[0]) / (range[1] - range[0]))) : 0;

  return (
    <div className={s.statRow}>
      <span className="label">{label}</span>
      <span className={`num ${s.statValue} ${sealed ? s.sealed : ""}`}>
        <span ref={ref}>{value != null ? value.toFixed(digits) : "—"}</span>
        {delta && (
          <span key={delta.id} className={`num ${s.delta}`}>
            {delta.v > 0 ? "+" : ""}
            {delta.v.toFixed(digits)}
            {unit}
          </span>
        )}
      </span>
      <span className={s.statUnit}>
        {unit} {trailing}
      </span>
      {range && (
        <div className={s.gauge}>
          <div className={s.gaugeFill} style={{ transform: `scaleX(${ratio})` }} />
        </div>
      )}
    </div>
  );
}
