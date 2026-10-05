"use client";

// The village map (docs/DESIGN.md §9): "Medieval Fantasy Book" by Pixel
// (CC-BY-4.0). Players stand on its pages as chibis; right click the ground to
// walk there, hold your own figure to pick it up and drop it somewhere else.
// Head labels (class emblem + name, speech bubble) are a DOM overlay that
// follows each head on screen. Light follows the Korea clock.

import { Canvas, useFrame, useThree, type ThreeElements, type ThreeEvent } from "@react-three/fiber";
import { OrbitControls, useAnimations, useGLTF } from "@react-three/drei";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { Box3, Color, Group, Mesh, MeshBasicMaterial, Object3D, TOUCH, Vector3 } from "three";
import { BASE_PATH } from "@/lib/basePath";
import { TOY_TINT } from "@/lib/chibiRig";
import { PHASES, type Phase } from "@/lib/daylight";
import type { Bubble, Villager } from "@/lib/useVillage";
import { ClassEmblem } from "../ClassEmblem";
import { Chibi } from "../Chibi";
import {
  accelerate,
  hitDistance,
  openGroundNear,
  dropPointAt,
  fromFrac,
  groundAt,
  settle,
  toFrac,
  walkStep,
  type Body,
  type Footprint,
} from "./physics";
import x from "./village.module.css";

export const BOOK_URL = `${BASE_PATH}/models/book/scene.gltf`;
const BOOK_WIDTH = 4;
const FIGURE_SCALE = 0.07; // a figure stands ~1/70 of the book's width
const WALK_SPEED = 0.3; // world units per second
const ARRIVE = 0.003; // close enough to the target
const STUCK_S = 1.5; // no closer to the target for this long: stop there
const STEP_RATE = 12; // walk-cycle radians per second (a step every ~0.26 s)
const HOLD_MS = 350; // press on your own figure this long to pick it up
const LIFT = 0.045; // how high a picked-up figure dangles over the drop spot
const SKY = "#4f9bd9"; // --sky: neutral markers (docs/BRAND.md §3)

type Anchors = Map<string, Object3D>;
/** Your figure in hand: where it would land, and the spot it was just dropped on. */
type Carry = { point: Vector3 | null; drop: [number, number] | null };

function Book({
  onReady,
  onPick,
  onTap,
}: {
  onReady: (f: Footprint) => void;
  onPick: (p: Vector3) => void;
  onTap: () => void;
}) {
  const { scene, animations } = useGLTF(BOOK_URL);
  const root = useRef<Group>(null);
  const model = useMemo(() => {
    const m = scene.clone(true);
    accelerate(m);
    const box = new Box3().setFromObject(m);
    const size = box.getSize(new Vector3());
    const k = BOOK_WIDTH / Math.max(size.x, size.z);
    m.scale.setScalar(k);
    const c = box.getCenter(new Vector3());
    m.position.set(-c.x * k, -box.min.y * k, -c.z * k);
    return m;
  }, [scene]);
  const { actions } = useAnimations(animations, root);
  useEffect(() => {
    Object.values(actions).forEach((a) => a?.play());
  }, [actions]);
  useEffect(() => {
    const g = root.current;
    if (!g) return;
    g.updateMatrixWorld(true);
    onReady({ book: g, box: new Box3().setFromObject(g) });
  }, [onReady]);

  // A right click (not a drag) on fairly flat ground is a place to walk to.
  // Left click and drag turn the camera; touch has no right click, so a tap walks.
  const walk = (e: ThreeEvent<MouseEvent>) => {
    if (e.delta > 6 || !e.face) return;
    const n = e.face.normal.clone().transformDirection(e.object.matrixWorld);
    if (n.y < 0.75) return;
    e.stopPropagation();
    onPick(e.point.clone());
  };
  const click = (e: ThreeEvent<MouseEvent>) => {
    if ((e.nativeEvent as PointerEvent).pointerType === "touch") walk(e);
    else if (e.delta <= 6) onTap();
  };
  return (
    <group ref={root} onClick={click} onContextMenu={walk}>
      <primitive object={model} />
    </group>
  );
}

