import { BufferAttribute, BufferGeometry } from "three";
import type { HairStyle } from "./game";
import type { BodyMorph } from "./morph";

/**
 * Procedural SD (super-deformed, ~2.5 heads tall) character: a signed distance
 * field of smoothly blended round cones and ellipsoids, meshed with surface
 * nets into one seamless skin. Body type picks shoulder/hip balance and the
 * default hairstyle; height, weight and muscle swell or stretch the body,
 * never the head.
 *
 * Units are arbitrary (about 1 tall), feet at y=0, facing +z. Equipment regions
 * are horizontal bands (`bands`) cut in the shader, so highlights get clean
 * edges whatever the mesh does. Two 0/1 masks override the bands: `arm`
 * (top above the wrist, bare skin below) and `hair` (always head). They are
 * separate attributes because interpolating one categorical id would pass
 * through the ids in between along every boundary.
 */

export const SLOT_INDEX = { head: 1, top: 2, bottom: 3, shoes: 4 } as const;

const DEFAULT_HAIR: Record<BodyMorph["body"], HairStyle> = { female: "bob", male: "short", neutral: "short" };

export type V3 = [number, number, number];
type SDF = (x: number, y: number, z: number) => number;

function roundCone(a: V3, b: V3, r1: number, r2: number): SDF {
  // Inigo Quilez, sdRoundCone between two points.
  const bax = b[0] - a[0], bay = b[1] - a[1], baz = b[2] - a[2];
  const l2 = bax * bax + bay * bay + baz * baz;
  const rr = r1 - r2;
  const a2 = l2 - rr * rr;
  const il2 = 1 / l2;
  return (x, y, z) => {
    const pax = x - a[0], pay = y - a[1], paz = z - a[2];
    const yv = pax * bax + pay * bay + paz * baz;
    const zv = yv - l2;
    const qx = pax * l2 - bax * yv, qy = pay * l2 - bay * yv, qz = paz * l2 - baz * yv;
    const x2 = qx * qx + qy * qy + qz * qz;
    const y2 = yv * yv * l2;
    const z2 = zv * zv * l2;
    const k = Math.sign(rr) * rr * rr * x2;
    if (Math.sign(zv) * a2 * z2 > k) return Math.sqrt(x2 + z2) * il2 - r2;
    if (Math.sign(yv) * a2 * y2 < k) return Math.sqrt(x2 + y2) * il2 - r1;
    return (Math.sqrt(x2 * a2 * il2) + yv * rr) * il2 - r1;
  };
}

function ellipsoid(c: V3, r: V3): SDF {
  return (x, y, z) => {
    const px = x - c[0], py = y - c[1], pz = z - c[2];
    const k0 = Math.hypot(px / r[0], py / r[1], pz / r[2]);
    const k1 = Math.hypot(px / (r[0] * r[0]), py / (r[1] * r[1]), pz / (r[2] * r[2]));
    return k1 === 0 ? -Math.min(r[0], r[1], r[2]) : (k0 * (k0 - 1)) / k1;
  };
}

function smin(a: number, b: number, k: number) {
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - h * h * k * 0.25;
}

const smax = (a: number, b: number, k: number) => -smin(-a, -b, k);

type Group = { prims: SDF[]; k: number[] };

function blend(g: Group, x: number, y: number, z: number) {
  let d = g.prims[0](x, y, z);
  for (let i = 1; i < g.prims.length; i++) d = smin(d, g.prims[i](x, y, z), g.k[i]);
  return d;
}

const SHAPE = {
  female: { shoulders: 0.92, hips: 1.08 },
  male: { shoulders: 1.1, hips: 0.94 },
  neutral: { shoulders: 1, hips: 1 },
};

