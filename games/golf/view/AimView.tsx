"use client";
/** Power arrow, slingshot band and the dotted trajectory preview (bends at the first bounce). */
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { TUNING } from "@/config/tuning";
import type { GolfSim } from "../sim/GolfSim";
import type { AimState } from "./aimState";

const DOTS = TUNING.golf.trajectory.dots;
const R = TUNING.golf.ball.radius;

export function powerColor(p: number, out = new THREE.Color()) {
  // green → yellow → red
  const a = new THREE.Color("#3ddc84"), b = new THREE.Color("#ffd166"), c = new THREE.Color("#ff4d5e");
  return p < 0.5 ? out.copy(a).lerp(b, p * 2) : out.copy(b).lerp(c, (p - 0.5) * 2);
}

export function AimView({ sim, aim }: { sim: GolfSim; aim: AimState }) {
  const dots = useRef<THREE.InstancedMesh>(null);
  const arrow = useRef<THREE.Group>(null);
  const arrowMat = useRef<THREE.MeshBasicMaterial>(null);
  const headMat = useRef<THREE.MeshBasicMaterial>(null);
  const ring = useRef<THREE.Mesh>(null);
  const band = useRef<THREE.Mesh>(null);
  const tmp = useMemo(() => ({ m: new THREE.Matrix4(), c: new THREE.Color(), v: new THREE.Vector3(), white: new THREE.Color("#ffffff"), q: new THREE.Quaternion(), s: new THREE.Vector3() }), []);
  const cache = useRef({ key: "", points: [] as THREE.Vector3[], bounceIdx: -1 });

  useFrame(({ clock }) => {
    const show = aim.active && sim.phase === "aim" && !aim.cancelled;
    const d = dots.current;
    if (arrow.current) arrow.current.visible = show;
    if (ring.current) ring.current.visible = show;
    if (band.current) band.current.visible = show;
    if (!d) return;
    if (!show) {
      d.count = 0;
      return;
    }
    const p = sim.ballPos;
    const yaw = Math.atan2(aim.dirX, aim.dirZ);
    const col = powerColor(aim.power, tmp.c);

    // Arrow on the ground, pointing along the shot.
    const a = arrow.current!;
    a.position.set(p.x, p.y - R + 0.03, p.z);
    a.rotation.set(0, yaw, 0);
    const len = 0.5 + aim.power * 2.0;
    a.children[0].scale.set(1, len, 1);
    a.children[0].position.z = R + 0.1 + len / 2;
    a.children[1].position.z = R + 0.1 + len + 0.18;
    arrowMat.current?.color.copy(col);
    headMat.current?.color.copy(col);

    // Power ring.
    const rg = ring.current!;
    rg.position.set(p.x, p.y - R + 0.025, p.z);
    rg.scale.setScalar(1 + aim.power * 0.6);
    (rg.material as THREE.MeshBasicMaterial).color.copy(col);

    // Elastic band from ball to finger.
    const bd = band.current!;
    const bx = aim.dragX - p.x, bz = aim.dragZ - p.z;
    const bl = Math.hypot(bx, bz);
    bd.position.set(p.x + bx / 2, p.y - R + 0.04, p.z + bz / 2);
    bd.rotation.set(-Math.PI / 2, 0, Math.atan2(bx, bz) + Math.PI);
    bd.scale.set(1, Math.max(0.01, bl), 1);

    // Trajectory (recompute only when aim changes meaningfully).
    const key = `${aim.dirX.toFixed(3)}:${aim.dirZ.toFixed(3)}:${aim.power.toFixed(2)}:${p.x.toFixed(2)}:${p.z.toFixed(2)}`;
    if (key !== cache.current.key) {
      const pred = sim.predict(aim.dirX, aim.dirZ, aim.power);
      cache.current = { key, points: pred.points, bounceIdx: pred.bounce ? 1 : -1 };
    }
    const pts = cache.current.points;
    // Total length & dot spacing, marching animation.
    const segs: { a: THREE.Vector3; b: THREE.Vector3; len: number; afterBounce: boolean }[] = [];
    let total = 0;
    for (let i = 0; i < pts.length - 1; i++) {
      const l = pts[i].distanceTo(pts[i + 1]);
      segs.push({ a: pts[i], b: pts[i + 1], len: l, afterBounce: i >= 1 && cache.current.bounceIdx >= 0 });
      total += l;
    }
    const spacing = 0.34;
    const offset = (clock.elapsedTime * 0.9) % spacing;
    let n = 0;
    for (let s = offset + 0.35; s < total && n < DOTS; s += spacing) {
      let acc = 0;
      for (const seg of segs) {
        if (s <= acc + seg.len) {
          const t = (s - acc) / seg.len;
          tmp.v.lerpVectors(seg.a, seg.b, t);
          const fade = 1 - s / total;
          const size = 0.055 * (0.5 + fade * 0.7);
          tmp.s.set(size, size, size);
          tmp.m.compose(tmp.v.setY(tmp.v.y - R * 0.55), tmp.q, tmp.s);
          d.setMatrixAt(n, tmp.m);
          d.setColorAt(n, seg.afterBounce ? col : tmp.white);
          n++;
          break;
        }
        acc += seg.len;
      }
    }
    d.count = n;
    d.instanceMatrix.needsUpdate = true;
    if (d.instanceColor) d.instanceColor.needsUpdate = true;
  });

  return (
    <group>
      <instancedMesh ref={dots} args={[undefined, undefined, DOTS]} frustumCulled={false}>
        <sphereGeometry args={[1, 10, 8]} />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>
      <group ref={arrow} visible={false}>
        <mesh rotation-x={-Math.PI / 2}>
          <planeGeometry args={[0.16, 1]} />
          <meshBasicMaterial ref={arrowMat} toneMapped={false} transparent opacity={0.95} depthWrite={false} />
        </mesh>
        <mesh rotation-x={Math.PI / 2}>
          <coneGeometry args={[0.2, 0.36, 3]} />
          <meshBasicMaterial ref={headMat} toneMapped={false} />
        </mesh>
      </group>
      <mesh ref={ring} rotation-x={-Math.PI / 2} visible={false}>
        <ringGeometry args={[R * 1.6, R * 1.85, 40]} />
        <meshBasicMaterial toneMapped={false} transparent opacity={0.9} depthWrite={false} />
      </mesh>
      <mesh ref={band} visible={false}>
        <planeGeometry args={[0.05, 1]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.5} depthWrite={false} />
      </mesh>
    </group>
  );
}
