"use client";

// Trial (/lab): the CC-BY chibi base mesh by DuNguyn Studio, dressed the way
// the procedural toy is (docs/DESIGN.md §8) so the two can be compared.
// Same props as CharacterViewport, so it can drop in if it wins.

import { Canvas, createPortal, useFrame } from "@react-three/fiber";
import { OrbitControls, useGLTF } from "@react-three/drei";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import {
  Bone,
  Box3,
  BufferAttribute,
  CanvasTexture,
  CatmullRomCurve3,
  Color,
  DoubleSide,
  FrontSide,
  Group,
  Matrix4,
  MeshBasicMaterial,
  Object3D,
  Quaternion,
  ShaderMaterial,
  type Side,
  SkinnedMesh,
  SRGBColorSpace,
  TubeGeometry,
  Vector3,
  Vector4,
} from "three";
import { clone } from "three/examples/jsm/utils/SkeletonUtils.js";
import { EQUIP_SLOTS, type EquipSlotKey, type HairStyle } from "@/lib/game";
import type { BodyMorph } from "@/lib/morph";
import { prefersReducedMotion } from "@/lib/motion";

export const CHIBI_URL = "/models/chibi/scene.gltf";

const PALETTE = {
  skin: "#f3d5bf",
  hair: "#4b362f",
  top: "#7b93d4",
  topBase: "#ece8e1",
  bottom: "#45507a",
  bottomBase: "#cdc4b6",
  shoes: "#e08a68",
  shoesBase: "#9a948e",
  hat: "#6fa3c7",
  ink: "#2e2422",
};
const DEFAULT_HAIR: Record<BodyMorph["body"], HairStyle> = { female: "bob", male: "short", neutral: "short" };
const HEIGHT = 0.8; // average figure, world units: about the toy's

// Shared toy lighting (same as CharacterViewport's toyFrag): soft key from the
// viewer's upper left, sky/ground ambient, vinyl gloss, rim. uTint lets a
// scene (the village's time of day) dim and color every toy at once.
const LIGHT = /* glsl */ `
  uniform vec3 uTint;
  vec3 toyLight(vec3 col, vec3 N, vec3 V) {
    vec3 L = normalize(vec3(-0.45, 0.6, 0.66));
    float diffuse = clamp((dot(N, L) + 0.35) / 1.35, 0.0, 1.0);
    float ambient = mix(0.34, 0.52, N.y * 0.5 + 0.5);
    float gloss = pow(max(dot(N, normalize(L + V)), 0.0), 36.0) * 0.16;
    float rim = pow(1.0 - max(dot(N, V), 0.0), 3.0);
    return (col * (ambient + diffuse * 0.72) + gloss + rim * 0.16 * vec3(0.8, 0.88, 1.0)) * uTint;
  }`;

/** Light tint shared by every toy material on the page (white = the stage). */
export const TOY_TINT = { value: new Color(1, 1, 1) };

const skinVert = /* glsl */ `
  #include <common>
  #include <skinning_pars_vertex>
  attribute float aArm;
  attribute float aHand;
  attribute float aHead;
  uniform float uLid;
  uniform float uEyeY;
  varying vec3 vNv;
  varying vec3 vView;
  varying vec3 vBind;
  varying vec3 vMask;
  void main() {
    #include <skinbase_vertex>
    #include <begin_vertex>
    #include <beginnormal_vertex>
    #include <skinnormal_vertex>
    vBind = transformed;
    transformed.y = uEyeY + (transformed.y - uEyeY) * uLid; // blink (eyes only)
    #include <skinning_vertex>
    vMask = vec3(aArm, aHand, aHead);
    vec4 mv = modelViewMatrix * vec4(transformed, 1.0);
    vNv = normalize(normalMatrix * objectNormal);
    vView = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }`;