/** What you can do to another villager: hover, left click to @mention, right click for the menu. */
type Act = {
  hover: (key: string | null) => void;
  mention: (v: Villager) => void;
  menu: (v: Villager, clientX: number, clientY: number) => void;
};

/** Your own figure: it can be picked up, and it reports where it ended up. */
type Own = {
  /** Where it would land while in hand, else null. */
  held: () => Vector3 | null;
  /** The spot it was just dropped on, once. */
  takeDrop: () => [number, number] | null;
  grab: (e: ThreeEvent<PointerEvent>) => void;
  hover: (key: string | null) => void;
  onSettle: (at: [number, number]) => void;
};

const AIM = new Vector3();
const DIR = new Vector3();
const HELD = new Vector3();

function Figure({ v, foot, anchors, act, own }: { v: Villager; foot: Footprint; anchors: Anchors; act?: Act; own?: Own }) {
  const body = useRef<Group>(null);
  const pose = useRef<Group>(null);
  const phys = useRef<Body | null>(null);
  const seenWarp = useRef(v.warp ?? 0);
  /** Just dropped here: walk nowhere until presence catches up with the new spot. */
  const pending = useRef<[number, number] | null>(null);
  /** The target we gave up on (a wall, the edge): don't keep bumping into it. */
  const halted = useRef<string | null>(null);
  const walking = useRef(false);
  const squash = useRef(0);
  const gait = useRef({ phase: 0, amount: 0 });
  /** Closest we've got to the current target, and since when. */
  const progress = useRef({ key: "", best: Infinity, since: 0 });

  useFrame(({ clock }, rawDt) => {
    const g = body.current;
    const pz = pose.current;
    if (!g || !pz) return;
    const dt = Math.min(rawDt, 1 / 20);
    const t = clock.elapsedTime;
    const { book } = foot;
    if (!phys.current) phys.current = { pos: groundAt(foot, v.at), vy: 0, grounded: true };
    const b = phys.current;
    // In hand: hang over the drop spot, legs swinging.
    const inHand = own?.held();
    if (inHand) {
      HELD.set(inHand.x, inHand.y + LIFT, inHand.z);
      b.pos.lerp(HELD, 1 - Math.exp(-dt * 18));
      b.vy = 0;
      b.grounded = false;
      walking.current = false;
      g.position.copy(b.pos);
      pz.position.y = 0;
      pz.rotation.set(Math.sin(t * 5) * 0.12, 0, Math.sin(t * 7) * 0.18);
      return;
    }
    const dropped = own?.takeDrop();
    if (dropped) pending.current = dropped;
    const warp = v.warp ?? 0;
    if (warp !== seenWarp.current) {
      seenWarp.current = warp;
      // Dropped (picked up, or set down on arrival): appear over the new spot and
      // fall onto it. Your own figure keeps the height it was carried at.
      const y = b.pos.y;
      groundAt(foot, v.at, b.pos);
      b.pos.y = own ? Math.max(y, b.pos.y) : b.pos.y + 0.15;
      b.vy = 0;
      b.grounded = false;
    }
    const p = pending.current;
    if (p && Math.abs(p[0] - v.at[0]) < 1e-4 && Math.abs(p[1] - v.at[1]) < 1e-4) pending.current = null;
    const at = pending.current ?? v.at;
    const key = `${at[0]},${at[1]}`;
    if (pending.current) fromFrac(foot, at, AIM).setY(b.pos.y);
    else fromFrac(foot, at, AIM);

    // Walk: steady pace toward the target over the terrain; new targets replace old ones.
    const dx = AIM.x - b.pos.x;
    const dz = AIM.z - b.pos.z;
    const dist = Math.hypot(dx, dz);
    let moved = false;
    if (dist > ARRIVE && b.grounded && halted.current !== key) {
      DIR.set(dx / dist, 0, dz / dist);
      moved = walkStep(book, b.pos, DIR, Math.min(dist, WALK_SPEED * dt));
      // Veering around things can circle without getting closer: give up after a while.
      const prog = progress.current;
      if (prog.key !== key || dist < prog.best - 0.01) progress.current = { key, best: dist, since: t };
      else if (t - prog.since > STUCK_S) moved = false;
      if (moved) {
        walking.current = true;
        g.rotation.y = Math.atan2(DIR.x, DIR.z);
      } else halted.current = key;
    }
    if (halted.current && halted.current !== key) halted.current = null;
    if (moved || !b.grounded) {
      const impact = settle(book, b, dt);
      if (impact > 0.4) squash.current = Math.min(0.28, impact * 0.12);
    }
    // Stopped (arrived or blocked): your figure tells the others where it really is.
    if (!moved && walking.current && b.grounded) {
      walking.current = false;
      own?.onSettle(toFrac(foot, b.pos));
    }

    g.position.copy(b.pos);
    // Walk cycle: limbs swing (Chibi) and the body bobs once per step.
    const gt = gait.current;
    gt.amount += ((walking.current ? 1 : 0) - gt.amount) * Math.min(1, dt * 10);
    if (gt.amount > 0.001) gt.phase += dt * STEP_RATE;
    pz.position.y = Math.abs(Math.sin(gt.phase)) * 0.003 * gt.amount;
    pz.rotation.x *= 0.8;
    pz.rotation.z *= 0.8;
    const s = squash.current;
    pz.scale.set(1 + s * 0.5, 1 - s, 1 + s * 0.5);
    squash.current = Math.max(0, s - dt * 1.4);
  });

  const handlers = act
    ? {
        onPointerOver: (e: ThreeEvent<PointerEvent>) => {
          e.stopPropagation();
          act.hover(v.key);
        },
        onPointerOut: () => act.hover(null),
        onClick: (e: ThreeEvent<MouseEvent>) => {
          if (e.delta > 6) return;
          e.stopPropagation();
          act.mention(v);
        },
        onContextMenu: (e: ThreeEvent<MouseEvent>) => {
          if (e.delta > 6) return;
          e.stopPropagation();
          act.menu(v, e.nativeEvent.clientX, e.nativeEvent.clientY);
        },
      }
    : own
      ? {
          // Your own figure: hold to pick up. Right clicks fall through to the ground under it.
          onPointerOver: (e: ThreeEvent<PointerEvent>) => {
            e.stopPropagation();
            own.hover(v.key);
          },
          onPointerOut: () => own.hover(null),
          onPointerDown: own.grab,
        }
      : {};

  return (
    <group ref={body} {...handlers}>
      <object3D
        position-y={FIGURE_SCALE * 1.02}
        ref={(o) => {
          if (o) anchors.set(v.key, o);
          else anchors.delete(v.key);
        }}
      />
      <group ref={pose}>
        <group scale={FIGURE_SCALE}>
          {/* Its own boundary: a loading figure must not take the others down. */}
          <Suspense fallback={null}>
            <Chibi morph={v.morph} equipped={v.equipped} gait={gait} />
          </Suspense>
        </group>
      </group>
    </group>
  );
}

