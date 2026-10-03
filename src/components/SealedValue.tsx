"use client";

import { useRef, type ReactNode } from "react";
import { useSeal } from "@/lib/useSeal";
import s from "./ui.module.css";

/** Owner view: wraps a value that can be sealed (made private). */
export function SealedValue({ sealed, children }: { sealed?: boolean; children: ReactNode }) {
  const ref = useRef<HTMLSpanElement>(null);
  useSeal(ref, sealed);
  return (
    <span ref={ref} className={`${s.sealable} ${sealed ? s.sealed : ""}`}>
      {children}
    </span>
  );
}