const bodyFrag = /* glsl */ `
  uniform vec3 uSkin;
  uniform vec3 uTop;
  uniform vec3 uTopBase;
  uniform vec3 uBottom;
  uniform vec3 uBottomBase;
  uniform vec3 uShoes;
  uniform vec3 uShoesBase;
  uniform vec3 uBands; // ankle, waist, neck (bind space y)
  uniform vec4 uEquipped; // head, top, bottom, shoes
  varying vec3 vNv;
  varying vec3 vView;
  varying vec3 vBind;
  varying vec3 vMask;
  ${LIGHT}
  float above(float edge) { return smoothstep(edge - 0.15, edge + 0.15, vBind.y); }
  void main() {
    float arm = step(0.5, vMask.x);
    float hand = step(0.5, vMask.y);
    float head = max(step(0.5, vMask.z), above(uBands.z)) * (1.0 - arm) * (1.0 - hand);
    float body = (1.0 - arm) * (1.0 - hand) * (1.0 - head);
    float top = arm + body * above(uBands.y);
    float bottom = body * above(uBands.x) * (1.0 - above(uBands.y));
    float shoes = body * (1.0 - above(uBands.x));
    vec3 col = uSkin * (head + hand)
      + mix(uTopBase, uTop, uEquipped.y) * top
      + mix(uBottomBase, uBottom, uEquipped.z) * bottom
      + mix(uShoesBase, uShoes, uEquipped.w) * shoes;
    gl_FragColor = vec4(toyLight(col, normalize(vNv), normalize(vView)), 1.0);
    #include <colorspace_fragment>
  }`;

const partVert = /* glsl */ `
  varying vec3 vNv;
  varying vec3 vView;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vNv = normalize(normalMatrix * normal);
    vView = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }`;
const partFrag = /* glsl */ `
  uniform vec3 uColor;
  varying vec3 vNv;
  varying vec3 vView;
  ${LIGHT}
  void main() {
    gl_FragColor = vec4(toyLight(uColor, normalize(vNv), normalize(vView)), 1.0);
    #include <colorspace_fragment>
  }`;

const toyPart = (color: string, side: Side = FrontSide) =>
  new ShaderMaterial({ vertexShader: partVert, fragmentShader: partFrag, side, uniforms: { uColor: { value: new Color(color) }, uTint: TOY_TINT } });

// ---- Rig ----

type Rig = {
  model: Object3D;
  body: SkinnedMesh;
  eyes: SkinnedMesh | null;
  bones: Record<string, Bone>;
  rest: Map<Bone, { q: Quaternion; s: Vector3 }>;
  head: { center: Vector3; radii: Vector3; face: Vector3; mouthY: number };
  bands: Vector3;
  eyeY: number;
  baseScale: number;
  footY: number;
  materials: ReturnType<typeof toyMaterials>;
};

const ARM = /^(Right|Left_)(Arm|ForeArm)_/;
const HAND = /Hand/;

const eyeFrag = /* glsl */ `
  uniform vec3 uColor;
  void main() {
    gl_FragColor = vec4(uColor, 1.0);
    #include <colorspace_fragment>
  }`;

/** Toy materials for the body (color bands by region) and the ink eyes (blink). */
function toyMaterials(bands: Vector3, eyeY: number, withEyes: boolean) {
  const body = new ShaderMaterial({
    vertexShader: skinVert,
    fragmentShader: bodyFrag,
    uniforms: {
      uSkin: { value: new Color(PALETTE.skin) },
      uTop: { value: new Color(PALETTE.top) },
      uTopBase: { value: new Color(PALETTE.topBase) },
      uBottom: { value: new Color(PALETTE.bottom) },
      uBottomBase: { value: new Color(PALETTE.bottomBase) },
      uShoes: { value: new Color(PALETTE.shoes) },
      uShoesBase: { value: new Color(PALETTE.shoesBase) },
      uBands: { value: bands },
      uEquipped: { value: new Vector4() },
      uLid: { value: 1 },
      uEyeY: { value: 0 },
      uTint: TOY_TINT,
    },
  });
  const eyes = withEyes
    ? new ShaderMaterial({
        vertexShader: skinVert,
        fragmentShader: eyeFrag,
        uniforms: { uColor: { value: new Color(PALETTE.ink) }, uLid: { value: 1 }, uEyeY: { value: eyeY } },
      })
    : null;
  return { body, eyes };
}