function hair(style: HairStyle, headY: number): SDF {
  // A cap over the skull, cut by a plane that rises toward the face (fringe).
  const capShell = ellipsoid([0, headY + 0.04, -0.012], [0.238, 0.215, 0.226]);
  // The hairline sits at the brows in front and drops past the ears to the
  // nape. Smooth max rounds it instead of leaving a jagged crease.
  const cap: SDF = (x, y, z) => smax(capShell(x, y, z), headY - 0.05 + 0.4 * z - y, 0.03);
  // A fuller shell hanging to `bottom`, with the face carved out under the bangs.
  const hanging = (center: V3, radii: V3, bottom: number): SDF => {
    const shell = ellipsoid(center, radii);
    return (x, y, z) => smax(smax(shell(x, y, z), Math.min(z - 0.04, headY + 0.03 - y), 0.012), bottom - y, 0.02);
  };
  const union = (...parts: SDF[]): SDF => (x, y, z) => Math.min(...parts.map((p) => p(x, y, z)));

  switch (style) {
    case "short":
      return cap;
    case "bob":
      return union(cap, hanging([0, headY - 0.04, -0.035], [0.255, 0.235, 0.225], headY - 0.235));
    case "long":
      return union(cap, hanging([0, headY - 0.08, -0.05], [0.252, 0.29, 0.225], headY - 0.33));
    case "ponytail":
      return union(
        cap,
        ellipsoid([0, headY + 0.07, -0.205], [0.04, 0.036, 0.036]), // tie
        roundCone([0, headY + 0.06, -0.235], [0, headY - 0.17, -0.27], 0.058, 0.026),
      );
    case "bun":
      return union(cap, ellipsoid([0, headY + 0.205, -0.045], [0.074, 0.068, 0.07]));
  }
}

// Cuteness follows the baby schema, kept minimal: a big round head (about
// 40% of the height) on a small body, two plain eyes set wide just below the
// midline, a short smile, thin arms held slightly out, round hands and shoes.
const HEAD: V3 = [0.215, 0.195, 0.195];

function makeBody(m: BodyMorph) {
  const hgt = m.height ?? 0, wt = m.weight ?? 0, mu = m.muscle ?? 0;
  const { shoulders, hips } = SHAPE[m.body];

  const fat = 1 + wt * 0.35;
  const legLen = 0.14 * (1 + hgt * 0.3);
  const torsoLen = 0.16 * (1 + hgt * 0.12);
  const hipY = 0.05 + legLen;
  const neckY = hipY + torsoLen;
  const headY = neckY + 0.175; // the head sits right on the shoulders
  const sx = 0.078 * shoulders * (1 + wt * 0.2 + mu * 0.15);
  // Arms hang a little away from the body, wider still on a heavier one.
  const reach = 0.075 + Math.max(0, wt) * 0.04;
  const limb = 1 + wt * 0.3 + mu * 0.3;

  const hairSdf = hair(m.hair ?? DEFAULT_HAIR[m.body], headY);
  const core: Group = {
    prims: [
      ellipsoid([0, hipY + 0.025, 0], [0.088 * hips * fat, 0.06, 0.072 * fat]), // pelvis
      ellipsoid([0, hipY + torsoLen * 0.45, 0.008], [0.088 * (1 + wt * 0.45), 0.075, 0.075 * (1 + wt * 0.6)]), // belly
      ellipsoid([0, neckY - 0.045, 0], [0.08 * shoulders * (1 + wt * 0.25 + mu * 0.2), 0.06, 0.065 * fat]), // chest
      roundCone([0, neckY - 0.02, 0], [0, neckY + 0.03, 0], 0.035, 0.035), // neck, hidden under the head
      ellipsoid([0, headY, 0], HEAD), // head
      hairSdf,
    ],
    k: [0, 0.06, 0.06, 0.04, 0.04, 0.035],
  };

  const side = (s: number): Group[] => [
    {
      prims: [
        ellipsoid([s * sx, neckY - 0.03, 0], [0.032 * (1 + mu * 0.35), 0.032, 0.032 * (1 + mu * 0.25)]), // shoulder
        roundCone([s * sx, neckY - 0.035, 0], [s * (sx + reach), neckY - 0.13, 0.015], 0.028 * limb, 0.025 * limb),
        ellipsoid([s * (sx + reach + 0.008), neckY - 0.152, 0.02], [0.034, 0.036, 0.034]), // round hand
      ],
      k: [0, 0.03, 0.02],
    },
    {
      prims: [
        roundCone([s * 0.044 * hips, hipY, 0], [s * 0.048, 0.06, 0], 0.042 * limb, 0.038 * limb),
        ellipsoid([s * 0.05, 0.038, 0.022], [0.05, 0.038, 0.074]), // chunky shoe
      ],
      k: [0, 0.03],
    },
  ];
  const [armL, legL] = side(-1);
  const [armR, legR] = side(1);
  const limbs = [
    { g: armL, k: 0.03 },
    { g: armR, k: 0.03 },
    { g: legL, k: 0.05 },
    { g: legR, k: 0.05 },
  ];

  // Limbs blend into the core only and meet each other with a hard min, so the
  // legs and the arms hanging by the belly never fuse.
  const sdf: SDF = (x, y, z) => {
    const c = blend(core, x, y, z);
    let d = Infinity;
    for (const { g, k } of limbs) d = Math.min(d, smin(c, blend(g, x, y, z), k));
    return d;
  };
  // Generous on purpose: the mask's ragged edge lands on bare skin, and the
  // shader draws the real hairline per pixel (outside the head ellipsoid).
  const isHair = (x: number, y: number, z: number) => hairSdf(x, y, z) < 0.025;
  const isArm = (x: number, y: number, z: number) => {
    const arm = Math.min(blend(armL, x, y, z), blend(armR, x, y, z));
    return arm < blend(core, x, y, z) && arm < Math.min(blend(legL, x, y, z), blend(legR, x, y, z));
  };

  // Face decals sit on the real surface: march in along the head normal.
  const onSurface = (x: number, y: number): FacePoint => {
    const dy = y - headY;
    const nz = Math.sqrt(Math.max(0, 1 - (x / HEAD[0]) ** 2 - (dy / HEAD[1]) ** 2));
    const n: V3 = [x / HEAD[0] ** 2, dy / HEAD[1] ** 2, (nz * HEAD[2]) / HEAD[2] ** 2];
    const l = Math.hypot(...n);
    const dir: V3 = [n[0] / l, n[1] / l, n[2] / l];
    let p: V3 = [x, y, HEAD[2] * nz + 0.05];
    for (let i = 0; i < 24; i++) {
      const d = sdf(...p);
      if (Math.abs(d) < 0.0005) break;
      p = [p[0] - dir[0] * d, p[1] - dir[1] * d, p[2] - dir[2] * d];
    }
    return { p, n: dir };
  };
  const face = {
    eyes: [-1, 1].map((s) => onSurface(s * 0.09, headY - 0.03)),
    mouth: [-0.02, 0, 0.02].map((x, i) => onSurface(x, headY - 0.092 - (i === 1 ? 0.009 : 0)).p),
  };

  const bands = { ankle: 0.072, waist: hipY + 0.035, neck: neckY + 0.01, wrist: neckY - 0.12 };
  const head = { center: [0, headY, 0] as V3, radii: HEAD };
  return { sdf, isHair, isArm, face, bands, head, top: headY + 0.3 };
}