/** A flat ring on the ground. */
function Ring({ r, w, opacity, ...props }: { r: number; w: number; opacity: number } & ThreeElements["mesh"]) {
  return (
    <mesh rotation-x={-Math.PI / 2} renderOrder={2} {...props}>
      <ringGeometry args={[r - w, r, 40]} />
      <meshBasicMaterial color={SKY} transparent opacity={opacity} depthWrite={false} toneMapped={false} />
    </mesh>
  );
}

/**
 * Where you are walking to: a ripple when you click, then a soft pulsing ring
 * until you get there (or stop short). `done` fades it out.
 */
function WalkMarker({ at, done, onGone }: { at: Vector3; done: boolean; onGone: () => void }) {
  const ripple = useRef<Mesh>(null);
  const ring = useRef<Mesh>(null);
  const age = useRef(0);
  const fade = useRef(1);
  useFrame((_, dt) => {
    age.current += dt;
    if (done) fade.current -= dt * 4;
    if (fade.current <= 0) return onGone();
    const a = age.current;
    const rp = ripple.current;
    if (rp) {
      const k = Math.min(a / 0.5, 1);
      rp.scale.setScalar(0.4 + k * 1.4);
      (rp.material as MeshBasicMaterial).opacity = (1 - k) * 0.9 * fade.current;
    }
    const rg = ring.current;
    if (rg) {
      const pop = Math.min(a / 0.18, 1);
      rg.scale.setScalar(pop * (1 + Math.sin(a * 6) * 0.08));
      (rg.material as MeshBasicMaterial).opacity = 0.85 * fade.current;
    }
  });
  return (
    <group position={[at.x, at.y + 0.004, at.z]}>
      <Ring ref={ripple} r={0.035} w={0.006} opacity={0.9} />
      <Ring ref={ring} r={0.02} w={0.007} opacity={0.85} />
    </group>
  );
}

