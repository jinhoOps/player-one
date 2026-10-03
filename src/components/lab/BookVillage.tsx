"use client";

// Village trial (/lab/village): "Medieval Fantasy Book" by Pixel (CC-BY-4.0)
// as the map, chibi residents on it, lit by the Korea clock (docs/DESIGN.md §9).

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, useAnimations, useGLTF } from "@react-three/drei";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Box3, Color, Group, Mesh, Object3D, Raycaster, Vector3 } from "three";
import { ClassEmblem } from "@/components/ClassEmblem";
import type { ClassKey, EquipSlotKey } from "@/lib/game";
import { PHASES, type Phase } from "@/lib/daylight";
import type { BodyMorph } from "@/lib/morph";
import { Chibi, TOY_TINT } from "./ChibiViewport";
import x from "./village.module.css";

export const BOOK_URL = "/models/book/scene.gltf";
const BOOK_WIDTH = 4;
const RESIDENT_SCALE = 0.24;

export type Resident = {
  nickname: string;
  classKey: ClassKey;
  morph: BodyMorph;
  equipped: Record<EquipSlotKey, boolean>;
  /** Where on the book, as fractions of its footprint. */
  at: [number, number];
  say?: string;
};

function Book({ onReady }: { onReady: (book: Group) => void }) {
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
    if (root.current) onReady(root.current);
  }, [onReady]);
  return (
    <group ref={root}>
      <primitive object={model} />
    </group>
  );
}

/** Drop a point from above onto the book's surface. */
function ground(book: Group, fx: number, fz: number) {
  book.updateMatrixWorld(true);
  const box = new Box3().setFromObject(book);
  const p = new Vector3(box.min.x + (box.max.x - box.min.x) * fx, box.max.y + 1, box.min.z + (box.max.z - box.min.z) * fz);
  const hit = new Raycaster(p, new Vector3(0, -1, 0)).intersectObject(book, true).find((h) => (h.object as Mesh).isMesh);
  return hit ? hit.point : new Vector3(p.x, 0, p.z);
}

// Head labels live in a DOM overlay outside the canvas; each frame moves them
// to their resident's head on screen. Anchors are keyed by nickname.
type Anchors = Map<string, Object3D>;

function ResidentFigure({ book, r, anchors }: { book: Group; r: Resident; anchors: Anchors }) {
  const at = useMemo(() => ground(book, ...r.at), [book, r.at]);
  return (
    <group position={at} rotation-y={(r.at[0] - 0.5) * -0.6}>
      <object3D
        position-y={RESIDENT_SCALE * 1.02}
        ref={(o) => {
          if (o) anchors.set(r.nickname, o);
          else anchors.delete(r.nickname);
        }}
      />
      <group scale={RESIDENT_SCALE}>
        {/* Its own boundary: a loading figure must not take the label down with it. */}
        <Suspense fallback={null}>
          <Chibi morph={r.morph} equipped={r.equipped} />
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

/** Each frame, report where every anchor is on screen (null when off camera). */
function LabelTracker({ anchors, place }: { anchors: Anchors; place: (name: string, at: [number, number] | null) => void }) {
  const { camera, size } = useThree();
  const p = useMemo(() => new Vector3(), []);
  useFrame(() => {
    for (const [name, a] of anchors) {
      a.getWorldPosition(p).project(camera);
      place(name, p.z < 1 ? [((p.x + 1) / 2) * size.width, ((1 - p.y) / 2) * size.height] : null);
    }
  });
  return null;
}

function Scene({ phase, residents, anchors }: { phase: Phase; residents: Resident[]; anchors: Anchors }) {
  // Residents wait for the book: they stand where a ray from above lands on it.
  const [book, setBook] = useState<Group | null>(null);
  return (
    <>
      <Daylight phase={phase} />
      <Book onReady={setBook} />
      {book && residents.map((r) => <ResidentFigure key={r.nickname} book={book} r={r} anchors={anchors} />)}
    </>
  );
}

export default function BookVillage({ phase, residents }: { phase: Phase; residents: Resident[] }) {
  const p = PHASES[phase];
  const anchors = useMemo<Anchors>(() => new Map(), []);
  const labels = useRef(new Map<string, HTMLElement>());
  return (
    <div className={x.sky} style={{ background: `linear-gradient(${p.sky[0]}, ${p.sky[1]})` }}>
      <Canvas camera={{ position: [0, 3.2, 4.6], fov: 35 }} dpr={[1, 2]} gl={{ antialias: true, alpha: true }}>
        <Suspense fallback={null}>
          <Scene phase={phase} residents={residents} anchors={anchors} />
        </Suspense>
        <LabelTracker
          anchors={anchors}
          place={(name, at) => {
            const el = labels.current.get(name);
            if (!el) return;
            el.style.visibility = at ? "visible" : "hidden";
            if (at) el.style.transform = `translate(${at[0]}px, ${at[1]}px) translate(-50%, -100%)`;
          }}
        />
        <OrbitControls target={[0, 0.6, 0]} enablePan={false} minDistance={2.5} maxDistance={7} maxPolarAngle={Math.PI * 0.45} />
      </Canvas>
      {/* Head labels: class emblem + name, and a speech bubble when they talk. */}
      <div className={x.labels} aria-hidden>
        {residents.map((r) => (
          <div
            key={r.nickname}
            className={x.tag}
            ref={(el) => {
              if (el) labels.current.set(r.nickname, el);
              else labels.current.delete(r.nickname);
            }}
          >
            {r.say && <p className={x.bubble}>{r.say}</p>}
            <span className={x.name}>
              <ClassEmblem classKey={r.classKey} size={16} />
              {r.nickname}
            </span>
          </div>
        ))}
      </div>
      <p className={x.phase}>{p.label}</p>
    </div>
  );
}

useGLTF.preload(BOOK_URL);