/** The joint's position in the mesh's bind space. */
function jointBind(mesh: SkinnedMesh, bone: Bone) {
  // Undo the skinning transform the joint itself would get, from where it is now.
  const i = mesh.skeleton.bones.indexOf(bone);
  const skin = new Matrix4()
    .copy(mesh.bindMatrixInverse)
    .multiply(bone.matrixWorld)
    .multiply(mesh.skeleton.boneInverses[i])
    .multiply(mesh.bindMatrix);
  const local = bone.getWorldPosition(new Vector3()).applyMatrix4(new Matrix4().copy(mesh.matrixWorld).invert());
  return local.applyMatrix4(skin.invert());
}

/** Rotate a bone about a world axis, keeping its children with it. */
function turnWorld(bone: Bone, axis: Vector3, angle: number) {
  const pw = bone.parent!.getWorldQuaternion(new Quaternion());
  const q = new Quaternion().setFromAxisAngle(axis, angle);
  bone.quaternion.premultiply(pw.clone().invert().multiply(q).multiply(pw));
  bone.updateMatrixWorld(true);
}

function buildRig(scene: Object3D): Rig {
  const model = clone(scene);
  model.updateMatrixWorld(true);
  const meshes: SkinnedMesh[] = [];
  model.traverse((o) => (o as SkinnedMesh).isSkinnedMesh && meshes.push(o as SkinnedMesh));
  const body = meshes.reduce((a, b) => (b.geometry.attributes.position.count > a.geometry.attributes.position.count ? b : a));
  const eyes = meshes.find((m) => m !== body) ?? null;
  const bones = Object.fromEntries(body.skeleton.bones.map((b) => [b.name.replace(/_\d+$/, "").replace("Left_", "Left"), b]));

  // Per-vertex masks from the dominant joint: sleeves, bare hands, head.
  const g = body.geometry;
  const pos = g.attributes.position;
  const si = g.attributes.skinIndex;
  const sw = g.attributes.skinWeight;
  const n = pos.count;
  const arm = new Float32Array(n);
  const hand = new Float32Array(n);
  const head = new Float32Array(n);
  const headBox = new Box3();
  for (let v = 0; v < n; v++) {
    let best = 0;
    for (let k = 1; k < 4; k++) if (sw.getComponent(v, k) > sw.getComponent(v, best)) best = k;
    const name = body.skeleton.bones[si.getComponent(v, best)].name;
    arm[v] = ARM.test(name) ? 1 : 0;
    hand[v] = HAND.test(name) ? 1 : 0;
    head[v] = /^Head/.test(name) ? 1 : 0;
    if (head[v]) headBox.expandByPoint(new Vector3().fromBufferAttribute(pos, v));
  }
  g.setAttribute("aArm", new BufferAttribute(arm, 1));
  g.setAttribute("aHand", new BufferAttribute(hand, 1));
  g.setAttribute("aHead", new BufferAttribute(head, 1));
  if (eyes) {
    const c = eyes.geometry.attributes.position.count;
    for (const a of ["aArm", "aHand", "aHead"]) eyes.geometry.setAttribute(a, new BufferAttribute(new Float32Array(c), 1));
  }

  const J = (k: string) => jointBind(body, bones[k]);
  const hips = J("Hips");
  const spine = J("Spine");
  const neck = J("Neck");
  const foot = J("RightFoot");
  const bands = new Vector3(foot.y + (hips.y - foot.y) * 0.12, hips.y + (spine.y - hips.y) * 0.5, neck.y + (J("Head").y - neck.y) * 0.4);

  // Face: the front of the head at mouth height, just under the eyes.
  const eyeBox = eyes ? new Box3().setFromBufferAttribute(eyes.geometry.attributes.position as BufferAttribute) : null;
  const mouthY = eyeBox ? eyeBox.min.y - (eyeBox.max.y - eyeBox.min.y) * 0.35 : headBox.min.y + (headBox.max.y - headBox.min.y) * 0.3;
  let faceZ = -Infinity;
  for (let v = 0; v < n; v++) {
    const x = pos.getX(v);
    const y = pos.getY(v);
    if (Math.abs(x) < 3 && Math.abs(y - mouthY) < 2) faceZ = Math.max(faceZ, pos.getZ(v));
  }
  const center = headBox.getCenter(new Vector3());
  const radii = headBox.getSize(new Vector3()).multiplyScalar(0.5);
  // Ears stick out sideways; the skull is narrower than the box.
  radii.x *= 0.86;

  // Relaxed pose: arms down from the T, elbows a touch bent.
  const down = (Math.PI / 180) * 68;
  turnWorld(bones.RightArm, new Vector3(0, 0, 1), down);
  turnWorld(bones.LeftArm, new Vector3(0, 0, 1), -down);
  turnWorld(bones.RightForeArm, new Vector3(0, 0, 1), 0.12);
  turnWorld(bones.LeftForeArm, new Vector3(0, 0, 1), -0.12);

  const rest = new Map(body.skeleton.bones.map((b) => [b, { q: b.quaternion.clone(), s: b.scale.clone() }]));

  // Scale to stage height with the feet on the floor.
  model.updateMatrixWorld(true);
  const box = new Box3().setFromObject(model, true);
  const baseScale = HEIGHT / (box.max.y - box.min.y);
  model.scale.multiplyScalar(baseScale);
  model.position.y = -box.min.y * baseScale;
  model.updateMatrixWorld(true);
  const footY = bones.RightFoot.getWorldPosition(new Vector3()).y;

  const eyeY = eyeBox ? eyeBox.getCenter(new Vector3()).y : 0;
  const materials = toyMaterials(bands, eyeY, !!eyes);
  body.material = materials.body;
  if (eyes && materials.eyes) eyes.material = materials.eyes;

  return {
    materials,
    model,
    body,
    eyes,
    bones,
    rest,
    head: { center, radii, face: new Vector3(0, mouthY, faceZ), mouthY },
    bands,
    eyeY,
    baseScale,
    footY,
  };
}