/** While your figure is in hand: a ring on the spot it would land on. */
function DropMark({ carry }: { carry: RefObject<Carry> }) {
  const g = useRef<Group>(null);
  useFrame(({ clock }) => {
    const p = carry.current?.point;
    if (!g.current) return;
    g.current.visible = !!p;
    if (p) {
      g.current.position.set(p.x, p.y + 0.004, p.z);
      g.current.scale.setScalar(1 + Math.sin(clock.elapsedTime * 8) * 0.1);
    }
  });
  return (
    <group ref={g} visible={false}>
      <Ring r={0.025} w={0.007} opacity={0.9} />
    </group>
  );
}

function Daylight({ phase }: { phase: Phase }) {
  const p = PHASES[phase];
  useEffect(() => {
    TOY_TINT.value.set(p.tint);
    return () => void TOY_TINT.value.set(1, 1, 1);
  }, [p]);
  return (
    <>
      <hemisphereLight args={[new Color(p.sky[1]), new Color("#6b5a48"), 1.1 * p.sun + 0.55]} />
      <directionalLight position={[-3, 5, 4]} color={p.light} intensity={2.2 * p.sun} />
    </>
  );
}

// Camera (docs/DESIGN.md §9): two modes, switched with Y.
//   follow   — the default. A little way off at a quarter angle, the camera
//              glides after your figure.
//   overview — the whole book, as the village first appears.
// Turning the view takes Space + drag (the left button is for interacting);
// the wheel zooms any time. On touch screens two fingers turn and pinch-zoom,
// and one finger is left for tapping (walk, mention).
export type CamMode = "follow" | "overview";
// `ONE` gets a value OrbitControls doesn't handle, which turns one-finger drags off.
const TOUCHES = { ONE: -1 as unknown as TOUCH, TWO: TOUCH.DOLLY_ROTATE };

const VIEW = new Vector3(0, 3.2, 4.6);
const TARGET = new Vector3(0, 0.6, 0);
const FOLLOW_OFFSET = new Vector3(0.24, 0.28, 0.24).normalize().multiplyScalar(0.62);
const ZOOM: Record<CamMode, [number, number]> = { follow: [0.18, 2.4], overview: [2.2, 12] };
type Controls = {
  enabled: boolean;
  enableRotate: boolean;
  enableZoom: boolean;
  minDistance: number;
  maxDistance: number;
  target: Vector3;
  update: () => void;
};

// Space belongs to whatever has focus when it's a text field or inside a modal.
const isTyping = (t: EventTarget | null) =>
  t instanceof HTMLElement &&
  (t.isContentEditable || t.tagName === "INPUT" || t.tagName === "TEXTAREA" || !!t.closest("[role=dialog]"));

/** The whole book in view; a narrow (phone) screen backs off so it still fits across. */
function overviewPose(aspect: number, out: Vector3) {
  const back = Math.max(1, 1.25 / aspect);
  return out.copy(TARGET).addScaledVector(D_VIEW.subVectors(VIEW, TARGET), back);
}

const D_VIEW = new Vector3();
const FOCUS = new Vector3();
const STEP = new Vector3();
const GOAL = new Vector3();
const RAY_DIR = new Vector3();

