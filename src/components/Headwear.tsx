import type { ReactNode } from "react";
import { Vector2, type ShaderMaterial } from "three";
import type { Rig } from "@/lib/chibiRig";
import type { HeadKind } from "@/lib/gear";

// Head slot gear (docs/DESIGN.md §8). Each kind is built in the head's bind
// space from the skull's center and radii, and rides on the head bone. A new
// kind is one entry here. `hides` lists hair parts it covers (a top bun, a
// high ponytail's knot); its shell must stay outside the widest hair (bob).

type Head = Rig["head"];
type Gear = { label: string; hides?: ("bun" | "knot")[]; render: (head: Head, material: ShaderMaterial) => ReactNode };

// The cap's rim runs from the brow in front (the bill shades the eyes) to just
// above the ears at the back: on the skull's sphere, a cap of 0.49π tilted back 0.13.
const TILT = -0.13;
const CROWN = Math.PI * 0.49;

function Cap(head: Head, material: ShaderMaterial) {
  const { center: c, radii: r } = head;
  const rimY = Math.cos(CROWN);
  const rimR = Math.sin(CROWN);
  return (
    <group position={[c.x, c.y + r.y * 0.02, c.z - r.z * 0.03]} rotation-x={TILT} scale={[r.x * 1.19, r.y * 1.12, r.z * 1.15]}>
      {/* Crown: hugs the hair; hair still shows under the rim at the sides and back. */}
      <mesh material={material}>
        <sphereGeometry args={[1, 40, 20, 0, Math.PI * 2, 0, CROWN]} />
      </mesh>
      {/* Band: gives the rim some thickness. */}
      <mesh material={material} position-y={rimY} rotation-x={Math.PI / 2}>
        <torusGeometry args={[rimR, 0.045, 10, 48]} />
      </mesh>
      {/* Button on top. */}
      <mesh material={material} position-y={1} scale={0.08}>
        <sphereGeometry args={[1, 12, 8]} />
      </mesh>
      {/* Bill: a half disc from the front of the rim, leveled out against the tilt and dipping a touch. */}
      <mesh material={material} position={[0, rimY - 0.03, rimR * 0.84]} rotation-x={-TILT + 0.26} scale={[0.6, 0.065, 0.5]}>
        <cylinderGeometry args={[1, 1, 1, 24, 1, false, -Math.PI / 2, Math.PI]} />
      </mesh>
    </group>
  );
}

// The beanie sits lower than the cap all round (over the tops of the ears) and
// tilts back a little more so the front stays above the brows. Folded cuff at
// the rim, pom-pom on top.
const BEANIE_TILT = -0.18;
const BEANIE_CROWN = Math.PI * 0.53;

function Beanie(head: Head, material: ShaderMaterial) {
  const { center: c, radii: r } = head;
  const rimY = Math.cos(BEANIE_CROWN);
  const rimR = Math.sin(BEANIE_CROWN);
  return (
    <group position={[c.x, c.y + r.y * 0.03, c.z - r.z * 0.04]} rotation-x={BEANIE_TILT} scale={[r.x * 1.2, r.y * 1.14, r.z * 1.17]}>
      <mesh material={material}>
        <sphereGeometry args={[1, 40, 20, 0, Math.PI * 2, 0, BEANIE_CROWN]} />
      </mesh>
      {/* Cuff: a thick roll just above the rim. */}
      <mesh material={material} position-y={rimY + 0.07} rotation-x={Math.PI / 2}>
        <torusGeometry args={[rimR * 1.01, 0.085, 12, 48]} />
      </mesh>
      <mesh material={material} position-y={1.03} scale={0.19}>
        <icosahedronGeometry args={[1, 1]} />
      </mesh>
    </group>
  );
}

// The bucket hat: a shallow, slightly flattened crown and a brim that slopes
// down all the way round (a lathed band, so it has thickness from every side).
const BUCKET_CROWN = Math.PI * 0.5;
const BUCKET_BRIM = (() => {
  const rimR = Math.sin(BUCKET_CROWN);
  const out = rimR * 1.28;
  return [
    [rimR * 0.98, 0.02],
    [out, -0.13],
    [out, -0.17],
    [rimR * 0.98, -0.04],
  ].map(([x, y]) => new Vector2(x, y));
})();

function Bucket(head: Head, material: ShaderMaterial) {
  const { center: c, radii: r } = head;
  const rimY = Math.cos(BUCKET_CROWN);
  return (
    <group position={[c.x, c.y + r.y * 0.04, c.z - r.z * 0.03]} rotation-x={-0.1} scale={[r.x * 1.19, r.y * 1.12, r.z * 1.16]}>
      <mesh material={material}>
        <sphereGeometry args={[1, 40, 20, 0, Math.PI * 2, 0, BUCKET_CROWN]} />
      </mesh>
      <mesh material={material} position-y={rimY}>
        <latheGeometry args={[[...BUCKET_BRIM, BUCKET_BRIM[0]], 48]} />
      </mesh>
    </group>
  );
}

// Keys match GEAR_KINDS.head (src/lib/gear.ts); labels live there.
export const HEADWEAR = {
  cap: { label: "캡", hides: ["bun", "knot"], render: Cap },
  beanie: { label: "비니", hides: ["bun", "knot"], render: Beanie },
  bucket: { label: "버킷햇", hides: ["bun", "knot"], render: Bucket },
} satisfies Record<HeadKind, Gear>;
export type HeadwearKind = keyof typeof HEADWEAR;