/**
 * Body morph by bone scale. Each bone gets an absolute [length, girth] scale;
 * since children inherit, a bone's local scale is its own over its parent's.
 * Bones run along local x here, so x is length and y/z are girth.
 */
function applyMorph(rig: Rig, m: BodyMorph, breath = 0) {
  const h = m.height ?? 0;
  const w = m.weight ?? 0;
  const mu = m.muscle ?? 0;
  const fem = m.body === "female" ? 1 : 0;
  const masc = m.body === "male" ? 1 : 0;
  const abs: Record<string, [number, number]> = {
    Hips: [1, 1 + 0.14 * w + 0.06 * fem],
    Spine: [1 + 0.06 * h, 1 + 0.18 * w - 0.03 * fem],
    Spine1: [1 + 0.06 * h, 1 + 0.15 * w + 0.04 * mu + 0.04 * masc + breath],
    Spine2: [1, 1],
    RightUpLeg: [1 + 0.45 * h, 1 + 0.16 * w + 0.05 * mu],
    RightLeg: [1 + 0.45 * h, 1 + 0.12 * w + 0.04 * mu],
    RightFoot: [1, 1],
    RightArm: [1 + 0.08 * h, 1 + 0.12 * w + 0.2 * mu],
    RightForeArm: [1 + 0.08 * h, 1 + 0.1 * w + 0.14 * mu],
    RightHand: [1, 1],
  };
  for (const [k, b] of Object.entries(rig.bones)) {
    const key = k.replace(/^Left/, "Right");
    const own = abs[key];
    if (!own) continue;
    const parentKey = (b.parent as Bone | null)?.name.replace(/_\d+$/, "").replace("Left_", "Right").replace(/^Left/, "Right");
    const parent = (parentKey && abs[parentKey]) || [1, 1];
    const r = rig.rest.get(b)!.s;
    b.scale.set((r.x * own[0]) / parent[0], (r.y * own[1]) / parent[1], (r.z * own[1]) / parent[1]);
  }
  rig.model.updateMatrixWorld(true);
  // Longer legs push the feet below the floor; lift the whole figure back up.
  // Measured in the model's parent space, so it holds wherever the figure stands.
  const foot = rig.bones.RightFoot.getWorldPosition(new Vector3());
  const y = rig.model.parent ? rig.model.parent.worldToLocal(foot).y : foot.y;
  rig.model.position.y += rig.footY - y;
}

