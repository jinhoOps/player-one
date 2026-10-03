import type { ReactNode } from "react";
import type { ShaderMaterial } from "three";
import type { Rig } from "@/lib/chibiRig";

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

export const HEADWEAR = {
  cap: { label: "모자", hides: ["bun", "knot"], render: Cap },
} satisfies Record<string, Gear>;
export type HeadwearKind = keyof typeof HEADWEAR;
