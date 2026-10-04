// Just enough physics to walk on the book (docs/DESIGN.md §9): feet follow the
// ground, small rises are stepped up, walls stop you (or you slide along
// them), and anything in the air falls. Rays run against a BVH of the map so a
// few per figure per frame stay cheap on ~55k faces.

import { Box3, Plane, Raycaster, Vector2, Vector3, type Camera, type Group, type Mesh, type Object3D } from "three";
import { acceleratedRaycast, computeBoundsTree } from "three-mesh-bvh";

export type Footprint = { book: Group; box: Box3 };

/** A figure's physical state: feet position and vertical speed. */
export type Body = { pos: Vector3; vy: number; grounded: boolean };

// World units. A figure stands about 0.19 tall.
export const STEP_UP = 0.035; // a curb, a stair: stepped over without a jump
const KNEE = 0.025; // walls are felt at this height
const RADIUS = 0.03; // how close a figure gets to a wall
const GRAVITY = 3.2;
const MAX_FALL = 4;
const WALL_SLOPE = 0.75; // normal.y below this is a wall, above it ground

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
  D.copy(dir);
  const wall = wallAhead(book, pos, D, step);
  if (wall) {
    S.copy(D).addScaledVector(wall, -D.dot(wall));
    S.y = 0;
    if (S.length() < 0.3) return false; // head-on
    D.copy(S.normalize());
    if (wallAhead(book, pos, D, step)) return false; // a corner
  }
  const nx = pos.x + D.x * step;
  const nz = pos.z + D.z * step;
  if (floorBelow(book, nx, pos.y + STEP_UP, nz) === null) return false; // the edge of the book
  pos.x = nx;
  pos.z = nz;
  dir.copy(D);
  return true;
}

/** Stand on the ground, step up small rises, or fall. Returns the landing speed (0 if none). */
export function settle(book: Object3D, b: Body, dt: number) {
  const floor = floorBelow(book, b.pos.x, b.pos.y + STEP_UP, b.pos.z);
  if (floor === null) return 0;
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