// ---- Head parts, built in the body's bind space and carried by the head bone ----

function Hair({ style, head }: { style: HairStyle; head: Rig["head"] }) {
  const mat = useMemo(() => toyPart(PALETTE.hair, DoubleSide), []);
  const { center: c, radii: r } = head;
  const s = 1.07;
  const cap = (
    // Top and back of the skull; the open side faces the brow.
    <mesh material={mat} position={[c.x, c.y + r.y * 0.02, c.z - r.z * 0.03]} rotation-x={-0.5} scale={[r.x * s, r.y * s, r.z * s]}>
      <sphereGeometry args={[1, 40, 24, 0, Math.PI * 2, 0, Math.PI * 0.56]} />
    </mesh>
  );
  // A shell around the skull, open over the face, falling to `drop` (0 = crown, 1 = chin).
  const shell = (drop: number) => (
    <mesh material={mat} position={[c.x, c.y, c.z - r.z * 0.04]} scale={[r.x * 1.15, r.y * 1.07, r.z * 1.1]}>
      <sphereGeometry args={[1, 40, 24, Math.PI / 2 + 0.85, Math.PI * 2 - 1.7, 0, Math.PI * drop]} />
    </mesh>
  );
  // Long hair: a slab down the back to the shoulders.
  const back = (
    <mesh material={mat} position={[c.x, c.y - r.y * 0.75, c.z - r.z * 0.55]} rotation-x={0.12} scale={[r.x * 1.02, r.y * 0.85, r.z * 0.42]}>
      <sphereGeometry args={[1, 32, 20]} />
    </mesh>
  );
  return (
    <group>
      {cap}
      {style === "bob" && shell(0.8)}
      {style === "long" && (
        <>
          {shell(0.86)}
          {back}
        </>
      )}
      {style === "ponytail" && (
        <>
          <mesh material={mat} position={[c.x, c.y + r.y * 0.15, c.z - r.z * 1.08]} scale={[r.x * 0.2, r.y * 0.2, r.z * 0.2]}>
            <sphereGeometry args={[1, 20, 14]} />
          </mesh>
          <mesh material={mat} position={[c.x, c.y - r.y * 0.3, c.z - r.z * 1.18]} rotation-x={0.2} scale={[r.x * 0.2, r.y * 0.52, r.z * 0.2]}>
            <sphereGeometry args={[1, 20, 14]} />
          </mesh>
        </>
      )}
      {style === "bun" && (
        <mesh material={mat} position={[c.x, c.y + r.y * 0.98, c.z - r.z * 0.35]} scale={[r.x * 0.36, r.y * 0.3, r.z * 0.36]}>
          <sphereGeometry args={[1, 24, 16]} />
        </mesh>
      )}
    </group>
  );
}

function Hat({ head }: { head: Rig["head"] }) {
  const mat = useMemo(() => toyPart(PALETTE.hat), []);
  const { center: c, radii: r } = head;
  return (
    <group position={[c.x, c.y + r.y * 0.12, c.z - r.z * 0.04]}>
      {/* Dome over the hair, its rim at the brow. */}
      <mesh material={mat} rotation-x={-0.14} scale={[r.x * 1.2, r.y * 1.08, r.z * 1.19]}>
        <sphereGeometry args={[1, 40, 20, 0, Math.PI * 2, 0, Math.PI * 0.5]} />
      </mesh>
      {/* Brim: a flattened disc poking out over the forehead. */}
      <mesh material={mat} position={[0, r.y * 0.04, r.z * 1.24]} rotation-x={0.22} scale={[r.x * 0.62, r.y * 0.045, r.z * 0.4]}>
        <sphereGeometry args={[1, 32, 12]} />
      </mesh>
    </group>
  );
}

