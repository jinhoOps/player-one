"use client";

import { animate, createDrawable, type JSAnimation } from "animejs";
import { useEffect, useRef, useState } from "react";
import { SLOT_STAGE_Y as PART_Y, type EquipSlotKey } from "@/lib/game";
import { useEffectSkip, useGameEvent, useGameEvents } from "@/lib/events";
import { MOTION, prefersReducedMotion } from "@/lib/motion";
import s from "./ui.module.css";


const CONFETTI = 44;
const CONFETTI_COLORS = ["var(--sun)", "var(--leaf)", "var(--sky)", "#ee7b62"];

/**
 * Screen-level DOM effects (docs/BRAND.md, Effects): a celebration for tier
 * and class changes (a soft glow in the rarity color and a confetti pop from
 * the character), the equip flight from a slot into the body, and the dotted
 * line tying a hovered slot to its body part. Any click during an epic effect
 * skips it.
 */
export function EffectLayer() {
  const root = useRef<HTMLDivElement>(null);
  const running = useRef<JSAnimation[]>([]);
  const epic = useGameEvents((st) => st.epicRunning);
  const skip = useGameEvents((st) => st.skip);
  const hovered = useGameEvents((st) => st.hoveredSlot);

  useEffect(() => {
    if (!epic) return;
    const onDown = () => skip();
    window.addEventListener("pointerdown", onDown, { capture: true });
    return () => window.removeEventListener("pointerdown", onDown, { capture: true });
  }, [epic, skip]);

  useEffectSkip(() => {
    running.current.forEach((a) => a.complete());
    running.current = [];
  });

  useGameEvent((e) => {
    const el = root.current;
    if (!el) return;
    const reduced = prefersReducedMotion();

    if (e.type === "tier-change" || e.type === "class-change") {
      const color = e.type === "tier-change" ? `var(--rarity-${e.rarity})` : "var(--sun)";
      el.style.setProperty("--burst", color);
      const glow = el.querySelector<HTMLElement>("[data-glow]")!;
      running.current = [animate(glow, { opacity: [0, 1, 0], duration: reduced ? 600 : 1400, ease: "inOutSine" })];
      if (!reduced) running.current.push(...confetti(el, color));
    }

    if (e.type === "equip") flyToBody(e.slot, reduced);
  });

  return (
    <div ref={root} className={s.fx} aria-hidden>
      <div data-glow className={s.fxGlow} />
      {hovered && <SlotLink key={hovered} slot={hovered} />}
    </div>
  );
}

// Confetti pops up from the character's shoulders, tumbles and falls away.
function confetti(layer: HTMLElement, lead: string): JSAnimation[] {
  const stage = document.querySelector("[data-stage]")?.getBoundingClientRect();
  const x0 = stage ? stage.left + stage.width / 2 : window.innerWidth / 2;
  const y0 = stage ? stage.top + stage.height * 0.45 : window.innerHeight / 2;
  return Array.from({ length: CONFETTI }, (_, i) => {
    const bit = document.createElement("span");
    bit.className = s.confetti;
    bit.style.left = `${x0}px`;
    bit.style.top = `${y0}px`;
    bit.style.background = i % 3 === 0 ? lead : CONFETTI_COLORS[i % CONFETTI_COLORS.length];
    layer.appendChild(bit);
    const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 0.9;
    const speed = 160 + Math.random() * 200;
    const dx = Math.cos(angle) * speed;
    const up = Math.sin(angle) * speed;
    return animate(bit, {
      x: [0, dx * 0.7, dx],
      y: [0, up, up + 260 + Math.random() * 120],
      rotate: [0, (Math.random() - 0.5) * 720],
      opacity: [1, 1, 0],
      duration: 1300 + Math.random() * 300,
      ease: "outQuad",
      onComplete: () => bit.remove(),
    });
  });
}

// Hover: a dotted line from the slot's edge to its body part draws itself in.
function SlotLink({ slot }: { slot: EquipSlotKey }) {
  const line = useRef<SVGLineElement>(null);
  const [ends, setEnds] = useState<[number, number, number, number] | null>(null);

  useEffect(() => {
    const from = document.querySelector(`[data-slot="${slot}"]`)?.getBoundingClientRect();
    const stage = document.querySelector("[data-stage]")?.getBoundingClientRect();
    if (!from || !stage) return;
    // The rail sits on the stage edge: from a side rail the line leaves the
    // slot's inner side, from the bottom rail (mobile) its top.
    const cx = stage.left + stage.width / 2;
    const tx = cx - 18;
    const ty = stage.top + stage.height * PART_Y[slot];
    const sideRail = from.right < tx - 24;
    const start: [number, number] = sideRail
      ? [from.right, from.top + from.height / 2]
      : [from.left + from.width / 2, from.top];
    const id = requestAnimationFrame(() => setEnds([...start, sideRail ? tx : cx, ty]));
    return () => cancelAnimationFrame(id);
  }, [slot]);

  useEffect(() => {
    if (!line.current || !ends || prefersReducedMotion()) return;
    const a = animate(createDrawable(line.current), { draw: ["0 0", "0 1"], ...MOTION.quick });
    return () => {
      a.revert();
    };
  }, [ends]);

  if (!ends) return null;
  const [x1, y1, x2, y2] = ends;
  return (
    <svg className={s.fxLink}>
      <line ref={line} x1={x1} y1={y1} x2={x2} y2={y2} />
      <circle cx={x2} cy={y2} r={2.5} />
    </svg>
  );
}

// The slot's icon leaves a ghost that arcs into its body part, shrinking as it lands.
function flyToBody(slot: EquipSlotKey, reduced: boolean) {
  const from = document.querySelector<HTMLElement>(`[data-slot="${slot}"]`);
  const stage = document.querySelector<HTMLElement>("[data-stage]");
  if (!from || !stage) return;
  if (reduced) {
    animate(from, { opacity: [0.3, 1], ...MOTION.base });
    return;
  }
  const a = from.getBoundingClientRect();
  const b = stage.getBoundingClientRect();
  const start = { x: a.left + a.width / 2, y: a.top + a.height / 2 };
  const end = { x: b.left + b.width / 2, y: b.top + b.height * PART_Y[slot] };
  const ctrl = { x: (start.x + end.x) / 2, y: Math.min(start.y, end.y) - 120 };

  const ghost = from.cloneNode(true) as HTMLElement;
  ghost.removeAttribute("data-slot");
  ghost.setAttribute("aria-hidden", "true");
  Object.assign(ghost.style, {
    position: "fixed",
    left: `${start.x - a.width / 2}px`,
    top: `${start.y - a.height / 2}px`,
    margin: "0",
    pointerEvents: "none",
    zIndex: "60",
    borderColor: "var(--sun)",
    boxShadow: "0 0 0 4px color-mix(in srgb, var(--sun) 35%, transparent), 0 10px 24px rgba(92, 64, 40, 0.2)",
  });
  document.body.appendChild(ghost);

  const t = { p: 0 };
  animate(t, {
    p: 1,
    duration: 720,
    ease: "inOutQuad",
    onUpdate: () => {
      const u = 1 - t.p;
      // Quadratic Bézier from the slot, over the arc, into the body part.
      const x = u * u * start.x + 2 * u * t.p * ctrl.x + t.p * t.p * end.x;
      const y = u * u * start.y + 2 * u * t.p * ctrl.y + t.p * t.p * end.y;
      ghost.style.transform = `translate(${x - start.x}px, ${y - start.y}px) scale(${1 - 0.7 * t.p})`;
      ghost.style.opacity = String(1 - t.p * t.p);
    },
    onComplete: () => ghost.remove(),
  });
}
