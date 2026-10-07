"use client";
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Trail } from "@react-three/drei";
import * as THREE from "three";
import { TUNING } from "@/config/tuning";
import type { GolfSim } from "../sim/GolfSim";
import { ballTexture } from "./textures";
import type { BallSkin } from "../skins";

const R = TUNING.golf.ball.radius;

/** The ball: rolls visually from its velocity, squashes on impacts, leaves a speed trail. */
export function Ball({ sim, skin, trailColor, glow = false }: { sim: GolfSim; skin: BallSkin; trailColor: string; glow?: boolean }) {
  const group = useRef<THREE.Group>(null);
  const mesh = useRef<THREE.Mesh>(null);
  const blob = useRef<THREE.Mesh>(null);
  const tex = useMemo(() => ballTexture(skin.pattern, skin.color, skin.stripe), [skin]);
  const tmp = useMemo(() => ({ axis: new THREE.Vector3(), q: new THREE.Quaternion(), last: new THREE.Vector3(), squash: 0 }), []);

  useFrame((_, dt) => {
    const g = group.current;
    const m = mesh.current;
    if (!g || !m) return;
    const p = sim.ballPos;
    g.position.copy(p);
    // Visual roll from travelled distance.
    const d = tmp.last.distanceTo(p);
    if (d > 1e-5 && d < 2) {
      tmp.axis.set(p.z - tmp.last.z, 0, -(p.x - tmp.last.x)).normalize();
      if (tmp.axis.lengthSq() > 0) {
        tmp.q.setFromAxisAngle(tmp.axis, d / R);
        m.quaternion.premultiply(tmp.q);
      }
    }
    tmp.last.copy(p);
    // Hide inside the cup once holed / during hazard.
    g.visible = sim.phase !== "hazard";
    if (blob.current) {
      blob.current.visible = !!sim.ground && sim.phase !== "holed";
    }
    tmp.squash = Math.max(0, tmp.squash - dt * 6);
  });

  return (
    <group ref={group}>
      <Trail width={1.1} length={6} color={trailColor} attenuation={(w) => w * w} decay={2}>
        <mesh ref={mesh} castShadow>
          <sphereGeometry args={[R, 32, 20]} />
          <meshStandardMaterial map={tex} roughness={0.32} metalness={skin.id === "gold" ? 0.8 : 0.05} emissive={skin.emissive ?? (glow ? "#ffffff" : "#000000")} emissiveIntensity={skin.emissive ? 0.6 : glow ? 0.45 : 0} emissiveMap={glow && !skin.emissive ? tex : null} />
        </mesh>
      </Trail>
      {/* Contact shadow blob — reads well even with shadows disabled. */}
      {glow && <pointLight color={trailColor} intensity={2.5} distance={2.5} decay={2} />}
      <mesh ref={blob} position={[0, -R + 0.012, 0]} rotation-x={-Math.PI / 2}>
        <circleGeometry args={[R * 1.15, 20]} />
        <meshBasicMaterial color="#000" transparent opacity={0.22} depthWrite={false} />
      </mesh>
    </group>
  );
}
