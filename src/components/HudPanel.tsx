import type { ReactNode } from "react";
import s from "./hud.module.css";

export function HudPanel({ label, children, className }: { label?: string; children: ReactNode; className?: string }) {
  return (
    <section className={`${s.panel} ${className ?? ""}`}>
      <span className={`${s.bracket} ${s.tl}`} />
      <span className={`${s.bracket} ${s.tr}`} />
      <span className={`${s.bracket} ${s.bl}`} />
      <span className={`${s.bracket} ${s.br}`} />
      {label && <span className={`label ${s.panelLabel}`}>{label}</span>}
      {children}
    </section>
  );
}
