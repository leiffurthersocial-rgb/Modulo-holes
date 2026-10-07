"use client";
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { onEmitParticles, type EmitOptions, type ParticleKind, PALETTE_CONFETTI } from "./particles";
import { timeScale } from "./time";

const MAX = 700;

interface P {
  alive: boolean;
  glow: boolean;
  kind: ParticleKind;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  rot: THREE.Euler;
  spin: THREE.Vector3;
  life: number;
  maxLife: number;
  size: number;
  gravity: number;
  drag: number;
  color: THREE.Color;
}

const GLOW_KINDS: ParticleKind[] = ["spark", "star", "ring"];

/**
 * Two pooled instanced meshes: lit chunks (confetti, dust, splash) and additive glow bits
 * (sparks, stars) that bloom nicely. Updates use the global (slow-mo aware) time scale.
 */
export function ParticleSystem() {
  const litRef = useRef<THREE.InstancedMesh>(null);
  const glowRef = useRef<THREE.InstancedMesh>(null);
  const pool = useMemo<P[]>(
    () =>
      Array.from({ length: MAX }, () => ({
        alive: false,
        glow: false,
        kind: "confetti" as ParticleKind,
        pos: new THREE.Vector3(),
        vel: new THREE.Vector3(),
        rot: new THREE.Euler(),
        spin: new THREE.Vector3(),
        life: 0,
        maxLife: 1,
        size: 1,
        gravity: -9,
        drag: 1,
        color: new THREE.Color(),
      })),
    [],
  );
  const cursor = useRef(0);
  const tmp = useMemo(() => ({ m: new THREE.Matrix4(), q: new THREE.Quaternion(), s: new THREE.Vector3(), dir: new THREE.Vector3() }), []);

  useEffect(
    () =>
      onEmitParticles((e: EmitOptions) => {
        const count = e.count ?? 20;
        const colors = e.colors ?? PALETTE_CONFETTI;
        const base = tmp.dir.set(...(e.direction ?? [0, 1, 0])).normalize();
        for (let i = 0; i < count; i++) {
          const p = pool[cursor.current];
          cursor.current = (cursor.current + 1) % MAX;
          p.alive = true;
          p.kind = e.kind;
          p.glow = GLOW_KINDS.includes(e.kind);
          p.pos.set(...e.position);
          // Random direction within a cone around `base` (spread 0..1).
          const spread = e.spread ?? 0.6;
          const v = new THREE.Vector3(Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1).normalize();
          v.lerp(base, 1 - spread).normalize();
          const speed = (e.speed ?? 6) * (0.45 + Math.random() * 0.75);
          p.vel.copy(v).multiplyScalar(speed);
          if (e.kind === "ring") {
            // Flat horizontal ring burst.
            const a = (i / count) * Math.PI * 2;
            p.vel.set(Math.cos(a) * speed, 0.3, Math.sin(a) * speed);
          }
          p.rot.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
          p.spin.set(Math.random() * 14 - 7, Math.random() * 14 - 7, Math.random() * 14 - 7);
          p.maxLife = (e.life ?? 1.4) * (0.6 + Math.random() * 0.6);
          p.life = p.maxLife;
          p.size = (e.size ?? 1) * (0.6 + Math.random() * 0.7);
          p.gravity = e.gravity ?? (e.kind === "confetti" ? -7 : e.kind === "splash" ? -16 : e.kind === "dust" ? 1.5 : -4);
          p.drag = e.kind === "confetti" ? 1.6 : e.kind === "dust" ? 3 : 0.8;
          p.color.set(colors[Math.floor(Math.random() * colors.length)]);
          if (p.glow) p.color.multiplyScalar(2.2);
        }
      }),
    [pool, tmp],
  );

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 1 / 20) * timeScale();
    const lit = litRef.current;
    const glow = glowRef.current;
    if (!lit || !glow) return;
    let nl = 0;
    let ng = 0;
    for (const p of pool) {
      if (!p.alive) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.alive = false;
        continue;
      }
      p.vel.y += p.gravity * dt;
      p.vel.multiplyScalar(Math.max(0, 1 - p.drag * dt));
      if (p.kind === "confetti") {
        // Flutter.
        p.vel.x += Math.sin(p.life * 9 + p.size * 10) * 3 * dt;
      }
      p.pos.addScaledVector(p.vel, dt);
      p.rot.x += p.spin.x * dt;
      p.rot.y += p.spin.y * dt;
      p.rot.z += p.spin.z * dt;
      const t = p.life / p.maxLife;
      const fade = Math.min(1, t * 3);
      let sx = p.size, sy = p.size, sz = p.size;
      if (p.kind === "confetti") { sx *= 0.075; sy *= 0.01; sz *= 0.05; }
      else if (p.kind === "spark" || p.kind === "ring") { const k = 0.07 * fade; sx *= k; sy *= k; sz *= k * 2.5; }
      else if (p.kind === "star") { const k = 0.075 * fade; sx *= k; sy *= k; sz *= k; }
      else if (p.kind === "splash") { const k = 0.09 * fade; sx *= k; sy *= k; sz *= k; }
      else { const k = 0.07 * (0.4 + (1 - t)) * fade; sx *= k; sy *= k; sz *= k; }
      tmp.q.setFromEuler(p.rot);
      if (p.kind === "spark" || p.kind === "ring") {
        // Stretch along velocity.
        tmp.dir.copy(p.vel).normalize();
        tmp.q.setFromUnitVectors(new THREE.Vector3(0, 0, 1), tmp.dir.lengthSq() > 0 ? tmp.dir : new THREE.Vector3(0, 0, 1));
      }
      tmp.s.set(sx, sy, sz);
      tmp.m.compose(p.pos, tmp.q, tmp.s);
      if (p.glow) {
        glow.setMatrixAt(ng, tmp.m);
        glow.setColorAt(ng, p.color);
        ng++;
      } else {
        lit.setMatrixAt(nl, tmp.m);
        lit.setColorAt(nl, p.color);
        nl++;
      }
    }
    lit.count = nl;
    glow.count = ng;
    lit.instanceMatrix.needsUpdate = true;
    glow.instanceMatrix.needsUpdate = true;
    if (lit.instanceColor) lit.instanceColor.needsUpdate = true;
    if (glow.instanceColor) glow.instanceColor.needsUpdate = true;
  });

  return (
    <>
      <instancedMesh ref={litRef} args={[undefined, undefined, MAX]} frustumCulled={false} castShadow={false}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial roughness={0.6} metalness={0.05} />
      </instancedMesh>
      <instancedMesh ref={glowRef} args={[undefined, undefined, MAX]} frustumCulled={false}>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial toneMapped={false} transparent opacity={0.95} blending={THREE.AdditiveBlending} depthWrite={false} />
      </instancedMesh>
    </>
  );
}