function CameraRig({
  mode,
  anchors,
  selfKey,
  book,
}: {
  mode: CamMode;
  anchors: Anchors;
  selfKey: string | null;
  book: Object3D | null;
}) {
  const gl = useThree((s) => s.gl);
  const size = useThree((s) => s.size);
  const space = useRef(false);
  /** Gliding to a new mode's pose; follow keeps the user's angle and distance. */
  const flying = useRef(true);
  const shown = useRef<CamMode | null>(null);
  const offset = useRef(FOLLOW_OFFSET.clone());
  const coarse = useMemo(() => typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches, []);

  // A new canvas size re-frames the overview.
  useEffect(() => {
    flying.current = true;
  }, [size.width, size.height]);

  useEffect(() => {
    const el = gl.domElement;
    const set = (on: boolean) => {
      space.current = on;
      el.style.cursor = on ? "grab" : "";
    };
    const down = (e: KeyboardEvent) => {
      if (e.code !== "Space" || isTyping(e.target)) return;
      e.preventDefault(); // no page scroll, no pressing a focused name tag
      set(true);
    };
    const up = (e: KeyboardEvent) => {
      if (e.code !== "Space") return;
      if (!isTyping(e.target)) e.preventDefault();
      set(false);
    };
    const blur = () => set(false);
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
    };
  }, [gl]);

  // A wall or roof between you and the camera pulls the camera in front of it
  // (third-person camera). That's only for drawing: before the controls run
  // again the camera goes back where you put it, so the zoom isn't eaten away.
  const pulled = useRef(false);
  const wanted = useMemo(() => new Vector3(), []);
  useFrame(({ camera }) => {
    if (pulled.current) camera.position.copy(wanted);
    pulled.current = false;
  }, -2); // before OrbitControls (-1)

  const pullIn = (camera: { position: Vector3 }, target: Vector3) => {
    if (!book) return;
    wanted.copy(camera.position);
    RAY_DIR.subVectors(camera.position, target);
    const len = RAY_DIR.length();
    if (len < 1e-4) return;
    RAY_DIR.divideScalar(len);
    const hit = hitDistance(book, target, RAY_DIR, len);
    if (hit === null) return;
    camera.position.copy(target).addScaledVector(RAY_DIR, Math.max(hit - 0.015, 0.03));
    pulled.current = true;
  };

  useFrame((state, dt) => {
    const { camera } = state;
    const controls = state.controls as unknown as Controls | null;
    if (!controls) return;
    const a = selfKey ? anchors.get(selfKey) : undefined;
    // Aim at the middle of the figure (the anchor floats just over its head).
    const self = a ? a.getWorldPosition(FOCUS).setY(FOCUS.y - FIGURE_SCALE * 0.55) : null;

    if (shown.current !== mode) {
      shown.current = mode;
      flying.current = true;
    }
    const [near, far] = ZOOM[mode];

    if (flying.current) {
      if (mode === "follow" && !self) return; // wait for your figure to arrive
      const target = mode === "follow" ? self! : TARGET;
      const pos = mode === "follow" ? GOAL.copy(self!).add(offset.current) : overviewPose(size.width / size.height, GOAL);
      const k = 1 - Math.exp(-dt * 4);
      controls.enableRotate = false;
      controls.enableZoom = false;
      controls.minDistance = 0;
      controls.maxDistance = Infinity;
      camera.position.lerp(pos, k);
      controls.target.lerp(target, k);
      camera.lookAt(controls.target);
      if (camera.position.distanceTo(pos) < 0.005 && controls.target.distanceTo(target) < 0.005) flying.current = false;
      if (mode === "follow") pullIn(camera, controls.target);
      return;
    }

    controls.minDistance = near;
    controls.maxDistance = far;
    controls.enableZoom = true;
    controls.enableRotate = space.current || coarse;

    // Follow: slide the camera and its pivot along with you; the angle and
    // distance stay whatever you turned and zoomed them to. Held still while
    // you carry your figure (the drop point is read through this camera).
    if (mode === "follow" && self && controls.enabled) {
      STEP.subVectors(self, controls.target).multiplyScalar(1 - Math.exp(-dt * 6));
      controls.target.add(STEP);
      camera.position.add(STEP);
      offset.current.subVectors(camera.position, controls.target);
    }
    if (mode === "follow") pullIn(camera, controls.target);
  });
  return null;
}

/** Each frame, report where every anchor is on screen (null when off camera). */
function LabelTracker({ anchors, place }: { anchors: Anchors; place: (key: string, at: [number, number] | null) => void }) {
  const { camera, size } = useThree();
  const p = useMemo(() => new Vector3(), []);
  useFrame(() => {
    for (const [key, a] of anchors) {
      a.getWorldPosition(p).project(camera);
      place(key, p.z < 1 ? [((p.x + 1) / 2) * size.width, ((1 - p.y) / 2) * size.height] : null);
    }
  });
  return null;
}