function Smile({ head }: { head: Rig["head"] }) {
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

export function Chibi({ morph, equipped }: { morph: BodyMorph; equipped: Record<EquipSlotKey, boolean> }) {
  const { scene } = useGLTF(CHIBI_URL);
  const rig = useMemo(() => buildRig(scene), [scene]);
  const [still] = useState(prefersReducedMotion);
  const root = useRef<Group>(null);
  // Per-frame writes go through a ref, like CharacterViewport's shader refs.
  const live = useRef<Rig | null>(null);
  useEffect(() => {
    live.current = rig;
  }, [rig]);

  const key = `${morph.body},${morph.height},${morph.weight},${morph.muscle}`;
  useEffect(() => {
    if (live.current) applyMorph(live.current, morph);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed by value
  }, [rig, key]);

  useFrame(({ clock }) => {
    const r = live.current;
    if (!r) return;
    r.materials.body.uniforms.uEquipped.value.fromArray(EQUIP_SLOTS.map((k) => (equipped[k] ? 1 : 0)));
    if (still) return;
    const t = clock.elapsedTime;
    const b = t % 4.2;
    if (r.materials.eyes) r.materials.eyes.uniforms.uLid.value = b < 0.12 ? Math.abs(b / 0.06 - 1) * 0.9 + 0.1 : 1;
    applyMorph(r, morph, Math.sin(t * 1.6) * 0.012);
    if (root.current) root.current.rotation.z = Math.sin(t * 1.1) * 0.022;
  });

  // Head parts ride on the head bone: local = boneInverse × bindMatrix maps bind space onto it.
  const headBone = rig.bones.Head;
  const toBone = useMemo(() => {
    const i = rig.body.skeleton.bones.indexOf(headBone);
    return new Matrix4().copy(rig.body.skeleton.boneInverses[i]).multiply(rig.body.bindMatrix);
  }, [rig, headBone]);
  const style = morph.hair ?? DEFAULT_HAIR[morph.body];

  return (
    <group ref={root}>
      <primitive object={rig.model} />
      {createPortal(
        <group matrix={toBone} matrixAutoUpdate={false}>
          <Smile head={rig.head} />
          <Hair style={style} head={rig.head} />
          {equipped.head && <Hat head={rig.head} />}
        </group>,
        headBone,
      )}
    </group>
  );
}

function radialTexture(inner: string, outer: string) {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d")!;
  const grd = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  grd.addColorStop(0, inner);
  grd.addColorStop(1, outer);
  g.fillStyle = grd;
  g.fillRect(0, 0, 256, 256);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
}

function Ground() {
  const mats = useMemo(
    () => ({
      grass: new MeshBasicMaterial({ map: radialTexture("rgba(198,228,180,1)", "rgba(198,228,180,0)"), transparent: true, depthWrite: false }),
      shadow: new MeshBasicMaterial({ map: radialTexture("rgba(70,50,30,0.35)", "rgba(70,50,30,0)"), transparent: true, depthWrite: false }),
    }),
    [],
  );
  return (
    <group scale={0.5}>
      <mesh rotation-x={-Math.PI / 2} material={mats.grass}>
        <circleGeometry args={[0.95, 64]} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position-y={0.003} material={mats.shadow}>
        <circleGeometry args={[0.4, 48]} />
      </mesh>
    </group>
  );
}

export default function ChibiViewport({ morph, equipped }: { morph: BodyMorph; equipped: Record<EquipSlotKey, boolean> }) {
  const [still] = useState(prefersReducedMotion);
  return (
    <Canvas camera={{ position: [0, 0.55, 2.1], fov: 28 }} dpr={[1, 2]} gl={{ antialias: true, alpha: true }} flat>
      <Suspense fallback={null}>
        <Chibi morph={morph} equipped={equipped} />
      </Suspense>
      <Ground />
      <OrbitControls
        target={[0, 0.43, 0]}
        enablePan={false}
        enableZoom={false}
        enableDamping
        autoRotate={!still}
        autoRotateSpeed={0.6}
        minPolarAngle={Math.PI / 2 - Math.atan2(0.12, 2.1)}
        maxPolarAngle={Math.PI / 2 - Math.atan2(0.12, 2.1)}
      />
    </Canvas>
  );
}

useGLTF.preload(CHIBI_URL);
