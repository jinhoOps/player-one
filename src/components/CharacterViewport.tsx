"use client";

import { useEffect, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import type { Group, MeshStandardMaterial } from "three";
import { useGameEvents } from "@/lib/events";
import type { EquipSlotKey } from "@/lib/game";
import type { BodyMorph } from "@/lib/morph";

const STANDARD = { height: 0.5, weight: 0.4, muscle: 0.4 };
const ACCENT = "#5cf2ff";

function Mannequin({ morph }: { morph: BodyMorph }) {
  const root = useRef<Group>(null);
  const torso = useRef<Group>(null);
  const hovered = useGameEvents((s) => s.hoveredSlot);
  const m = morph ?? STANDARD;

  // Placeholder proportions until the MakeHuman .glb lands (docs/DESIGN.md §8).
  const heightScale = 0.9 + m.height * 0.2;
  const girth = 0.85 + m.weight * 0.35 + m.muscle * 0.15;

  useFrame(({ clock }) => {
    if (torso.current) torso.current.scale.y = 1 + Math.sin(clock.elapsedTime * 1.6) * 0.012;
  });

  const part = (slot: EquipSlotKey) => <PartMaterial lit={hovered === slot} />;

  return (
    <group ref={root} scale={[1, heightScale, 1]} position={[0, -0.9, 0]}>
      <mesh position={[0, 1.62, 0]}>
        <sphereGeometry args={[0.13, 32, 32]} />
        {part("head")}
      </mesh>
      <group ref={torso} position={[0, 1.18, 0]} scale={[girth, 1, girth]}>
        <mesh>
          <capsuleGeometry args={[0.17, 0.42, 8, 24]} />
          {part("top")}
        </mesh>
      </group>
      {[-0.09, 0.09].map((x) => (
        <group key={x}>
          <mesh position={[x, 0.55, 0]} scale={[girth * 0.9, 1, girth * 0.9]}>
            <capsuleGeometry args={[0.075, 0.62, 8, 16]} />
            {part("bottom")}
          </mesh>
          <mesh position={[x, 0.05, 0.04]}>
            <boxGeometry args={[0.09, 0.07, 0.24]} />
            {part("shoes")}
          </mesh>
        </group>
      ))}
      {[-0.27, 0.27].map((x) => (
        <mesh key={x} position={[x * girth, 1.12, 0]} rotation={[0, 0, x > 0 ? 0.12 : -0.12]}>
          <capsuleGeometry args={[0.055, 0.55, 8, 16]} />
          <PartMaterial lit={false} />
        </mesh>
      ))}
    </group>
  );
}

function PartMaterial({ lit }: { lit: boolean }) {
  const ref = useRef<MeshStandardMaterial>(null);
  useFrame((_, dt) => {
    if (!ref.current) return;
    const target = lit ? 0.8 : 0;
    ref.current.emissiveIntensity += (target - ref.current.emissiveIntensity) * Math.min(1, dt * 12);
  });
  return <meshStandardMaterial ref={ref} color="#c9ccd4" roughness={0.9} emissive={ACCENT} emissiveIntensity={0} />;
}

export default function CharacterViewport({ morph }: { morph: BodyMorph }) {
  const [active, setActive] = useState(true);

  // Rest the GPU when the tab is hidden.
  useEffect(() => {
    const onVis = () => setActive(!document.hidden);
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  return (
    <Canvas frameloop={active ? "always" : "demand"} camera={{ position: [0, 0.2, 3.2], fov: 35 }} dpr={[1, 2]}>
      <ambientLight intensity={0.35} />
      <directionalLight position={[2, 3, 2]} intensity={1.1} />
      <directionalLight position={[-2, 1, -3]} intensity={0.8} color={ACCENT} />
      <Mannequin morph={morph} />
      <OrbitControls
        enablePan={false}
        minPolarAngle={Math.PI / 2}
        maxPolarAngle={Math.PI / 2}
        minDistance={2.4}
        maxDistance={4}
      />
    </Canvas>
  );
}
