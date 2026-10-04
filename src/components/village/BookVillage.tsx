"use client";

// The village map (docs/DESIGN.md §9): "Medieval Fantasy Book" by Pixel
// (CC-BY-4.0). Players stand on its pages as chibis; click the ground to walk
// there. Head labels (class emblem + name, speech bubble) are a DOM overlay
// that follows each head on screen. Light follows the Korea clock.

import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { OrbitControls, useAnimations, useGLTF } from "@react-three/drei";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Box3, Color, Group, Mesh, Object3D, Raycaster, Vector3 } from "three";
import { BASE_PATH } from "@/lib/basePath";
import { TOY_TINT } from "@/lib/chibiRig";
import { PHASES, type Phase } from "@/lib/daylight";
import type { Bubble, Villager } from "@/lib/useVillage";
import { ClassEmblem } from "../ClassEmblem";
import { Chibi } from "../Chibi";
import x from "./village.module.css";

export const BOOK_URL = `${BASE_PATH}/models/book/scene.gltf`;
const BOOK_WIDTH = 4;
const FIGURE_SCALE = 0.24;
const WALK_SPEED = 0.45; // world units per second

type Footprint = { book: Group; box: Box3 };
type Anchors = Map<string, Object3D>;

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

/** World point on the book's surface under a footprint fraction. */
function groundAt({ book, box }: Footprint, [fx, fz]: [number, number]) {
  const p = new Vector3(box.min.x + (box.max.x - box.min.x) * fx, box.max.y + 1, box.min.z + (box.max.z - box.min.z) * fz);
  const hit = new Raycaster(p, new Vector3(0, -1, 0)).intersectObject(book, true).find((h) => (h.object as Mesh).isMesh);
  return hit ? hit.point : new Vector3(p.x, 0, p.z);
}

/** What you can do to another villager: hover, left click to @mention, right click for the menu. */
type Act = {
  hover: (key: string | null) => void;
  mention: (v: Villager) => void;
  menu: (v: Villager, clientX: number, clientY: number) => void;
};

