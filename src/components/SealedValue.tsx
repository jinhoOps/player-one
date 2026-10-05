"use client";

import { useRef, type ReactNode } from "react";
import { useSeal } from "@/lib/useSeal";
import s from "./ui.module.css";

/**
 * A value that can be sealed (made private). The owner still reads it (it only
 * squishes as it turns private); a visitor sees `placeholder` frosted over.
 */
export function SealedValue({
  sealed,
  frost,
  placeholder = "비공개 값",
  children,
}: {
  sealed?: boolean;
  /** Visitor view: blur it; the real value never reached the page, so show `placeholder`. */
  frost?: boolean;
  placeholder?: ReactNode;
  children: ReactNode;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  useSeal(ref, sealed);
  const hidden = sealed && frost;
  return (
    <span ref={ref} className={`${s.sealable} ${hidden ? s.sealed : ""}`} aria-label={hidden ? "비공개" : undefined}>
      {hidden ? <span aria-hidden>{placeholder}</span> : children}
    </span>
  );
}
