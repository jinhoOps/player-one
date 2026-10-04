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

function Book({ onReady, onPick }: { onReady: (f: Footprint) => void; onPick: (p: Vector3) => void }) {
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

  // A click (not an orbit drag) on fairly flat ground is a place to walk to.
  const click = (e: ThreeEvent<MouseEvent>) => {
    if (e.delta > 6 || !e.face) return;
    const n = e.face.normal.clone().transformDirection(e.object.matrixWorld);
    if (n.y < 0.75) return;
    e.stopPropagation();
    onPick(e.point.clone());
  };
  return (
    <group ref={root} onClick={click}>
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

function Figure({ v, foot, anchors }: { v: Villager; foot: Footprint; anchors: Anchors }) {
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

  return (
    <group ref={body}>
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
  anchors,
  onMove,
}: {
  phase: Phase;
  villagers: Villager[];
  anchors: Anchors;
  onMove: (at: [number, number]) => void;
}) {
  // Figures wait for the book: they stand where a ray from above lands on it.
  const [foot, setFoot] = useState<Footprint | null>(null);
  return (
    <>
      <Daylight phase={phase} />
      <Book
        onReady={setFoot}
        onPick={(p) => {
          if (!foot) return;
          const { min, max } = foot.box;
          onMove([(p.x - min.x) / (max.x - min.x), (p.z - min.z) / (max.z - min.z)]);
        }}
      />
      {foot && villagers.map((v) => <Figure key={v.key} v={v} foot={foot} anchors={anchors} />)}
    </>
  );
}

export default function BookVillage({
  phase,
  villagers,
  selfKey,
  bubbles,
  onMove,
  onOpen,
}: {
  phase: Phase;
  villagers: Villager[];
  selfKey: string | null;
  bubbles: Record<string, Bubble>;
  onMove: (at: [number, number]) => void;
  onOpen: (handle: string) => void;
}) {
  const p = PHASES[phase];
  const anchors = useMemo<Anchors>(() => new Map(), []);
  const labels = useRef(new Map<string, HTMLElement>());
  return (
    <div className={x.sky} style={{ background: `linear-gradient(${p.sky[0]}, ${p.sky[1]})` }}>
      <Canvas camera={{ position: VIEW.toArray(), fov: 35 }} dpr={[1, 2]} gl={{ antialias: true, alpha: true }}>
        <Suspense fallback={null}>
          <Scene phase={phase} villagers={villagers} anchors={anchors} onMove={onMove} />
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
        <OrbitControls target={TARGET} enablePan={false} minDistance={2.2} maxDistance={12} maxPolarAngle={Math.PI * 0.45} />
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
                {bubbles[v.key].text}
              </p>
            )}
            {v.key === selfKey ? (
              <span className={`${x.name} ${x.nameSelf}`}>
                {v.classKey && <ClassEmblem classKey={v.classKey} size={16} />}
                {v.nickname}
              </span>
            ) : (
              <button type="button" className={x.name} title="공개 프로필 보기" onClick={() => onOpen(v.handle)}>
                {v.classKey && <ClassEmblem classKey={v.classKey} size={16} />}
                {v.nickname}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

useGLTF.preload(BOOK_URL);