function Figure({ v, foot, anchors, act }: { v: Villager; foot: Footprint; anchors: Anchors; act?: Act }) {
  const target = useMemo(() => groundAt(foot, v.at), [foot, v.at]);
  const body = useRef<Group>(null);
  const from = useRef<Vector3 | null>(null);

  useFrame(({ clock }, dt) => {
    const g = body.current;
    if (!g) return;
    if (!from.current) {
      from.current = target.clone();
      g.position.copy(target);
    }
    const d = new Vector3().subVectors(target, g.position);
    d.y = 0;
    const dist = d.length();
    if (dist > 0.005) {
      // Walk: straight there at a steady pace, facing the way, with a little hop.
      const step = Math.min(dist, WALK_SPEED * dt);
      g.position.addScaledVector(d.normalize(), step);
      const left = new Vector3(target.x - g.position.x, 0, target.z - g.position.z).length();
      const total = new Vector3(target.x - from.current.x, 0, target.z - from.current.z).length() || 1;
      g.position.y = target.y + (from.current.y - target.y) * (left / total) + Math.abs(Math.sin(clock.elapsedTime * 14)) * 0.012;
      g.rotation.y = Math.atan2(d.x, d.z);
    } else {
      g.position.copy(target);
      from.current.copy(target);
    }
  });

  // Your own figure takes no clicks: they fall through to the ground under it.
  const handlers = act && {
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
  };

  return (
    <group ref={body} {...handlers}>
      <object3D
        position-y={FIGURE_SCALE * 1.02}
        ref={(o) => {
          if (o) anchors.set(v.key, o);
          else anchors.delete(v.key);
        }}
      />
      <group scale={FIGURE_SCALE}>
        {/* Its own boundary: a loading figure must not take the others down. */}
        <Suspense fallback={null}>
          <Chibi morph={v.morph} equipped={v.equipped} />
        </Suspense>
      </group>
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

const VIEW = new Vector3(0, 3.2, 4.6);
const TARGET = new Vector3(0, 0.6, 0);

/** A narrow (phone) view backs off so the whole book still fits across. */
function FitCamera() {
  const { camera, size } = useThree();
  useEffect(() => {
    const back = Math.max(1, 1.25 / (size.width / size.height));
    camera.position.copy(TARGET).addScaledVector(new Vector3().subVectors(VIEW, TARGET), back);
    camera.lookAt(TARGET);
  }, [camera, size.width, size.height]);
  return null;
}

// Space held: a quarter view at a fixed world angle that follows your figure.
const QUARTER = new Vector3(0.7, 0.8, 0.7);
const LOOK = new Vector3();
const WANT = new Vector3();
type Controls = { enabled: boolean; target: Vector3; update: () => void };

const isTyping = (t: EventTarget | null) =>
  t instanceof HTMLElement && (t.isContentEditable || t.tagName === "INPUT" || t.tagName === "TEXTAREA");

/** While Space is down the camera rides along with you; let go and it returns to where it was. */
function FollowCam({ anchors, selfKey }: { anchors: Anchors; selfKey: string | null }) {
  const held = useRef(false);
  const saved = useRef<{ pos: Vector3; target: Vector3 } | null>(null);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code !== "Space" || isTyping(e.target)) return;
      e.preventDefault(); // no page scroll, no pressing a focused name tag
      held.current = true;
    };
    const up = (e: KeyboardEvent) => {
      if (e.code !== "Space") return;
      if (!isTyping(e.target)) e.preventDefault();
      held.current = false;
    };
    const blur = () => void (held.current = false);
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
    };
  }, []);

  useFrame((state, dt) => {
    const { camera } = state;
    const controls = state.controls as Controls | null;
    if (!controls) return;
    const a = selfKey ? anchors.get(selfKey) : undefined;
    if (held.current && a) {
      if (!saved.current) saved.current = { pos: camera.position.clone(), target: controls.target.clone() };
      controls.enabled = false;
      a.getWorldPosition(LOOK);
      LOOK.y -= FIGURE_SCALE * 0.5; // the anchor sits over the head; aim at the body
      const k = 1 - Math.exp(-dt * 10);
      camera.position.lerp(WANT.copy(LOOK).add(QUARTER), k);
      controls.target.lerp(LOOK, k);
      camera.lookAt(controls.target);
    } else if (saved.current) {
      const { pos, target } = saved.current;
      const k = 1 - Math.exp(-dt * 8);
      camera.position.lerp(pos, k);
      controls.target.lerp(target, k);
      camera.lookAt(controls.target);
      if (camera.position.distanceTo(pos) < 0.01) {
        camera.position.copy(pos);
        controls.target.copy(target);
        saved.current = null;
        controls.enabled = true;
        controls.update();
      }
    }
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
}: {
  phase: Phase;
  villagers: Villager[];
  selfKey: string | null;
  anchors: Anchors;
  act: Act;
  onMove: (at: [number, number]) => void;
  onTap: () => void;
}) {
  // Figures wait for the book: they stand where a ray from above lands on it.
  const [foot, setFoot] = useState<Footprint | null>(null);
  return (
    <>
      <Daylight phase={phase} />
      <Book
        onReady={setFoot}
        onTap={onTap}
        onPick={(p) => {
          if (!foot) return;
          const { min, max } = foot.box;
          onMove([(p.x - min.x) / (max.x - min.x), (p.z - min.z) / (max.z - min.z)]);
        }}
      />
      {foot &&
        villagers.map((v) => (
          <Figure key={v.key} v={v} foot={foot} anchors={anchors} act={v.key === selfKey ? undefined : act} />
        ))}
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
  onOpen,
  onMention,
  onApproach,
}: {
  phase: Phase;
  villagers: Villager[];
  selfKey: string | null;
  bubbles: Record<string, Bubble>;
  onMove: (at: [number, number]) => void;
  onOpen: (handle: string) => void;
  onMention: (v: Villager) => void;
  onApproach: (v: Villager) => void;
}) {
  const p = PHASES[phase];
  const anchors = useMemo<Anchors>(() => new Map(), []);
  const labels = useRef(new Map<string, HTMLElement>());
  const box = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<string | null>(null);
  const [menu, setMenu] = useState<Menu | null>(null);

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
      style={{ background: `linear-gradient(${p.sky[0]}, ${p.sky[1]})`, cursor: hover ? "pointer" : undefined }}
      onContextMenu={(e) => e.preventDefault()}
      onPointerDown={(e) => {
        // Any press outside the menu closes it.
        if (menu && !(e.target as HTMLElement).closest(`.${x.menu}`)) setMenu(null);
      }}
    >
      <Canvas camera={{ position: VIEW.toArray(), fov: 35 }} dpr={[1, 2]} gl={{ antialias: true, alpha: true }}>
        <Suspense fallback={null}>
          <Scene
            phase={phase}
            villagers={villagers}
            selfKey={selfKey}
            anchors={anchors}
            act={act}
            onMove={onMove}
            onTap={() => setMenu(null)}
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
        <FitCamera />
        <FollowCam anchors={anchors} selfKey={selfKey} />
        <OrbitControls
          makeDefault
          target={TARGET}
          enablePan={false}
          minDistance={2.2}
          maxDistance={12}
          maxPolarAngle={Math.PI * 0.45}
        />
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
              <span className={`${x.name} ${x.nameSelf}`}>
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
          <button type="button" role="menuitem" onClick={() => choose((v) => onOpen(v.handle))}>
            프로필 보기
          </button>
        </div>
      )}
    </div>
  );
}

useGLTF.preload(BOOK_URL);
