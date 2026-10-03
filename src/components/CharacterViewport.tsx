"use client";

import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  CatmullRomCurve3,
  Color,
  DoubleSide,
  Group,
  MeshBasicMaterial,
  PerspectiveCamera,
  PointsMaterial,
  Quaternion,
  ShaderMaterial,
  SRGBColorSpace,
  TubeGeometry,
  Vector3,
  Vector4,
} from "three";
import { isBooting, useEffectSkip, useGameEvent, useGameEvents } from "@/lib/events";
import { buildBody, SLOT_INDEX, type BodyMesh, type Face, type V3 } from "@/lib/bodyMesh";
import { EQUIP_SLOTS, type EquipSlotKey, type Rarity } from "@/lib/game";
import type { BodyMorph } from "@/lib/morph";
import { prefersReducedMotion } from "@/lib/motion";

// Brand colors (docs/BRAND.md): sky marks hover and equip, sun the sparkles.
const SKY = new Color("#4f9bd9");
const SUN = new Color("#f5b83d");
const RARITY_COLOR: Record<Rarity, string> = {
  common: "#a39a90",
  uncommon: "#4fae6e",
  rare: "#4f9be0",
  epic: "#a77be0",
  legendary: "#f0a030",
};
// Framed for the tallest SD figure, so a taller profile reads taller on stage.
const TARGET: [number, number, number] = [0, 0.43, 0];
const CAMERA: [number, number, number] = [0, 0.55, 2.1];
const POLAR = Math.PI / 2 - Math.atan2(CAMERA[1] - TARGET[1], CAMERA[2]);
const FLOOR_SCALE = 0.5;
// Narrowest stage aspect (width / height) that still shows the whole figure.
const MIN_ASPECT = 0.62;

// Effect durations (ms), all within the 1.8s cap of docs/BRAND.md.
const POP_MS = 700;
const RING_MS = 900;
const FLASH_DELAY_MS = 600; // lands as the DOM equip flight arrives
const FLASH_MS = 900;
const PILLAR_MS = 1500;

/** Start time of a one-shot effect; progress() is 0→1 while it runs, ≥1 after. */
function useOneShot() {
  const start = useRef(-Infinity);
  return useMemo(
    () => ({
      fire: (delay = 0) => (start.current = performance.now() + delay),
      finish: () => (start.current = -Infinity),
      progress: (ms: number) => (performance.now() - start.current) / ms,
    }),
    [],
  );
}

// The character is a soft vinyl toy: matte color blocks with a little gloss,
// lit from the viewer's side so the face always reads. Sky blue marks events:
// the hovered slot's rim and the equip flash.
//
// Equipment slots are horizontal bands (ankle / waist / neck) cut per pixel,
// so their edges stay clean like a hem; arms count as the top down to the
// wrist, hair as the head. An equipped slot wears color; an empty one a plain
// basic garment.
const PALETTE = {
  skin: "#f3d5bf",
  hair: "#4b362f",
  top: "#7b93d4",
  topBase: "#ece8e1",
  bottom: "#45507a",
  bottomBase: "#cdc4b6",
  shoes: "#e08a68",
  shoesBase: "#9a948e",
};

const toyVert = /* glsl */ `
  attribute float hair;
  attribute float arm;
  uniform float uTime;
  uniform float uBreath;
  varying vec3 vNv;
  varying vec3 vView;
  varying vec3 vPos;
  varying float vHair;
  varying float vArm;
  void main() {
    vec3 p = position;
    float chest = smoothstep(0.2, 0.27, p.y) * (1.0 - smoothstep(0.32, 0.36, p.y));
    p.xz *= 1.0 + sin(uTime * 1.6) * 0.012 * chest * uBreath;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    vPos = position;
    vHair = hair;
    vArm = arm;
    vNv = normalize(normalMatrix * normal);
    vView = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }`;