function Scene({
  phase,
  villagers,
  selfKey,
  anchors,
  act,
  onMove,
  onTap,
  onSettle,
  onDrop,
  onCarry,
  registerGrab,
  camMode,
}: {
  phase: Phase;
  villagers: Villager[];
  selfKey: string | null;
  anchors: Anchors;
  act: Act;
  onMove: (at: [number, number]) => void;
  onTap: () => void;
  onSettle: (at: [number, number]) => void;
  onDrop: (at: [number, number]) => void;
  onCarry: (carrying: boolean) => void;
  /** Hands over the pick-up starter, for your name tag to call. */
  registerGrab: (start: (e: PointerEvent) => void) => void;
  camMode: CamMode;
}) {
  // Figures wait for the book: they stand where a ray from above lands on it.
  const [foot, setFoot] = useState<Footprint | null>(null);
  const [marker, setMarker] = useState<{ at: Vector3; id: number; done: boolean } | null>(null);
  const carry = useRef<Carry>({ point: null, drop: null });
  const get = useThree((s) => s.get);

  // Hold your own figure to pick it up; move the pointer and let go to drop it.
  // Moving before the hold completes is a camera drag, not a pick-up.
  // Takes a native event so your name tag (DOM, outside the canvas) can start it too.
  const startGrab = (ev0: PointerEvent) => {
    if (!foot || !selfKey || ev0.button !== 0) return;
    const sx = ev0.clientX;
    const sy = ev0.clientY;
    const early = (ev: PointerEvent) => {
      if (ev.type !== "pointermove" || Math.hypot(ev.clientX - sx, ev.clientY - sy) > 6) stop();
    };
    const stop = () => {
      clearTimeout(timer);
      window.removeEventListener("pointermove", early);
      window.removeEventListener("pointerup", early);
      window.removeEventListener("pointercancel", early);
    };
    const lift = () => {
      stop();
      const { camera, gl, controls } = get();
      const orbit = controls as unknown as Controls | null;
      if (orbit) orbit.enabled = false;
      const a = anchors.get(selfKey);
      const start = a ? a.getWorldPosition(new Vector3()) : new Vector3();
      start.y -= FIGURE_SCALE * 1.02;
      carry.current.point = start;
      setMarker(null);
      onCarry(true);
      const move = (ev: PointerEvent) => {
        const p = dropPointAt(foot, camera, gl.domElement, ev.clientX, ev.clientY, carry.current.point?.y ?? start.y);
        if (p) carry.current.point = p;
      };
      const drop = () => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", drop);
        window.removeEventListener("pointercancel", drop);
        const p = carry.current.point ?? start;
        const at = toFrac(foot, p);
        carry.current.point = null;
        carry.current.drop = at;
        if (orbit) orbit.enabled = true;
        onCarry(false);
        onDrop(at);
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", drop);
      window.addEventListener("pointercancel", drop);
    };
    const timer = window.setTimeout(lift, HOLD_MS);
    window.addEventListener("pointermove", early);
    window.addEventListener("pointerup", early);
    window.addEventListener("pointercancel", early);
  };

  useEffect(() => registerGrab(startGrab));

  // Arriving: the spawn spot is random, so land on open ground near it rather
  // than a roof or a treetop. Once per visit, before you've moved.
  const me = villagers.find((v) => v.key === selfKey);
  const landed = useRef(false);
  useEffect(() => {
    if (landed.current || !foot || !me || (me.warp ?? 0) !== 0) return;
    landed.current = true;
    const spot = openGroundNear(foot, me.at);
    if (spot !== me.at) onDrop(spot);
  }, [foot, me, onDrop]);

  const own: Own = {
    held: () => carry.current.point,
    takeDrop: () => {
      const d = carry.current.drop;
      carry.current.drop = null;
      return d;
    },
    grab: (e) => {
      e.stopPropagation();
      startGrab(e.nativeEvent);
    },
    hover: act.hover,
    onSettle: (at) => {
      setMarker((m) => m && { ...m, done: true });
      onSettle(at);
    },
  };

  return (
    <>
      <Daylight phase={phase} />
      <Book
        onReady={setFoot}
        onTap={onTap}
        onPick={(p) => {
          if (!foot) return;
          setMarker({ at: p, id: Date.now(), done: false });
          onMove(toFrac(foot, p));
        }}
      />
      {foot &&
        villagers.map((v) => (
          <Figure
            key={v.key}
            v={v}
            foot={foot}
            anchors={anchors}
            act={v.key === selfKey ? undefined : act}
            own={v.key === selfKey ? own : undefined}
          />
        ))}
      {marker && <WalkMarker key={marker.id} at={marker.at} done={marker.done} onGone={() => setMarker(null)} />}
      <DropMark carry={carry} />
      <CameraRig mode={camMode} anchors={anchors} selfKey={selfKey} book={foot?.book ?? null} />
    </>
  );
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Speech with @mentions of the villagers here picked out; one naming you stands out more. */
function Speech({ text, names, me }: { text: string; names: string[]; me: string | null }) {
  const list = [...new Set(names)].filter(Boolean).sort((a, b) => b.length - a.length);
  if (!list.length) return <>{text}</>;
  const parts = text.split(new RegExp(`(@(?:${list.map(escapeRe).join("|")}))`, "g"));
  return (
    <>
      {parts.map((s, i) =>
        i % 2 ? (
          <b key={i} className={s.slice(1) === me ? `${x.mention} ${x.mentionMe}` : x.mention}>
            {s}
          </b>
        ) : (
          s
        ),
      )}
    </>
  );
}

type Menu = { key: string; x: number; y: number };
const MENU_W = 168;
const MENU_H = 150;

export default function BookVillage({
  phase,
  villagers,
  selfKey,
  bubbles,
  onMove,
  onSettle,
  onDrop,
  onOpen,
  onMention,
  onApproach,
}: {
  phase: Phase;
  villagers: Villager[];
  selfKey: string | null;
  bubbles: Record<string, Bubble>;
  /** Walk to a spot (right click). */
  onMove: (at: [number, number]) => void;
  /** Your figure stopped somewhere other than asked (a wall, the edge). */
  onSettle: (at: [number, number]) => void;
  /** Your figure was picked up and dropped here. */
  onDrop: (at: [number, number]) => void;
  onOpen: (v: Villager) => void;
  onMention: (v: Villager) => void;
  onApproach: (v: Villager) => void;
}) {
  const p = PHASES[phase];
  const anchors = useMemo<Anchors>(() => new Map(), []);
  const labels = useRef(new Map<string, HTMLElement>());
  const box = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<string | null>(null);
  const [menu, setMenu] = useState<Menu | null>(null);
  const [carrying, setCarrying] = useState(false);
  const [camMode, setCamMode] = useState<CamMode>("follow");
  // Y switches between following your figure and the whole-village view.
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.code !== "KeyY" || e.repeat || e.ctrlKey || e.metaKey || e.altKey || isTyping(e.target)) return;
      setCamMode((m) => (m === "follow" ? "overview" : "follow"));
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);
  // Your name tag starts a pick-up too: the figure itself is small to hit.
  const grabRef = useRef<((e: PointerEvent) => void) | null>(null);
  const registerGrab = useCallback((start: (e: PointerEvent) => void) => {
    grabRef.current = start;
  }, []);
  const cursor = carrying ? "grabbing" : hover && hover === selfKey ? "grab" : hover ? "pointer" : undefined;

  const act = useMemo<Act>(
    () => ({
      hover: setHover,
      mention: (v) => {
        setMenu(null);
        onMention(v);
      },
      menu: (v, cx, cy) => {
        const r = box.current?.getBoundingClientRect();
        if (!r) return;
        // Open at the cursor, kept inside the map.
        const mx = Math.min(Math.max(cx - r.left, 8), r.width - MENU_W - 8);
        const my = Math.min(Math.max(cy - r.top, 8), r.height - MENU_H - 8);
        setMenu({ key: v.key, x: mx, y: my });
      },
    }),
    [onMention],
  );

  useEffect(() => {
    if (!menu) return;
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setMenu(null);
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [menu]);

  const me = villagers.find((v) => v.key === selfKey)?.nickname ?? null;
  const names = villagers.map((v) => v.nickname);
  const target = menu && villagers.find((v) => v.key === menu.key);
  const choose = (fn: (v: Villager) => void) => {
    if (target) fn(target);
    setMenu(null);
  };

  return (
    <div
      ref={box}
      className={x.sky}
      style={{ background: `linear-gradient(${p.sky[0]}, ${p.sky[1]})`, cursor }}
      onContextMenu={(e) => e.preventDefault()}
      onPointerDown={(e) => {
        // Any press outside the menu closes it.
        if (menu && !(e.target as HTMLElement).closest(`.${x.menu}`)) setMenu(null);
      }}
    >
      <Canvas camera={{ position: VIEW.toArray(), fov: 35, near: 0.01, far: 100 }} dpr={[1, 2]} gl={{ antialias: true, alpha: true }}>
        <Suspense fallback={null}>
          <Scene
            phase={phase}
            villagers={villagers}
            selfKey={selfKey}
            anchors={anchors}
            act={act}
            onMove={onMove}
            onTap={() => setMenu(null)}
            onSettle={onSettle}
            onDrop={onDrop}
            onCarry={setCarrying}
            registerGrab={registerGrab}
            camMode={camMode}
          />
        </Suspense>
        <LabelTracker
          anchors={anchors}
          place={(key, at) => {
            const el = labels.current.get(key);
            if (!el) return;
            el.style.visibility = at ? "visible" : "hidden";
            if (at) el.style.transform = `translate(${at[0]}px, ${at[1]}px) translate(-50%, -100%)`;
          }}
        />
        {/* Rotation, zoom limits and the pivot are set by CameraRig each frame, not here. */}
        <OrbitControls makeDefault enablePan={false} maxPolarAngle={Math.PI * 0.45} touches={TOUCHES} />
      </Canvas>
      <div className={x.labels}>
        {villagers.map((v) => (
          <div
            key={v.key}
            className={x.tag}
            ref={(el) => {
              if (el) labels.current.set(v.key, el);
              else labels.current.delete(v.key);
            }}
          >
            {bubbles[v.key] && (
              <p key={bubbles[v.key].id} className={x.bubble}>
                <Speech text={bubbles[v.key].text} names={names} me={me} />
              </p>
            )}
            {v.key === selfKey ? (
              <span
                className={`${x.name} ${x.nameSelf}`}
                title="꾹 눌러 옮기기"
                onPointerDown={(e) => grabRef.current?.(e.nativeEvent)}
              >
                {v.classKey && <ClassEmblem classKey={v.classKey} size={16} />}
                {v.nickname}
              </span>
            ) : (
              <button
                type="button"
                className={`${x.name} ${hover === v.key || menu?.key === v.key ? x.nameHot : ""}`}
                title="클릭: @멘션 · 우클릭: 메뉴"
                onPointerEnter={() => setHover(v.key)}
                onPointerLeave={() => setHover(null)}
                onClick={() => act.mention(v)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  act.menu(v, e.clientX, e.clientY);
                }}
              >
                {v.classKey && <ClassEmblem classKey={v.classKey} size={16} />}
                {v.nickname}
              </button>
            )}
          </div>
        ))}
      </div>
      <button
        type="button"
        className={x.camToggle}
        aria-pressed={camMode === "overview"}
        title="Y로도 바꿀 수 있어요"
        onClick={() => setCamMode((m) => (m === "follow" ? "overview" : "follow"))}
      >
        {camMode === "follow" ? "마을 전경 보기" : "내 캐릭터 따라가기"}
        <kbd>Y</kbd>
      </button>
      {target && menu && (
        <div className={x.menu} role="menu" style={{ left: menu.x, top: menu.y, width: MENU_W }}>
          <p className={x.menuHead}>
            {target.classKey && <ClassEmblem classKey={target.classKey} size={18} />}
            {target.nickname}
          </p>
          <button type="button" role="menuitem" autoFocus onClick={() => choose(act.mention)}>
            말 걸기
          </button>
          <button type="button" role="menuitem" onClick={() => choose(onApproach)}>
            옆으로 가기
          </button>
          <button type="button" role="menuitem" onClick={() => choose(onOpen)}>
            프로필 보기
          </button>
        </div>
      )}
    </div>
  );
}

useGLTF.preload(BOOK_URL);