const CELL = 0.0085;

export type BodyBands = { ankle: number; waist: number; neck: number; wrist: number };
export type FacePoint = { p: V3; n: V3 };
export type Face = { eyes: FacePoint[]; mouth: V3[] };
export type BodyMesh = { geometry: BufferGeometry; face: Face; bands: BodyBands; head: { center: V3; radii: V3 } };

export function buildBody(morph: BodyMorph): BodyMesh {
  const { sdf, isHair, isArm, face, bands, head, top } = makeBody(morph);
  // A box that hugs the figure, symmetric in x.
  const min: V3 = [-0.34, -0.012, -0.32];
  const max: V3 = [0.34, top, 0.3];
  const nx = Math.ceil((max[0] - min[0]) / CELL) + 1;
  const ny = Math.ceil((max[1] - min[1]) / CELL) + 1;
  const nz = Math.ceil((max[2] - min[2]) / CELL) + 1;
  const [ox, oy, oz] = min;
  const idx = (i: number, j: number, k: number) => i + nx * (j + ny * k);

  // The body is symmetric too: sample one half and mirror. Far from the
  // surface, the distance bounds the next samples, so skip ahead storing lower
  // bounds; only signs and near-surface values feed the mesh.
  const field = new Float32Array(nx * ny * nz);
  const half = Math.ceil(nx / 2);
  for (let k = 0; k < nz; k++)
    for (let j = 0; j < ny; j++)
      for (let i = 0; i < half; ) {
        const d = sdf(ox + i * CELL, oy + j * CELL, oz + k * CELL);
        const ad = Math.abs(d);
        const steps = Math.max(1, Math.floor(ad / CELL) - 1);
        for (let s = 0; s < steps && i < half; s++, i++) {
          const v = Math.sign(d) * (ad - s * CELL);
          field[idx(i, j, k)] = v;
          field[idx(nx - 1 - i, j, k)] = v;
        }
      }

  // One vertex per sign-changing cell, at the mean of its edge crossings.
  const cellVert = new Int32Array(nx * ny * nz).fill(-1);
  const pos: number[] = [];
  const EDGES = [
    [0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7],
  ];
  const corner = new Float32Array(8);
  for (let k = 0; k < nz - 1; k++)
    for (let j = 0; j < ny - 1; j++)
      for (let i = 0; i < nx - 1; i++) {
        let mask = 0;
        for (let c = 0; c < 8; c++) {
          const v = field[idx(i + (c & 1), j + ((c >> 1) & 1), k + ((c >> 2) & 1))];
          corner[c] = v;
          if (v < 0) mask |= 1 << c;
        }
        if (mask === 0 || mask === 255) continue;
        let sx = 0, sy = 0, sz = 0, n = 0;
        for (const [a, b] of EDGES) {
          const va = corner[a], vb = corner[b];
          if (va < 0 === vb < 0) continue;
          const t = va / (va - vb);
          sx += (a & 1) + ((b & 1) - (a & 1)) * t;
          sy += ((a >> 1) & 1) + (((b >> 1) & 1) - ((a >> 1) & 1)) * t;
          sz += ((a >> 2) & 1) + (((b >> 2) & 1) - ((a >> 2) & 1)) * t;
          n++;
        }
        cellVert[idx(i, j, k)] = pos.length / 3;
        pos.push(ox + (i + sx / n) * CELL, oy + (j + sy / n) * CELL, oz + (k + sz / n) * CELL);
      }

  // A quad around every sign-changing grid edge, wound outward.
  const index: number[] = [];
  const quad = (a: number, b: number, c: number, d: number, flip: boolean) => {
    if (a < 0 || b < 0 || c < 0 || d < 0) return;
    if (flip) index.push(a, c, b, a, d, c);
    else index.push(a, b, c, a, c, d);
  };
  const cv = (a: number, b: number, c: number) => cellVert[idx(a, b, c)];
  for (let k = 1; k < nz - 1; k++)
    for (let j = 1; j < ny - 1; j++)
      for (let i = 1; i < nx - 1; i++) {
        const inside = field[idx(i, j, k)] < 0;
        if (inside !== field[idx(i + 1, j, k)] < 0)
          quad(cv(i, j - 1, k - 1), cv(i, j, k - 1), cv(i, j, k), cv(i, j - 1, k), !inside);
        if (inside !== field[idx(i, j + 1, k)] < 0)
          quad(cv(i - 1, j, k - 1), cv(i - 1, j, k), cv(i, j, k), cv(i, j, k - 1), !inside);
        if (inside !== field[idx(i, j, k + 1)] < 0)
          quad(cv(i - 1, j - 1, k), cv(i, j - 1, k), cv(i, j, k), cv(i - 1, j, k), !inside);
      }

  // Normals from the field gradient: smoother than face normals at this density.
  const count = pos.length / 3;
  const normal = new Float32Array(count * 3);
  const hair = new Float32Array(count);
  const arm = new Float32Array(count);
  const e = 0.002;
  for (let v = 0; v < count; v++) {
    const x = pos[v * 3], y = pos[v * 3 + 1], z = pos[v * 3 + 2];
    const gx = sdf(x + e, y, z) - sdf(x - e, y, z);
    const gy = sdf(x, y + e, z) - sdf(x, y - e, z);
    const gz = sdf(x, y, z + e) - sdf(x, y, z - e);
    const l = Math.hypot(gx, gy, gz) || 1;
    normal[v * 3] = gx / l;
    normal[v * 3 + 1] = gy / l;
    normal[v * 3 + 2] = gz / l;
    hair[v] = isHair(x, y, z) ? 1 : 0;
    arm[v] = hair[v] ? 0 : isArm(x, y, z) ? 1 : 0;
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(new Float32Array(pos), 3));
  geometry.setAttribute("normal", new BufferAttribute(normal, 3));
  geometry.setAttribute("hair", new BufferAttribute(hair, 1));
  geometry.setAttribute("arm", new BufferAttribute(arm, 1));
  geometry.setIndex(index);
  geometry.computeBoundingSphere();
  return { geometry, face, bands, head };
}
