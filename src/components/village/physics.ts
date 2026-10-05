// Just enough physics to walk on the book (docs/DESIGN.md §9): feet follow the
// ground, small rises are stepped up, walls are slid along or veered around
// (and stop you only when there's no way past), and anything in the air falls. Rays run against a BVH of the map so a
// few per figure per frame stay cheap on ~55k faces.

import { Box3, Plane, Raycaster, Vector2, Vector3, type Camera, type Group, type Mesh, type Object3D } from "three";
import { acceleratedRaycast, computeBoundsTree } from "three-mesh-bvh";

export type Footprint = { book: Group; box: Box3 };

/** A figure's physical state: feet position and vertical speed. */
export type Body = { pos: Vector3; vy: number; grounded: boolean };

// World units. A figure stands about 0.056 tall.
export const STEP_UP = 0.022; // a good third of a figure: curbs, roots, stairs, low fences
const STEP_DOWN = STEP_UP * 1.5; // drops up to this deep are walked down, deeper ones fallen off
// Walls are felt right at step height: anything lower is stepped over, never a wall.
const KNEE = STEP_UP;
const RADIUS = 0.008; // how close a figure gets to a wall
const GRAVITY = 3.2;
const MAX_FALL = 4;
const WALL_SLOPE = 0.6; // normal.y below this is a wall (steeper than ~53°), above it ground

/** Give every map mesh a BVH. The GLTF cache shares geometry, so this runs once per mesh. */
export function accelerate(root: Object3D) {
  root.traverse((o) => {
    const m = o as Mesh;
    if (!m.isMesh || (m as { isSkinnedMesh?: boolean }).isSkinnedMesh) return;
    if (!m.geometry.boundsTree) computeBoundsTree.call(m.geometry);
    m.raycast = acceleratedRaycast;
  });
}

const ray = new Raycaster();
ray.firstHitOnly = true;
const O = new Vector3();
const DOWN = new Vector3(0, -1, 0);
const N = new Vector3();
const D = new Vector3();
const S = new Vector3();

/** Height of the first surface at or below (x, fromY, z); null over nothing. */
export function floorBelow(book: Object3D, x: number, fromY: number, z: number) {
  ray.set(O.set(x, fromY, z), DOWN);
  ray.near = 0;
  ray.far = 50;
  const hit = ray.intersectObject(book, true)[0];
  return hit ? hit.point.y : null;
}

/** Distance along a ray to the map, or null if nothing within `far`. */
export function hitDistance(book: Object3D, from: Vector3, dir: Vector3, far: number) {
  ray.set(from, dir);
  ray.near = 0;
  ray.far = far;
  return ray.intersectObject(book, true)[0]?.distance ?? null;
}

/** Flattened normal of a wall within reach ahead (at knee height), or null if the way is clear. */
function wallAhead(book: Object3D, pos: Vector3, dir: Vector3, reach: number) {
  ray.set(O.set(pos.x, pos.y + KNEE, pos.z), dir);
  ray.near = 0;
  ray.far = reach + RADIUS;
  const hit = ray.intersectObject(book, true)[0];
  if (!hit?.face) return null;
  N.copy(hit.face.normal).transformDirection(hit.object.matrixWorld);
  if (N.y > WALL_SLOPE) return null; // a gentle rise, stepped up below
  N.y = 0;
  return N.lengthSq() > 1e-6 ? N.normalize() : null;
}

/**
 * Move feet `step` along `dir` (unit, flat) if the way allows: slide along a
 * wall met at an angle, refuse to walk off the book. Returns false when stuck.
 */
