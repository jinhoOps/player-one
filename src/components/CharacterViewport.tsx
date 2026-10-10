"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  DoubleSide,
  Group,
  MeshBasicMaterial,
  PerspectiveCamera,
  PointsMaterial,
  ShaderMaterial,
  SRGBColorSpace,
} from "three";
import { useEffectSkip, useGameEvent } from "@/lib/events";
import type { EquipSlotKey, Rarity } from "@/lib/game";
import type { BodyMorph } from "@/lib/morph";
import { prefersReducedMotion, useOneShot } from "@/lib/motion";
import { Chibi } from "./Chibi";

// Brand colors (docs/BRAND.md): the sun marks sparkles; rarity colors light the pillar.
const SUN = new Color("#f5b83d");
const RARITY_COLOR: Record<Rarity, string> = {
  common: "#a39a90",
  uncommon: "#4fae6e",
  rare: "#4f9be0",
  epic: "#a77be0",
  legendary: "#f0a030",
};
// Framed for the tallest figure, so a taller profile reads taller on stage.
const TARGET: [number, number, number] = [0, 0.43, 0];
const CAMERA: [number, number, number] = [0, 0.55, 2.1];
const POLAR = Math.PI / 2 - Math.atan2(CAMERA[1] - TARGET[1], CAMERA[2]);
const FLOOR_SCALE = 0.5;
// Narrowest stage aspect (width / height) that still shows the whole figure.
const MIN_ASPECT = 0.7;

// Effect durations (ms), all within the 1.8s cap of docs/BRAND.md.
const RING_MS = 900;
const PILLAR_MS = 1500;

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
        <circleGeometry args={[0.4, 48]} />
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
  headKind,
}: {
  morph: BodyMorph;
  equipped: Record<EquipSlotKey, boolean>;
  headKind?: string;
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
      <Suspense fallback={null}>
        <Chibi morph={morph} equipped={equipped} headKind={headKind} interactive />
      </Suspense>
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
