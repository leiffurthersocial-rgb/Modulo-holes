"use client";
/** Low-poly procedural decor props. */
import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { CourseTheme, DecorPiece } from "../courses/types";
import { candyStripeTexture } from "./textures";

const FLOWER_COLORS = ["#ff5d73", "#ffd166", "#ffffff", "#b388ff", "#ff9f43"];

export function Decor({ d, theme }: { d: Pick<DecorPiece, "type" | "at" | "scale" | "yaw">; theme: CourseTheme }) {
  const s = d.scale ?? 1;
  return (
    <group position={d.at} scale={s} rotation-y={d.yaw ?? 0}>
      <DecorModel type={d.type} theme={theme} seed={Math.abs(Math.round(d.at[0] * 7 + d.at[2] * 13))} />
    </group>
  );
}

function DecorModel({ type, theme, seed }: { type: DecorPiece["type"]; theme: CourseTheme; seed: number }) {
  switch (type) {
    case "tree":
      return (
        <group>
          <mesh position={[0, 0.6, 0]} castShadow>
            <cylinderGeometry args={[0.12, 0.18, 1.2, 6]} />
            <meshStandardMaterial color="#8a5a3b" flatShading />
          </mesh>
          <mesh position={[0, 1.6, 0]} castShadow>
            <icosahedronGeometry args={[0.85, 0]} />
            <meshStandardMaterial color={seed % 2 ? "#4caf50" : "#5cbf5a"} flatShading />
          </mesh>
          <mesh position={[0.3, 2.15, 0.1]} castShadow>
            <icosahedronGeometry args={[0.55, 0]} />
            <meshStandardMaterial color="#66c766" flatShading />
          </mesh>
        </group>
      );
    case "pine":
      return (
        <group>
          <mesh position={[0, 0.3, 0]} castShadow>
            <cylinderGeometry args={[0.1, 0.14, 0.6, 6]} />
            <meshStandardMaterial color="#7a4e33" flatShading />
          </mesh>
          {[0, 1, 2].map((i) => (
            <mesh key={i} position={[0, 0.9 + i * 0.55, 0]} castShadow>
              <coneGeometry args={[0.8 - i * 0.2, 0.9, 7]} />
              <meshStandardMaterial color={i % 2 ? "#2f8f5b" : "#3aa36a"} flatShading />
            </mesh>
          ))}
        </group>
      );
    case "rock":
      return (
        <mesh position={[0, 0.2, 0]} scale={[1, 0.6, 0.8]} castShadow receiveShadow>
          <dodecahedronGeometry args={[0.5, 0]} />
          <meshStandardMaterial color="#9aa3ad" flatShading />
        </mesh>
      );
    case "bush":
      return (
        <group>
          {[
            [0, 0.3, 0, 0.45],
            [0.35, 0.25, 0.1, 0.33],
            [-0.3, 0.22, -0.1, 0.3],
          ].map(([x, y, z, r], i) => (
            <mesh key={i} position={[x, y, z]} castShadow>
              <icosahedronGeometry args={[r, 0]} />
              <meshStandardMaterial color="#56b85a" flatShading />
            </mesh>
          ))}
        </group>
      );
    case "flower":
      return (
        <group>
          {[0, 1, 2, 3, 4].map((i) => {
            const a = i * 1.3 + seed;
            const x = Math.cos(a) * 0.35 * (i % 3), z = Math.sin(a) * 0.35 * (i % 3);
            return (
              <group key={i} position={[x, 0, z]}>
                <mesh position={[0, 0.15, 0]}>
                  <cylinderGeometry args={[0.015, 0.015, 0.3, 4]} />
                  <meshStandardMaterial color="#3f9a3f" />
                </mesh>
                <mesh position={[0, 0.32, 0]}>
                  <icosahedronGeometry args={[0.08, 0]} />
                  <meshStandardMaterial color={FLOWER_COLORS[(seed + i) % FLOWER_COLORS.length]} flatShading />
                </mesh>
              </group>
            );
          })}
        </group>
      );
    case "lollipop":
      return (
        <group>
          <mesh position={[0, 0.9, 0]} castShadow>
            <cylinderGeometry args={[0.05, 0.05, 1.8, 6]} />
            <meshStandardMaterial color="#ffffff" />
          </mesh>
          <mesh position={[0, 2.0, 0]} castShadow>
            <cylinderGeometry args={[0.6, 0.6, 0.18, 24]} />
            <meshStandardMaterial color={["#ff4f9a", "#7c4dff", "#36c5f0", "#ffd166"][seed % 4]} roughness={0.2} />
          </mesh>
          <mesh position={[0, 2.0, 0]}>
            <torusGeometry args={[0.35, 0.06, 8, 24]} />
            <meshStandardMaterial color="#ffffff" roughness={0.2} />
          </mesh>
        </group>
      );
    case "candyCane":
      return <CandyCane />;
    case "gumdrop":
      return (
        <mesh position={[0, 0.35, 0]} castShadow>
          <sphereGeometry args={[0.5, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.6]} />
          <meshPhysicalMaterial color={["#ff4f7d", "#7c4dff", "#06d6a0", "#ffd166", "#36c5f0"][seed % 5]} roughness={0.25} clearcoat={1} />
        </mesh>
      );
    case "neonPillar":
      return (
        <group>
          <mesh position={[0, 1.5, 0]} castShadow>
            <boxGeometry args={[0.4, 3, 0.4]} />
            <meshStandardMaterial color="#14142e" />
          </mesh>
          {[0.5, 1.5, 2.5].map((y) => (
            <mesh key={y} position={[0, y, 0]}>
              <boxGeometry args={[0.44, 0.06, 0.44]} />
              <meshBasicMaterial color={seed % 2 ? theme.accent : theme.rail} toneMapped={false} />
            </mesh>
          ))}
        </group>
      );
    case "neonRing":
      return <Spinning speed={0.6}><mesh position={[0, 2, 0]}><torusGeometry args={[1, 0.06, 8, 40]} /><meshBasicMaterial color={seed % 2 ? theme.accent : theme.rail} toneMapped={false} /></mesh></Spinning>;
    case "crystal":
      return (
        <Spinning speed={0.4}>
          <mesh position={[0, 0.8, 0]} scale={[0.6, 1.2, 0.6]}>
            <octahedronGeometry args={[0.6, 0]} />
            <meshStandardMaterial color={seed % 2 ? theme.accent : theme.rail} emissive={seed % 2 ? theme.accent : theme.rail} emissiveIntensity={1.4} flatShading />
          </mesh>
        </Spinning>
      );
    case "cloud":
      return (
        <group>
          {[
            [0, 0, 0, 1],
            [0.9, -0.1, 0.2, 0.75],
            [-0.9, -0.15, 0, 0.7],
            [0.3, 0.4, 0, 0.7],
          ].map(([x, y, z, r], i) => (
            <mesh key={i} position={[x, y, z]}>
              <icosahedronGeometry args={[r, 1]} />
              <meshStandardMaterial color="#ffffff" flatShading roughness={1} />
            </mesh>
          ))}
        </group>
      );
  }
}

function Spinning({ speed, children }: { speed: number; children: React.ReactNode }) {
  const ref = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (ref.current) ref.current.rotation.y += dt * speed;
  });
  return <group ref={ref}>{children}</group>;
}

function CandyCane() {
  const tex = candyStripeTexture();
  return (
    <group>
      <mesh position={[0, 0.9, 0]} castShadow>
        <cylinderGeometry args={[0.1, 0.1, 1.8, 10]} />
        <meshStandardMaterial map={tex} roughness={0.3} />
      </mesh>
      <mesh position={[0.3, 1.8, 0]} rotation-z={0}>
        <torusGeometry args={[0.3, 0.1, 8, 16, Math.PI]} />
        <meshStandardMaterial map={tex} roughness={0.3} />
      </mesh>
    </group>
  );
}
