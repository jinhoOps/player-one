"use client";

import { createPortal, useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import { useEffect, useMemo, useRef, useState } from "react";
import { CatmullRomCurve3, Group, TubeGeometry, Vector3, type ShaderMaterial } from "three";
import {
  applyMorph,
  buildRig,
  CHIBI_URL,
  DEFAULT_HAIR,
  PALETTE,
  SLOT_INDEX,
  type Rig,
} from "@/lib/chibiRig";
import { isBooting, useEffectSkip, useGameEvent, useGameEvents } from "@/lib/events";
import { EQUIP_SLOTS, type EquipSlotKey, type HairStyle } from "@/lib/game";
import type { BodyMorph } from "@/lib/morph";
import { prefersReducedMotion, useOneShot } from "@/lib/motion";
import { HEADWEAR } from "./Headwear";

// Effect durations (ms), within the 1.8s cap of docs/BRAND.md.
const POP_MS = 700;
const FLASH_DELAY_MS = 600; // lands as the DOM equip flight arrives
const FLASH_MS = 900;

// Toy-like settle: overshoot a little, then rest.
const outBack = (t: number) => 1 + 2.7 * (t - 1) ** 3 + 1.7 * (t - 1) ** 2;

type Head = Rig["head"];

// ---- Head parts, built in the body's bind space and carried by the head bone ----

function Hair({ style, head, material, hidden = [] }: { style: HairStyle; head: Head; material: ShaderMaterial; hidden?: readonly string[] }) {
  const { center: c, radii: r } = head;
  const s = 1.07;
  // A shell around the skull, open over the face, falling to `drop` (0 = crown, 1 = chin).
  const shell = (drop: number) => (
    <mesh material={material} position={[c.x, c.y, c.z - r.z * 0.04]} scale={[r.x * 1.15, r.y * 1.07, r.z * 1.1]}>
      <sphereGeometry args={[1, 40, 24, Math.PI / 2 + 0.85, Math.PI * 2 - 1.7, 0, Math.PI * drop]} />
    </mesh>
  );
  return (
    <group>
      {/* Cap: top and back of the skull; the open side faces the brow. */}
      <mesh material={material} position={[c.x, c.y + r.y * 0.02, c.z - r.z * 0.03]} rotation-x={-0.5} scale={[r.x * s, r.y * s, r.z * s]}>
        <sphereGeometry args={[1, 40, 24, 0, Math.PI * 2, 0, Math.PI * 0.56]} />
      </mesh>
      {style === "bob" && shell(0.8)}
      {style === "long" && (
        <>
          {shell(0.86)}
          {/* A slab down the back to the shoulders. */}
          <mesh material={material} position={[c.x, c.y - r.y * 0.75, c.z - r.z * 0.55]} rotation-x={0.12} scale={[r.x * 1.02, r.y * 0.85, r.z * 0.42]}>
            <sphereGeometry args={[1, 32, 20]} />
          </mesh>
        </>
      )}
      {style === "ponytail" &&
        (hidden.includes("knot") ? (
          // Under a cap the tail comes out below the rim at the back.
          <mesh material={material} position={[c.x, c.y - r.y * 0.42, c.z - r.z * 1.12]} rotation-x={0.25} scale={[r.x * 0.2, r.y * 0.45, r.z * 0.2]}>
            <sphereGeometry args={[1, 20, 14]} />
          </mesh>
        ) : (
          <>
            <mesh material={material} position={[c.x, c.y + r.y * 0.15, c.z - r.z * 1.08]} scale={[r.x * 0.2, r.y * 0.2, r.z * 0.2]}>
              <sphereGeometry args={[1, 20, 14]} />
            </mesh>
            <mesh material={material} position={[c.x, c.y - r.y * 0.3, c.z - r.z * 1.18]} rotation-x={0.2} scale={[r.x * 0.2, r.y * 0.52, r.z * 0.2]}>
              <sphereGeometry args={[1, 20, 14]} />
            </mesh>
          </>
        ))}
      {style === "bun" && !hidden.includes("bun") && (
        <mesh material={material} position={[c.x, c.y + r.y * 0.98, c.z - r.z * 0.35]} scale={[r.x * 0.36, r.y * 0.3, r.z * 0.36]}>
          <sphereGeometry args={[1, 24, 16]} />
        </mesh>
      )}
    </group>
  );
}

// A short ink smile under the eyes.
function Smile({ head }: { head: Head }) {
  const geo = useMemo(() => {
    const { face, radii } = head;
    const w = radii.x * 0.1;
    const pts = [-1, -0.5, 0, 0.5, 1].map((t) => new Vector3(t * w, face.y - (1 - t * t) * w * 0.35, face.z - Math.abs(t) * w * 0.25 + 0.05));
    return new TubeGeometry(new CatmullRomCurve3(pts), 12, radii.x * 0.012, 6);
  }, [head]);
  useEffect(() => () => geo.dispose(), [geo]);
  return (
    <mesh geometry={geo}>
      <meshBasicMaterial color={PALETTE.ink} />
    </mesh>
  );
}

/**
 * The character. On the stage (`interactive`) it answers the game events:
 * the hovered slot's part glows, an equip flashes its part, and during boot
 * it pops up from the floor. Idle: breathing, a toy-like sway, blinking.
 */
export function Chibi({
  morph,
  equipped,
  interactive = false,
}: {
  morph: BodyMorph;
  equipped: Record<EquipSlotKey, boolean>;
  interactive?: boolean;
}) {
  const { scene } = useGLTF(CHIBI_URL);
  const rig = useMemo(() => buildRig(scene), [scene]);
  const [still] = useState(prefersReducedMotion);
  const root = useRef<Group>(null);
  // Per-frame writes go through a ref, like any three.js object here.
  const live = useRef<Rig | null>(null);
  const hovered = useGameEvents((s) => s.hoveredSlot);
  const pop = useOneShot();
  const flash = useOneShot();
  const flashSlot = useRef(0);

  useEffect(() => {
    live.current = rig;
    if (interactive && isBooting() && !still) pop.fire();
  }, [rig, interactive, still, pop]);

  const key = `${morph.body},${morph.height},${morph.weight},${morph.muscle}`;
  useEffect(() => {
    if (live.current) applyMorph(live.current, morph);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed by value
  }, [rig, key]);

  useGameEvent((e) => {
    if (!interactive || e.type !== "equip") return;
    flashSlot.current = SLOT_INDEX[e.slot];
    flash.fire(still ? 0 : FLASH_DELAY_MS);
  });
  useEffectSkip(() => {
    pop.finish();
    flash.finish();
  });

  useFrame(({ clock }, dt) => {
    const r = live.current;
    if (!r) return;
    const u = r.materials.body.uniforms;
    u.uEquipped.value.fromArray(EQUIP_SLOTS.map((k) => (equipped[k] ? 1 : 0)));
    const hover = interactive ? hovered : null;
    if (hover) u.uSlot.value = SLOT_INDEX[hover];
    u.uHover.value += ((hover ? 1 : 0) - u.uHover.value) * Math.min(1, dt * 10);
    const pf = flash.progress(FLASH_MS);
    u.uFlashSlot.value = flashSlot.current;
    u.uFlash.value = pf >= 0 && pf < 1 ? (1 - pf) ** 2 : 0;
    // Hair and hat belong to the head slot.
    const onHead = Math.abs(u.uSlot.value - SLOT_INDEX.head) < 0.5;
    for (const m of [r.materials.hair, r.materials.hat]) {
      m.uniforms.uLit.value = onHead ? u.uHover.value : 0;
      m.uniforms.uDim.value = onHead ? 0 : u.uHover.value;
      m.uniforms.uFlash.value = Math.abs(u.uFlashSlot.value - SLOT_INDEX.head) < 0.5 ? u.uFlash.value : 0;
    }

    const pp = pop.progress(POP_MS);
    if (root.current) root.current.scale.setScalar(pp >= 0 && pp < 1 ? Math.max(0.001, outBack(pp)) : 1);

    if (still) return;
    const t = clock.elapsedTime;
    const b = t % 4.2;
    r.materials.eyes.uniforms.uLid.value = b < 0.12 ? Math.abs(b / 0.06 - 1) * 0.9 + 0.1 : 1;
    applyMorph(r, morph, Math.sin(t * 1.6) * 0.012);
    if (root.current) root.current.rotation.z = Math.sin(t * 1.1) * 0.022;
  });

  const style = morph.hair ?? DEFAULT_HAIR[morph.body];
  // The head slot holds one kind of gear for now; more kinds come as entries in HEADWEAR.
  const gear = equipped.head ? HEADWEAR.cap : null;
  return (
    <group ref={root}>
      <primitive object={rig.model} />
      {createPortal(
        <group matrix={rig.headToBone} matrixAutoUpdate={false}>
          <Smile head={rig.head} />
          <Hair style={style} head={rig.head} material={rig.materials.hair} hidden={gear?.hides} />
          {gear?.render(rig.head, rig.materials.hat)}
        </group>,
        rig.bones.Head,
      )}
    </group>
  );
}

useGLTF.preload(CHIBI_URL);
