import {
  Bone,
  Box3,
  BufferAttribute,
  Color,
  DoubleSide,
  FrontSide,
  Matrix4,
  Object3D,
  Quaternion,
  ShaderMaterial,
  SkinnedMesh,
  Vector3,
  Vector4,
  type Side,
} from "three";
import { clone } from "three/examples/jsm/utils/SkeletonUtils.js";
import { BASE_PATH } from "./basePath";
import type { EquipSlotKey, HairStyle } from "./game";
import type { BodyMorph } from "./morph";

// The character (docs/DESIGN.md §8): "Free Pack - Chibi Base Mesh (Rigged)" by
// DuNguyn Studio (CC-BY-4.0), dressed as a soft vinyl toy. Matte color blocks
// with a little gloss, lit from the viewer's side so the face always reads.
// Equipment slots are color regions cut per pixel: an equipped slot wears
// color, an empty one a plain basic garment. Sky blue marks events: the
// hovered slot's rim and the equip flash.

export const CHIBI_URL = `${BASE_PATH}/models/chibi/scene.gltf`;

export const PALETTE = {
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
export const SKY = new Color("#4f9bd9");
export const SLOT_INDEX: Record<EquipSlotKey, number> = { head: 1, top: 2, bottom: 3, shoes: 4 };
export const DEFAULT_HAIR: Record<BodyMorph["body"], HairStyle> = { female: "bob", male: "short", neutral: "short" };
/** Average figure height in world units; the stage camera is framed for it. */
export const FIGURE_HEIGHT = 0.8;

/** Light tint shared by every toy material (white on the stage; the village sets it by time of day). */
export const TOY_TINT = { value: new Color(1, 1, 1) };

// Soft key from the viewer's upper left, sky/ground ambient, vinyl gloss, rim;
// then the event marks: dim the rest while a slot is hovered, rim it in sky,
// flash it white on equip.
const LIGHT = /* glsl */ `
  uniform vec3 uTint;
  uniform vec3 uAccent;
  vec3 toyLight(vec3 col, vec3 N, vec3 V, float lit, float dim, float flash) {
    vec3 L = normalize(vec3(-0.45, 0.6, 0.66));
    float diffuse = clamp((dot(N, L) + 0.35) / 1.35, 0.0, 1.0);
    float ambient = mix(0.34, 0.52, N.y * 0.5 + 0.5);
    float gloss = pow(max(dot(N, normalize(L + V)), 0.0), 36.0) * 0.16;
    float facing = max(dot(N, V), 0.0);
    float rim = pow(1.0 - facing, 3.0);
    vec3 c = col * (ambient + diffuse * 0.72) + gloss + rim * 0.16 * vec3(0.8, 0.88, 1.0);
    c = mix(c, c * 0.45, dim);
    c = mix(c, uAccent, lit * 0.12) + uAccent * lit * pow(1.0 - facing, 2.0) * 0.9;
    c = mix(c, vec3(1.0), flash * 0.6) + uAccent * flash * rim;
    return c * uTint;
  }`;

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

// Regions: sleeves and bare hands by bone weight, the rest by bind-space
// height bands (ankle, waist, neck) so the hems stay clean.
const bodyFrag = /* glsl */ `
  uniform vec3 uSkin;
  uniform vec3 uTop;
  uniform vec3 uTopBase;
  uniform vec3 uBottom;
  uniform vec3 uBottomBase;
  uniform vec3 uShoes;
  uniform vec3 uShoesBase;
  uniform vec3 uBands;
  uniform vec4 uEquipped; // head, top, bottom, shoes
  uniform float uSlot;
  uniform float uHover;
  uniform float uFlashSlot;
  uniform float uFlash;
  varying vec3 vNv;
  varying vec3 vView;
  varying vec3 vBind;
  varying vec3 vMask;
  ${LIGHT}
  float above(float edge) { return smoothstep(edge - 0.15, edge + 0.15, vBind.y); }
  float isSlot(float a, float b) { return step(abs(a - b), 0.5); }
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
    vec4 region = vec4(head, top, bottom, shoes);
    vec4 hovered = vec4(isSlot(uSlot, 1.0), isSlot(uSlot, 2.0), isSlot(uSlot, 3.0), isSlot(uSlot, 4.0));
    vec4 flashed = vec4(isSlot(uFlashSlot, 1.0), isSlot(uFlashSlot, 2.0), isSlot(uFlashSlot, 3.0), isSlot(uFlashSlot, 4.0));
    float lit = dot(region, hovered) * uHover;
    gl_FragColor = vec4(toyLight(col, normalize(vNv), normalize(vView), lit, uHover * (1.0 - lit), dot(region, flashed) * uFlash), 1.0);
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

// Hair and hat: one color, and the head slot's hover/flash state copied in.
const partFrag = /* glsl */ `
  uniform vec3 uColor;
  uniform float uLit;
  uniform float uDim;
  uniform float uFlash;
  varying vec3 vNv;
  varying vec3 vView;
  ${LIGHT}
  void main() {
    gl_FragColor = vec4(toyLight(uColor, normalize(vNv), normalize(vView), uLit, uDim, uFlash), 1.0);
    #include <colorspace_fragment>
  }`;

const eyeFrag = /* glsl */ `
  uniform vec3 uColor;
  void main() {
    gl_FragColor = vec4(uColor, 1.0);
    #include <colorspace_fragment>
  }`;

const part = (color: string, side: Side = FrontSide) =>
  new ShaderMaterial({
    vertexShader: partVert,
    fragmentShader: partFrag,
    side,
    uniforms: {
      uColor: { value: new Color(color) },
      uAccent: { value: SKY },
      uTint: TOY_TINT,
      uLit: { value: 0 },
      uDim: { value: 0 },
      uFlash: { value: 0 },
    },
  });

function toyMaterials(bands: Vector3, eyeY: number) {
  return {
    body: new ShaderMaterial({
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
        uAccent: { value: SKY },
        uTint: TOY_TINT,
        uSlot: { value: 0 },
        uHover: { value: 0 },
        uFlashSlot: { value: 0 },
        uFlash: { value: 0 },
      },
    }),
    eyes: new ShaderMaterial({
      vertexShader: skinVert,
      fragmentShader: eyeFrag,
      uniforms: { uColor: { value: new Color(PALETTE.ink) }, uLid: { value: 1 }, uEyeY: { value: eyeY } },
    }),
    hair: part(PALETTE.hair, DoubleSide),
    hat: part(PALETTE.hat, DoubleSide),
  };
}

export type Rig = {
  model: Object3D;
  body: SkinnedMesh;
  bones: Record<string, Bone>;
  rest: Map<Bone, Vector3>;
  /** Skull in the body's bind space: where hair, hat and the smile go. */
  head: { center: Vector3; radii: Vector3; face: Vector3 };
  /** Maps bind space onto the head bone, for parts that ride on it. */
  headToBone: Matrix4;
  footY: number;
  materials: ReturnType<typeof toyMaterials>;
  /** Limbs that swing when walking: rest pose and the side-to-side axis in the parent's space. */
  gait: Record<GaitBone, { bone: Bone; rest: Quaternion; axis: Vector3 }>;
};

const GAIT_BONES = ["LeftUpLeg", "RightUpLeg", "LeftLeg", "RightLeg", "LeftArm", "RightArm"] as const;
type GaitBone = (typeof GAIT_BONES)[number];

const ARM = /^(Right|Left_)(Arm|ForeArm)_/;
const HAND = /Hand/;

/** The joint's position in the mesh's bind space. */
function jointBind(mesh: SkinnedMesh, bone: Bone) {
  // Undo the skinning transform the joint itself gets, from where it is now.
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

/** A fresh, dressed copy of the loaded chibi, standing at FIGURE_HEIGHT with its feet at y = 0. */
export function buildRig(scene: Object3D): Rig {
  const model = clone(scene);
  model.updateMatrixWorld(true);
  const meshes: SkinnedMesh[] = [];
  model.traverse((o) => (o as SkinnedMesh).isSkinnedMesh && meshes.push(o as SkinnedMesh));
  const body = meshes.reduce((a, b) => (b.geometry.attributes.position.count > a.geometry.attributes.position.count ? b : a));
  const eyes = meshes.find((m) => m !== body) ?? null;
  // Bone names lose their numeric suffix: "Left_Arm_017" → "LeftArm".
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
    if (Math.abs(pos.getX(v)) < 3 && Math.abs(pos.getY(v) - mouthY) < 2) faceZ = Math.max(faceZ, pos.getZ(v));
  }
  const center = headBox.getCenter(new Vector3());
  const radii = headBox.getSize(new Vector3()).multiplyScalar(0.5);
  radii.x *= 0.86; // the ears stick out; the skull is narrower than the box

  // Relaxed pose: arms down from the T, elbows a touch bent.
  const down = (Math.PI / 180) * 68;
  turnWorld(bones.RightArm, new Vector3(0, 0, 1), down);
  turnWorld(bones.LeftArm, new Vector3(0, 0, 1), -down);
  turnWorld(bones.RightForeArm, new Vector3(0, 0, 1), 0.12);
  turnWorld(bones.LeftForeArm, new Vector3(0, 0, 1), -0.12);
  const rest = new Map(body.skeleton.bones.map((b) => [b, b.scale.clone()]));

  // Walking swings limbs about the figure's side-to-side axis (world x here, the
  // figure facing +z), taken into each bone's parent space once, at rest.
  const side = new Vector3(1, 0, 0);
  const gait = Object.fromEntries(
    GAIT_BONES.map((k) => {
      const bone = bones[k];
      const pw = bone.parent!.getWorldQuaternion(new Quaternion()).invert();
      return [k, { bone, rest: bone.quaternion.clone(), axis: side.clone().applyQuaternion(pw).normalize() }];
    }),
  ) as Rig["gait"];

  model.updateMatrixWorld(true);
  const box = new Box3().setFromObject(model, true);
  const scale = FIGURE_HEIGHT / (box.max.y - box.min.y);
  model.scale.multiplyScalar(scale);
  model.position.y = -box.min.y * scale;
  model.updateMatrixWorld(true);

  const materials = toyMaterials(bands, eyeBox ? eyeBox.getCenter(new Vector3()).y : 0);
  body.material = materials.body;
  if (eyes) eyes.material = materials.eyes;

  const hi = body.skeleton.bones.indexOf(bones.Head);
  return {
    model,
    body,
    bones,
    rest,
    head: { center, radii, face: new Vector3(0, mouthY, faceZ) },
    headToBone: new Matrix4().copy(body.skeleton.boneInverses[hi]).multiply(body.bindMatrix),
    footY: bones.RightFoot.getWorldPosition(new Vector3()).y,
    materials,
    gait,
  };
}

const SWING = new Quaternion();

/**
 * Walk cycle on top of the rest pose: legs swing opposite each other, the
 * trailing knee bends, arms swing against the legs. `amount` 0 is standing.
 */
export function poseWalk(rig: Rig, phase: number, amount: number) {
  const s = Math.sin(phase);
  const swing = (k: GaitBone, angle: number) => {
    const g = rig.gait[k];
    g.bone.quaternion.copy(g.rest).premultiply(SWING.setFromAxisAngle(g.axis, angle * amount));
  };
  swing("LeftUpLeg", 0.55 * s);
  swing("RightUpLeg", -0.55 * s);
  // The leg swinging back bends at the knee.
  swing("LeftLeg", 0.7 * Math.max(0, s));
  swing("RightLeg", 0.7 * Math.max(0, -s));
  swing("LeftArm", -0.45 * s);
  swing("RightArm", 0.45 * s);
}

const RIGHT = (name: string) => name.replace(/_\d+$/, "").replace("Left_", "Right").replace(/^Left/, "Right");

/**
 * Body morph by bone scale. Each bone gets an absolute [length, girth] scale;
 * since children inherit, a bone's local scale is its own over its parent's.
 * Bones run along local x here, so x is length and y/z are girth. Height
 * stretches the legs and trunk, weight the hips, trunk and legs, muscle the
 * arms and chest. `breath` swells the chest for the idle loop.
 */
export function applyMorph(rig: Rig, m: BodyMorph, breath = 0) {
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
    const own = abs[k.replace(/^Left/, "Right")];
    if (!own) continue;
    const parent = (b.parent && abs[RIGHT(b.parent.name)]) || [1, 1];
    const r = rig.rest.get(b)!;
    b.scale.set((r.x * own[0]) / parent[0], (r.y * own[1]) / parent[1], (r.z * own[1]) / parent[1]);
  }
  rig.model.updateMatrixWorld(true);
  // Longer legs push the feet below the floor; lift the figure back up.
  // Measured in the model's parent space, so it holds wherever the figure stands.
  const foot = rig.bones.RightFoot.getWorldPosition(new Vector3());
  rig.model.position.y += rig.footY - (rig.model.parent ? rig.model.parent.worldToLocal(foot).y : foot.y);
}