export function walkStep(book: Object3D, pos: Vector3, dir: Vector3, step: number) {
  // Straight ahead, else along the wall, else veer around it (trees, posts, corners).
  D.copy(dir);
  let ok = clear(book, pos, D, step);
  if (!ok) {
    const wall = wallAhead(book, pos, D, step);
    if (wall) {
      S.copy(D).addScaledVector(wall, -D.dot(wall));
      S.y = 0;
      if (S.length() > 0.2) {
        D.copy(S.normalize());
        ok = clear(book, pos, D, step);
      }
    }
  }
  for (const turn of VEER) {
    if (ok) break;
    D.copy(dir).applyAxisAngle(UP, turn);
    ok = clear(book, pos, D, step);
  }
  if (!ok) return false;
  pos.x += D.x * step;
  pos.z += D.z * step;
  dir.copy(D);
  return true;
}

// Left and right of the way, a little then a lot (radians).
const VEER = [0.5, -0.5, 1.0, -1.0, 1.45, -1.45];

/** No wall ahead and ground under the next step (not the edge of the book). */
function clear(book: Object3D, pos: Vector3, d: Vector3, step: number) {
  if (wallAhead(book, pos, d, step)) return false;
  return floorBelow(book, pos.x + d.x * step, pos.y + STEP_UP, pos.z + d.z * step) !== null;
}

/** Stand on the ground, step up small rises, or fall. Returns the landing speed (0 if none). */
export function settle(book: Object3D, b: Body, dt: number) {
  const floor = floorBelow(book, b.pos.x, b.pos.y + STEP_UP, b.pos.z);
  if (floor === null) return 0;
  // Walking downhill or down a step keeps the feet on the ground; only a real
  // ledge (deeper than a step) turns into a fall. Otherwise every downhill
  // step would leave a figure hanging in the air for a few frames, unable to walk.
  if (b.grounded && b.pos.y - floor <= STEP_DOWN) {
    b.pos.y = floor;
    b.vy = 0;
    return 0;
  }
  if (b.pos.y > floor + 1e-3) {
    b.vy = Math.max(b.vy - GRAVITY * dt, -MAX_FALL);
    b.pos.y += b.vy * dt;
    b.grounded = false;
    if (b.pos.y > floor) return 0;
  }
  const impact = b.grounded ? 0 : -b.vy;
  b.pos.y = floor;
  b.vy = 0;
  b.grounded = true;
  return impact;
}

export function toFrac({ box }: Footprint, p: { x: number; z: number }): [number, number] {
  return [(p.x - box.min.x) / (box.max.x - box.min.x), (p.z - box.min.z) / (box.max.z - box.min.z)];
}

export function fromFrac({ box }: Footprint, [fx, fz]: [number, number], out = new Vector3()) {
  return out.set(box.min.x + (box.max.x - box.min.x) * fx, 0, box.min.z + (box.max.z - box.min.z) * fz);
}

/** The top surface under a footprint fraction (rooftops count), or the page level if nothing. */
export function groundAt(foot: Footprint, at: [number, number], out = new Vector3()) {
  fromFrac(foot, at, out);
  const y = floorBelow(foot.book, out.x, foot.box.max.y + 1, out.z);
  out.y = y ?? foot.box.min.y;
  return out;
}

const NRM = new Vector3();
const AROUND = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
] as const;

/** Top surface under (x, z) with its normal's y, or null. */
function topAt(book: Object3D, top: number, x: number, z: number) {
  ray.set(O.set(x, top, z), DOWN);
  ray.near = 0;
  ray.far = 50;
  const hit = ray.intersectObject(book, true)[0];
  if (!hit?.face) return null;
  return { y: hit.point.y, up: NRM.copy(hit.face.normal).transformDirection(hit.object.matrixWorld).y };
}

const levels = new WeakMap<Object3D, number>();

/** The height most of the village stands at: the median top surface over a grid. Cached per map. */
function groundLevel({ book, box }: Footprint) {
  const known = levels.get(book);
  if (known !== undefined) return known;
  const ys: number[] = [];
  for (let i = 0; i < 15; i++) {
    for (let j = 0; j < 15; j++) {
      const x = box.min.x + (box.max.x - box.min.x) * (0.15 + (0.7 * i) / 14);
      const z = box.min.z + (box.max.z - box.min.z) * (0.15 + (0.7 * j) / 14);
      const t = topAt(book, box.max.y + 1, x, z);
      if (t && t.up > 0.92) ys.push(t.y);
    }
  }
  ys.sort((a, b) => a - b);
  const level = ys.length ? ys[Math.floor(ys.length / 2)] : box.min.y;
  levels.set(book, level);
  return level;
}