const toyFrag = /* glsl */ `
  uniform vec3 uSkin;
  uniform vec3 uHair;
  uniform vec3 uTop;
  uniform vec3 uTopBase;
  uniform vec3 uBottom;
  uniform vec3 uBottomBase;
  uniform vec3 uShoes;
  uniform vec3 uShoesBase;
  uniform vec3 uAccent;
  uniform float uSlot;
  uniform float uHover;
  uniform vec4 uBands; // ankle, waist, neck, wrist
  uniform vec4 uEquipped; // head, top, bottom, shoes
  uniform float uFlashSlot;
  uniform float uFlash;
  uniform vec3 uHeadC;
  uniform vec3 uHeadR;
  varying vec3 vNv;
  varying vec3 vView;
  varying vec3 vPos;
  varying float vHair;
  varying float vArm;
  float above(float edge) { return smoothstep(edge - 0.002, edge + 0.002, vPos.y); }
  float isSlot(float a, float b) { return step(abs(a - b), 0.5); }
  void main() {
    vec3 N = normalize(vNv);
    vec3 V = normalize(vView);

    // Hair is whatever the mask allows that also stands off the scalp.
    float scalp = length((vPos - uHeadC) / uHeadR);
    float hairM = step(0.5, vHair) * smoothstep(1.015, 1.035, scalp);
    float armM = step(0.5, vArm) * (1.0 - step(0.5, vHair));
    float bodyM = 1.0 - armM;
    float headW = above(uBands.z) * bodyM;
    float topW = above(uBands.y) * (1.0 - above(uBands.z)) * bodyM + above(uBands.w) * armM;
    float handW = (1.0 - above(uBands.w)) * armM;
    float bottomW = above(uBands.x) * (1.0 - above(uBands.y)) * bodyM;
    float shoesW = (1.0 - above(uBands.x)) * bodyM;

    vec3 col = uSkin * (headW + handW)
      + mix(uTopBase, uTop, uEquipped.y) * topW
      + mix(uBottomBase, uBottom, uEquipped.z) * bottomW
      + mix(uShoesBase, uShoes, uEquipped.w) * shoesW;
    col = mix(col, uHair, hairM);

    // Soft key from the viewer's upper left, sky/ground ambient, vinyl gloss, rim.
    vec3 L = normalize(vec3(-0.45, 0.6, 0.66));
    float diffuse = clamp((dot(N, L) + 0.35) / 1.35, 0.0, 1.0);
    float ambient = mix(0.34, 0.52, N.y * 0.5 + 0.5);
    float gloss = pow(max(dot(N, normalize(L + V)), 0.0), 36.0) * 0.16;
    float facing = max(dot(N, V), 0.0);
    float rim = pow(1.0 - facing, 3.0);
    vec3 c = col * (ambient + diffuse * 0.72) + gloss + rim * 0.16 * vec3(0.8, 0.88, 1.0);

    vec4 region = vec4(headW + hairM * (1.0 - headW), topW, bottomW, shoesW);
    float pick = dot(region, vec4(isSlot(uSlot, 1.0), isSlot(uSlot, 2.0), isSlot(uSlot, 3.0), isSlot(uSlot, 4.0)));
    float flash = dot(region, vec4(isSlot(uFlashSlot, 1.0), isSlot(uFlashSlot, 2.0), isSlot(uFlashSlot, 3.0), isSlot(uFlashSlot, 4.0))) * uFlash;
    float lit = pick * uHover;
    float dim = uHover * (1.0 - lit);
    c = mix(c, c * 0.45, dim);
    c = mix(c, uAccent, lit * 0.12) + uAccent * lit * pow(1.0 - facing, 2.0) * 0.9;
    c = mix(c, vec3(1.0), flash * 0.6) + uAccent * flash * rim;

    gl_FragColor = vec4(c, 1.0);
    #include <colorspace_fragment>
  }`;

const beamVert = /* glsl */ `
  varying float vY;
  void main() {
    vY = position.y;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }`;

// The pillar only shows when a tier or class change flares it in rarity color.
const beamFrag = /* glsl */ `
  uniform vec3 uColor;
  uniform float uBoost;
  varying float vY;
  void main() {
    float t = (vY + 1.0) / 2.0;
    float a = uBoost * (1.0 - t) * 0.45;
    gl_FragColor = vec4(uColor, a);
    #include <colorspace_fragment>
  }`;

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

// Toy-like settle: overshoot a little, then rest.
const outBack = (t: number) => 1 + 2.7 * (t - 1) ** 3 + 1.7 * (t - 1) ** 2;

function ToyBody({ morph, equipped }: { morph: BodyMorph; equipped: Record<EquipSlotKey, boolean> }) {
  const hovered = useGameEvents((s) => s.hoveredSlot);
  const [body, setBody] = useState<BodyMesh | null>(null);
  const [still] = useState(prefersReducedMotion);
  const eyes = useRef<(Group | null)[]>([]);
  const root = useRef<Group>(null);
  const pop = useOneShot();
  const flash = useOneShot();
  const flashSlot = useRef(0);

  // Rebuild on value changes only; callers may hand us a fresh object each render.
  const key = `${morph.body},${morph.hair},${morph.height},${morph.weight},${morph.muscle}`;

  // Meshing takes a couple hundred ms; let the stage paint first. The first
  // body to appear during boot pops onto the stage.
  useEffect(() => {
    let next: BodyMesh | null = null;
    const id = setTimeout(() => {
      next = buildBody(morph);
      if (isBooting() && !still) pop.fire();
      setBody(next);
    }, 0);
    return () => {
      clearTimeout(id);
      next?.geometry.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed by value
  }, [key]);

  useGameEvent((e) => {
    if (e.type !== "equip") return;
    flashSlot.current = SLOT_INDEX[e.slot];
    flash.fire(still ? 0 : FLASH_DELAY_MS);
  });
  useEffectSkip(() => {
    pop.finish();
    flash.finish();
  });

  const shell = useRef<ShaderMaterial>(null);
  const uniforms = useMemo(
    () => ({
      uSkin: { value: new Color(PALETTE.skin) },
      uHair: { value: new Color(PALETTE.hair) },
      uTop: { value: new Color(PALETTE.top) },
      uTopBase: { value: new Color(PALETTE.topBase) },
      uBottom: { value: new Color(PALETTE.bottom) },
      uBottomBase: { value: new Color(PALETTE.bottomBase) },
      uShoes: { value: new Color(PALETTE.shoes) },
      uShoesBase: { value: new Color(PALETTE.shoesBase) },
      uAccent: { value: SKY },
      uTime: { value: 0 },
      uBreath: { value: still ? 0 : 1 },
      uSlot: { value: 0 },
      uHover: { value: 0 },
      uBands: { value: new Vector4() },
      uEquipped: { value: new Vector4() },
      uFlashSlot: { value: 0 },
      uFlash: { value: 0 },
      uHeadC: { value: new Vector3() },
      uHeadR: { value: new Vector3(1, 1, 1) },
    }),
    [still],
  );

  useFrame(({ clock }, dt) => {
    if (!shell.current || !body) return;
    const u = shell.current.uniforms;
    const b = body.bands;
    u.uBands.value.set(b.ankle, b.waist, b.neck, b.wrist);
    u.uHeadC.value.set(...body.head.center);
    u.uHeadR.value.set(...body.head.radii);
    u.uEquipped.value.set(...EQUIP_SLOTS.map((k) => (equipped[k] ? 1 : 0)));
    if (!still) u.uTime.value = clock.elapsedTime;
    if (hovered) u.uSlot.value = SLOT_INDEX[hovered];
    u.uHover.value += ((hovered ? 1 : 0) - u.uHover.value) * Math.min(1, dt * 10);

    // Boot: the toy pops up from the floor and settles.
    const pp = pop.progress(POP_MS);
    if (root.current) root.current.scale.setScalar(pp >= 0 && pp < 1 ? Math.max(0.001, outBack(pp)) : 1);

    const pf = flash.progress(FLASH_MS);
    u.uFlashSlot.value = flashSlot.current;
    u.uFlash.value = pf >= 0 && pf < 1 ? (1 - pf) ** 2 : 0;

    if (still) return;
    // Blink: a quick squash every few seconds.
    const t = clock.elapsedTime % 4.2;
    const lid = t < 0.12 ? Math.abs(t / 0.06 - 1) * 0.9 + 0.1 : 1;
    eyes.current.forEach((e) => e?.scale.set(1, lid, 1));
    // Idle: a gentle side-to-side sway from the feet, like a toy wobbling.
    if (root.current) root.current.rotation.z = Math.sin(clock.elapsedTime * 1.1) * 0.022;
  });

  if (!body) return null;
  const { geometry, face } = body;
  return (
    <group ref={root}>
      <FaceDecals face={face} eyes={eyes} />
      <mesh geometry={geometry}>
        <shaderMaterial ref={shell} vertexShader={toyVert} fragmentShader={toyFrag} uniforms={uniforms} />
      </mesh>
    </group>
  );
}

const INK = "#2e2422";
const Z_AXIS = new Vector3(0, 0, 1);
const faceTo = (n: V3) => new Quaternion().setFromUnitVectors(Z_AXIS, new Vector3(...n));

// Two plain ink eyes and a short smile, laid on the face surface. Eyes blink
// by squashing their own group.
function FaceDecals({ face, eyes }: { face: Face; eyes: RefObject<(Group | null)[]> }) {
  const mouth = useMemo(() => new TubeGeometry(new CatmullRomCurve3(face.mouth.map((p) => new Vector3(...p))), 12, 0.003, 6), [face]);
  useEffect(() => () => mouth.dispose(), [mouth]);
  return (
    <>
      {face.eyes.map(({ p, n }, i) => (
        <group key={i} position={p} quaternion={faceTo(n)}>
          <group ref={(g) => void (eyes.current[i] = g)}>
            <mesh scale={[0.016, 0.021, 0.005]}>
              <sphereGeometry args={[1, 20, 14]} />
              <meshBasicMaterial color={INK} />
            </mesh>
          </group>
        </group>
      ))}
      <mesh geometry={mouth}>
        <meshBasicMaterial color={INK} />
      </mesh>
    </>
  );
}

const RING_POINTS = 96;

// Stat saved: one ring of sparks spreads out from the feet and fades.
function RingBurst() {
  const mat = useRef<PointsMaterial>(null);
  const pts = useRef<Group>(null);
  const burst = useOneShot();
  const [still] = useState(prefersReducedMotion);
  const geometry = useMemo(() => {
    const g = new BufferGeometry();
    const p = new Float32Array(RING_POINTS * 3);
    for (let i = 0; i < RING_POINTS; i++) {
      const a = (i / RING_POINTS) * Math.PI * 2;
      // Slight jitter so it reads as sparks rather than a drawn circle.
      const r = 1 + Math.sin(i * 12.9898) * 0.06;
      p.set([Math.cos(a) * r, Math.abs(Math.sin(i * 78.233)) * 0.04, Math.sin(a) * r], i * 3);
    }
    g.setAttribute("position", new BufferAttribute(p, 3));
    return g;
  }, []);

  useGameEvent((e) => {
    if (e.type === "stat-saved" && !still) burst.fire();
  });
  useEffectSkip(() => burst.finish());

  useFrame(() => {
    if (!mat.current || !pts.current) return;
    const p = burst.progress(RING_MS);
    const on = p >= 0 && p < 1;
    pts.current.visible = on;
    if (!on) return;
    const ease = 1 - (1 - p) ** 3;
    pts.current.scale.setScalar(0.12 + ease * 0.3);
    pts.current.position.y = 0.01 + ease * 0.03;
    mat.current.opacity = 1 - p;
  });

  return (
    <group ref={pts} visible={false}>
      <points geometry={geometry}>
        <pointsMaterial
          ref={mat}
          color={SUN}
          size={0.018}
          transparent
          depthWrite={false}
          blending={AdditiveBlending}
        />
      </points>
    </group>
  );
}

function Ground() {
  const beam = useRef<ShaderMaterial>(null);
  const pillar = useOneShot();
  const pillarColor = useRef(new Color(SUN));
  const [still] = useState(prefersReducedMotion);
  const mats = useMemo(
    () => ({
      grass: new MeshBasicMaterial({
        map: radialTexture("rgba(198,228,180,1)", "rgba(198,228,180,0)"),
        transparent: true,
        depthWrite: false,
      }),
      shadow: new MeshBasicMaterial({
        map: radialTexture("rgba(70,50,30,0.35)", "rgba(70,50,30,0)"),
        transparent: true,
        depthWrite: false,
      }),
    }),
    [],
  );
  const beamUniforms = useMemo(() => ({ uColor: { value: new Color(SUN) }, uBoost: { value: 0 } }), []);

  // Tier or class change: a light pillar in the rarity color, and the camera leans in.
  useGameEvent((e) => {
    if (e.type !== "tier-change" && e.type !== "class-change") return;
    pillarColor.current.set(e.type === "tier-change" ? RARITY_COLOR[e.rarity] : SUN);
    pillar.fire();
  });
  useEffectSkip(() => pillar.finish());

  useFrame((state) => {
    const camera = state.camera as PerspectiveCamera;
    const p = pillar.progress(PILLAR_MS);
    const k = p >= 0 && p < 1 ? Math.sin(Math.PI * p) : 0;
    if (beam.current) {
      const u = beam.current.uniforms;
      u.uBoost.value = k;
      u.uColor.value.copy(pillarColor.current);
    }
    // Framing is by height; on a stage narrower than the figure, pull back to fit its width.
    const fit = Math.min(1, state.size.width / state.size.height / MIN_ASPECT);
    const zoom = fit * (still ? 1 : 1 + 0.08 * k);
    if (Math.abs(camera.zoom - zoom) > 1e-4) {
      camera.zoom = zoom;
      camera.updateProjectionMatrix();
    }
  });

  return (
    <group scale={FLOOR_SCALE}>
      <mesh rotation-x={-Math.PI / 2} material={mats.grass}>
        <circleGeometry args={[0.95, 64]} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position-y={0.003} material={mats.shadow}>
        <circleGeometry args={[0.36, 48]} />
      </mesh>
      <mesh position-y={1}>
        <cylinderGeometry args={[0.42, 0.42, 2, 64, 1, true]} />
        <shaderMaterial
          ref={beam}
          vertexShader={beamVert}
          fragmentShader={beamFrag}
          uniforms={beamUniforms}
          transparent
          depthWrite={false}
          side={DoubleSide}
        />
      </mesh>
    </group>
  );
}

export default function CharacterViewport({
  morph,
  equipped,
}: {
  morph: BodyMorph;
  equipped: Record<EquipSlotKey, boolean>;
}) {
  const [active, setActive] = useState(true);
  const [still] = useState(prefersReducedMotion);

  // Rest the GPU when the tab is hidden.
  useEffect(() => {
    const onVis = () => setActive(!document.hidden);
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  return (
    <Canvas
      frameloop={active ? "always" : "demand"}
      camera={{ position: CAMERA, fov: 28 }}
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: true }}
      flat
    >
      <ToyBody morph={morph} equipped={equipped} />
      <RingBurst />
      <Ground />
      <OrbitControls
        target={TARGET}
        enablePan={false}
        enableZoom={false}
        enableDamping
        autoRotate={!still}
        autoRotateSpeed={0.6}
        minPolarAngle={POLAR}
        maxPolarAngle={POLAR}
      />
    </Canvas>
  );
}