/**
 * Open, flat ground at or near a footprint fraction: level for a few steps all
 * around, and not standing up above its surroundings (a roof, a treetop).
 * Searched in widening rings; gives the original spot back if nothing nearby
 * qualifies.
 */
export function openGroundNear(foot: Footprint, at: [number, number]): [number, number] {
  const { book, box } = foot;
  const top = box.max.y + 1;
  const sizeX = box.max.x - box.min.x;
  const sizeZ = box.max.z - box.min.z;
  const level = groundLevel(foot);
  const ok = (fx: number, fz: number) => {
    if (fx < 0.08 || fx > 0.92 || fz < 0.08 || fz > 0.92) return false;
    const x = box.min.x + sizeX * fx;
    const z = box.min.z + sizeZ * fz;
    const c = topAt(book, top, x, z);
    // Flat, and at the height of the village's ground: not down in the river,
    // not up on a roof, a bridge or the mill.
    if (!c || c.up < 0.92 || Math.abs(c.y - level) > 0.025) return false;
    const around: number[] = [];
    for (const [dx, dz] of AROUND) {
      // Level within a few steps: no walls, ledges or slopes right by you.
      const n = topAt(book, top, x + dx * 0.04, z + dz * 0.04);
      if (!n || n.up < 0.85 || Math.abs(n.y - c.y) > STEP_UP * 0.5) return false;
      // A little further out: if most of it is well below, this is the top of something.
      const far = topAt(book, top, x + dx * 0.15, z + dz * 0.15);
      if (far) around.push(far.y);
    }
    const lower = around.filter((y) => y < c.y - 0.04).length;
    return lower < 3;
  };
  if (ok(at[0], at[1])) return at;
  for (let ring = 1; ring <= 20; ring++) {
    const r = ring * 0.02;
    for (let i = 0; i < 8 + ring * 2; i++) {
      const a = (i / (8 + ring * 2)) * Math.PI * 2 + ring;
      const c: [number, number] = [at[0] + Math.cos(a) * r, at[1] + Math.sin(a) * r];
      if (ok(c[0], c[1])) return c;
    }
  }
  return at;
}

const NDC = new Vector2();
const PLANE = new Plane();
const UP = new Vector3(0, 1, 0);
const EDGE = 0.06; // keep drops this far (fraction) inside the map

/**
 * Where a dragged figure would land under the cursor. Off the map, it goes to
 * the nearest point on the map's edge instead.
 */
export function dropPointAt(foot: Footprint, camera: Camera, el: HTMLElement, cx: number, cy: number, levelY: number) {
  const r = el.getBoundingClientRect();
  NDC.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(NDC, camera);
  ray.near = 0;
  ray.far = Infinity;
  const hit = ray.intersectObject(foot.book, true)[0];
  const p = new Vector3();
  if (hit) p.copy(hit.point);
  else if (!ray.ray.intersectPlane(PLANE.setFromNormalAndCoplanarPoint(UP, O.set(0, levelY, 0)), p)) return null;
  const [fx, fz] = toFrac(foot, p);
  const clamp = (n: number) => Math.min(Math.max(n, EDGE), 1 - EDGE);
  if (hit && fx === clamp(fx) && fz === clamp(fz)) return p;
  // Off the map: walk the spot in from the clamped edge until there is ground under it.
  let at: [number, number] = [clamp(fx), clamp(fz)];
  for (let i = 0; i < 12; i++) {
    const g = groundAt(foot, at);
    if (floorBelow(foot.book, g.x, foot.box.max.y + 1, g.z) !== null) return g;
    at = [at[0] + (0.5 - at[0]) * 0.15, at[1] + (0.5 - at[1]) * 0.15];
  }
  return groundAt(foot, at);
}
