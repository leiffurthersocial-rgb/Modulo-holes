"use client";
/** Table, balls, cue stick and the aiming guides (ghost ball + predicted paths). */
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { CUSHIONS, HEAD_STRING_X, L, POCKETS, R, W } from "../sim/physics";
import type { TableTheme } from "../themes";
import type { BilliardsGame } from "./game";
import { ballTexture } from "./ballTexture";

const CUSHION_W = 0.05;
const RAIL_W = 0.13;
const CUSHION_H = 0.04;
const RAIL_H = 0.05;

function feltTexture(color: string) {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d")!;
  g.fillStyle = color;
  g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 5000; i++) {
    g.fillStyle = Math.random() < 0.5 ? "rgba(255,255,255,0.035)" : "rgba(0,0,0,0.05)";
    g.fillRect(Math.random() * 256, Math.random() * 256, 1, 1);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(6, 3);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function Table({ theme, kitchen, zone, targetPockets }: { theme: TableTheme; kitchen: boolean; zone?: { x: number; z: number; r: number } | null; targetPockets?: number[] }) {
  const felt = useMemo(() => feltTexture(theme.felt), [theme.felt]);
  useEffect(() => () => felt.dispose(), [felt]);
  const feltGeo = useMemo(() => {
    const hw = L / 2 + CUSHION_W, hh = W / 2 + CUSHION_W;
    const shape = new THREE.Shape([new THREE.Vector2(-hw, -hh), new THREE.Vector2(hw, -hh), new THREE.Vector2(hw, hh), new THREE.Vector2(-hw, hh)]);
    for (const p of POCKETS) {
      const h = new THREE.Path();
      h.absarc(p.x, -p.z, p.r, 0, Math.PI * 2, true);
      shape.holes.push(h);
    }
    const g = new THREE.ShapeGeometry(shape, 24);
    g.rotateX(-Math.PI / 2);
    const pos = g.attributes.position;
    const uv = new Float32Array(pos.count * 2);
    for (let i = 0; i < pos.count; i++) {
      uv[i * 2] = pos.getX(i) / 2.6;
      uv[i * 2 + 1] = pos.getZ(i) / 1.3;
    }
    g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
    return g;
  }, []);
  useEffect(() => () => feltGeo.dispose(), [feltGeo]);

  const glow = theme.glow;
  return (
    <group>
      {/* Cloth */}
      <mesh geometry={feltGeo} receiveShadow>
        <meshStandardMaterial map={felt} roughness={0.95} metalness={0} />
      </mesh>
      {/* Head string + foot spot */}
      <mesh position={[HEAD_STRING_X, 0.0008, 0]} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[0.004, W]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={kitchen ? 0.55 : 0.12} />
      </mesh>
      {kitchen && (
        <mesh position={[(HEAD_STRING_X - L / 2) / 2, 0.0006, 0]} rotation-x={-Math.PI / 2}>
          <planeGeometry args={[HEAD_STRING_X + L / 2, W]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.06} depthWrite={false} />
        </mesh>
      )}
      <mesh position={[L / 4, 0.0008, 0]} rotation-x={-Math.PI / 2}>
        <circleGeometry args={[0.008, 12]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.3} />
      </mesh>
      {zone && (
        <mesh position={[zone.x, 0.001, zone.z]} rotation-x={-Math.PI / 2}>
          <ringGeometry args={[zone.r - 0.008, zone.r, 48]} />
          <meshBasicMaterial color="#ffd166" toneMapped={false} />
        </mesh>
      )}
      {/* Cushions (one box per nose segment, jaws included) */}
      {CUSHIONS.map((s, i) => {
        const len = Math.hypot(s.bx - s.ax, s.bz - s.az);
        const cx = (s.ax + s.bx) / 2 - s.nx * (CUSHION_W / 2);
        const cz = (s.az + s.bz) / 2 - s.nz * (CUSHION_W / 2);
        const ang = Math.atan2(s.bz - s.az, s.bx - s.ax);
        return (
          <mesh key={i} position={[cx, CUSHION_H / 2, cz]} rotation-y={-ang} castShadow receiveShadow>
            <boxGeometry args={[len + 0.004, CUSHION_H, CUSHION_W]} />
            <meshStandardMaterial color={theme.cushion} roughness={0.9} />
          </mesh>
        );
      })}
      {/* Wooden rails */}
      <Rails theme={theme} />
      {/* Pockets */}
      {POCKETS.map((p, i) => (
        <group key={i} position={[p.x, 0, p.z]}>
          <mesh position={[0, -0.05, 0]}>
            <cylinderGeometry args={[p.r, p.r * 0.9, 0.1, 24, 1, true]} />
            <meshStandardMaterial color={theme.pocket} side={THREE.DoubleSide} roughness={1} />
          </mesh>
          <mesh position={[0, -0.095, 0]} rotation-x={-Math.PI / 2}>
            <circleGeometry args={[p.r, 24]} />
            <meshBasicMaterial color="#000" />
          </mesh>
          <mesh position={[0, RAIL_H - 0.004, 0]} rotation-x={-Math.PI / 2}>
            <ringGeometry args={[p.r, p.r + 0.022, 28]} />
            <meshStandardMaterial color={theme.metal} metalness={0.45} roughness={0.5} emissive={glow ?? "#000"} emissiveIntensity={glow ? 1.2 : 0} />
          </mesh>
          {targetPockets?.includes(i) && (
            <mesh position={[0, 0.002, 0]} rotation-x={-Math.PI / 2}>
              <ringGeometry args={[p.r + 0.005, p.r + 0.02, 32]} />
              <meshBasicMaterial color="#ffd166" toneMapped={false} />
            </mesh>
          )}
        </group>
      ))}
      {/* Table body + floor */}
      <mesh position={[0, -0.22, 0]} receiveShadow>
        <boxGeometry args={[L + 2 * (CUSHION_W + RAIL_W) + 0.02, 0.4, W + 2 * (CUSHION_W + RAIL_W) + 0.02]} />
        <meshStandardMaterial color={theme.woodDark} roughness={0.7} />
      </mesh>
      <mesh position={[0, -0.8, 0]} rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[30, 30]} />
        <meshStandardMaterial color={theme.room} roughness={1} />
      </mesh>
    </group>
  );
}

function Rails({ theme }: { theme: TableTheme }) {
  const ox = L / 2 + CUSHION_W, oz = W / 2 + CUSHION_W;
  const pieces: { x: number; z: number; w: number; d: number }[] = [
    { x: 0, z: -(oz + RAIL_W / 2), w: 2 * ox + 2 * RAIL_W, d: RAIL_W },
    { x: 0, z: oz + RAIL_W / 2, w: 2 * ox + 2 * RAIL_W, d: RAIL_W },
    { x: -(ox + RAIL_W / 2), z: 0, w: RAIL_W, d: 2 * oz },
    { x: ox + RAIL_W / 2, z: 0, w: RAIL_W, d: 2 * oz },
  ];
  const diamonds: [number, number][] = [];
  for (let i = 1; i < 8; i++) if (i !== 4) for (const sz of [-1, 1]) diamonds.push([-L / 2 + (i * L) / 8, sz * (oz + RAIL_W / 2)]);
  for (let i = 1; i < 4; i++) for (const sx of [-1, 1]) diamonds.push([sx * (ox + RAIL_W / 2), -W / 2 + (i * W) / 4]);
  return (
    <group>
      {pieces.map((p, i) => (
        <mesh key={i} position={[p.x, RAIL_H / 2 - 0.01, p.z]} castShadow receiveShadow>
          <boxGeometry args={[p.w, RAIL_H + 0.02, p.d]} />
          <meshStandardMaterial color={theme.wood} roughness={0.45} metalness={0.05} />
        </mesh>
      ))}
      {theme.glow &&
        pieces.map((p, i) => (
          <mesh key={`g${i}`} position={[p.x, RAIL_H + 0.002, p.z]}>
            <boxGeometry args={[p.w > p.d ? p.w : 0.006, 0.004, p.d > p.w ? p.d : 0.006]} />
            <meshBasicMaterial color={theme.glow} toneMapped={false} />
          </mesh>
        ))}
      {diamonds.map(([x, z], i) => (
        <mesh key={`d${i}`} position={[x, RAIL_H + 0.001, z]} rotation-x={-Math.PI / 2}>
          <circleGeometry args={[0.009, 4]} />
          <meshStandardMaterial color="#f3ead7" metalness={0.4} roughness={0.3} emissive={theme.glow ?? "#000"} emissiveIntensity={theme.glow ? 0.6 : 0} />
        </mesh>
      ))}
    </group>
  );
}

/** All 16 balls; orientation integrates the simulated angular velocity, so spin is visible. */
export function Balls({ game }: { game: BilliardsGame }) {
  const refs = useRef<(THREE.Mesh | null)[]>([]);
  const ids = useMemo(() => game.balls.map((b) => b.id), [game.balls]);
  const quats = useMemo(() => ids.map((id) => new THREE.Quaternion().setFromEuler(new THREE.Euler(id * 1.7 + 0.3, id * 2.3, id * 0.9))), [ids]);
  const tmp = useMemo(() => ({ q: new THREE.Quaternion(), v: new THREE.Vector3() }), []);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 1 / 20);
    game.balls.forEach((b, i) => {
      const m = refs.current[i];
      if (!m) return;
      const pt = game.potTimes.get(b.id);
      if (!b.onTable && pt !== undefined) {
        // Drop into the pocket.
        const p = POCKETS[b.pocket] ?? POCKETS[0];
        const k = Math.min(1, pt / 0.25);
        m.position.set(m.position.x + (p.x - m.position.x) * k * 0.5, R - Math.max(0, pt - 0.1) * 0.6, m.position.z + (p.z - m.position.z) * k * 0.5);
        m.visible = pt < 0.6;
        return;
      }
      m.visible = b.onTable;
      m.position.set(b.x, R, b.z);
      const w = tmp.v.set(b.wx, b.wy, b.wz);
      const ang = w.length() * dt * (game.phase === "rolling" ? 1 : 0);
      if (ang > 1e-6) {
        tmp.q.setFromAxisAngle(w.normalize(), ang);
        quats[i].premultiply(tmp.q);
      }
      m.quaternion.copy(quats[i]);
    });
  });

  return (
    <group>
      {game.balls.map((b, i) => (
        <mesh key={b.id} ref={(el) => void (refs.current[i] = el)} castShadow>
          <sphereGeometry args={[R, 32, 20]} />
          <meshPhysicalMaterial map={ballTexture(b.id)} roughness={0.12} clearcoat={1} clearcoatRoughness={0.05} />
        </mesh>
      ))}
    </group>
  );
}

/** Cue stick behind the cue ball; pulls back with power and lunges on the strike. */
export function CueStick({ game }: { game: BilliardsGame }) {
  const ref = useRef<THREE.Group>(null);
  const anim = useRef({ strike: 0, fade: 1, lastPower: 0 });
  useFrame((_, rawDt) => {
    const g = ref.current;
    if (!g) return;
    const dt = Math.min(rawDt, 1 / 20);
    const a = anim.current;
    const aiming = game.phase === "aim" || game.phase === "ai";
    if (game.strikes.length) {
      a.strike = 1;
      a.lastPower = game.power;
    }
    a.strike = Math.max(0, a.strike - dt * 5);
    a.fade = aiming ? Math.min(1, a.fade + dt * 4) : Math.max(0, a.fade - dt * 2.5);
    g.visible = a.fade > 0.02 && game.cue.onTable;
    const pull = aiming ? 0.02 + game.power * 0.22 : -0.01 * a.strike - a.lastPower * 0.05 * (1 - a.strike);
    const c = game.cue;
    const dx = game.aim.dx, dz = game.aim.dz;
    g.position.set(c.x - dx * (R + pull), R + 0.008, c.z - dz * (R + pull));
    g.rotation.set(0, Math.atan2(dx, dz) + Math.PI, 0);
    g.children.forEach((ch) => {
      const mat = (ch as THREE.Mesh).material as THREE.MeshStandardMaterial;
      if (mat) mat.opacity = a.fade;
    });
  });
  const len = 1.45;
  return (
    <group ref={ref}>
      {/* Elevated slightly at the butt. Local +z points away from the cue ball. */}
      <group rotation-x={-0.07}>
        <mesh position={[0, 0, 0.006]} rotation-x={Math.PI / 2}>
          <cylinderGeometry args={[0.0062, 0.0062, 0.012, 12]} />
          <meshStandardMaterial color="#3b6fd8" transparent />
        </mesh>
        <mesh position={[0, 0, 0.022]} rotation-x={Math.PI / 2}>
          <cylinderGeometry args={[0.0065, 0.0065, 0.02, 12]} />
          <meshStandardMaterial color="#f5f1e6" transparent />
        </mesh>
        <mesh position={[0, 0, 0.032 + (len * 0.62) / 2]} rotation-x={Math.PI / 2} castShadow>
          <cylinderGeometry args={[0.0085, 0.0066, len * 0.62, 16]} />
          <meshStandardMaterial color="#e3c896" roughness={0.35} transparent />
        </mesh>
        <mesh position={[0, 0, 0.032 + len * 0.62 + (len * 0.38) / 2]} rotation-x={Math.PI / 2} castShadow>
          <cylinderGeometry args={[0.0145, 0.0085, len * 0.38, 16]} />
          <meshStandardMaterial color="#2a160c" roughness={0.3} metalness={0.1} transparent />
        </mesh>
      </group>
    </group>
  );
}

/** Ghost-ball preview: aim line, contact ghost, object-ball path and cue-ball deflection. */
export function AimGuide({ game, color = "#ffffff" }: { game: BilliardsGame; color?: string }) {
  const line = useRef<THREE.Mesh>(null);
  const ghost = useRef<THREE.Mesh>(null);
  const objLine = useRef<THREE.Mesh>(null);
  const cueLine = useRef<THREE.Mesh>(null);
  const bounce = useRef<THREE.Mesh>(null);

  useFrame(() => {
    const show = (game.phase === "aim" || (game.phase === "ai" && game.aiStage !== "think")) && game.cue.onTable;
    for (const r of [line, ghost, objLine, cueLine, bounce]) if (r.current) r.current.visible = show;
    if (!show) return;
    const c = game.cue;
    const dx = game.aim.dx, dz = game.aim.dz;
    // Nearest ball hit along the ray (ray vs circle of radius 2R).
    let tHit = Infinity;
    let hitBall: (typeof game.balls)[number] | null = null;
    for (const b of game.balls) {
      if (b.id === 0 || !b.onTable) continue;
      const ox = b.x - c.x, oz = b.z - c.z;
      const proj = ox * dx + oz * dz;
      if (proj <= 0) continue;
      const perp2 = ox * ox + oz * oz - proj * proj;
      const r2 = 4 * R * R;
      if (perp2 > r2) continue;
      const t = proj - Math.sqrt(r2 - perp2);
      if (t < tHit) {
        tHit = t;
        hitBall = b;
      }
    }
    // Cushion distance (ball centre bounded by L/2−R, W/2−R).
    const tx = dx > 0 ? (L / 2 - R - c.x) / dx : dx < 0 ? (-L / 2 + R - c.x) / dx : Infinity;
    const tz = dz > 0 ? (W / 2 - R - c.z) / dz : dz < 0 ? (-W / 2 + R - c.z) / dz : Infinity;
    const tWall = Math.min(tx, tz);
    const t = Math.min(tHit, tWall);
    const gx = c.x + dx * t, gz = c.z + dz * t;
    placeSegment(line.current!, c.x + dx * R, c.z + dz * R, gx, gz, 0.0035);
    const gm = ghost.current!;
    gm.position.set(gx, R, gz);
    if (hitBall && tHit <= tWall) {
      const nx = hitBall.x - gx, nz = hitBall.z - gz;
      const nl = Math.hypot(nx, nz) || 1;
      const ux = nx / nl, uz = nz / nl;
      placeSegment(objLine.current!, hitBall.x, hitBall.z, hitBall.x + ux * 0.32, hitBall.z + uz * 0.32, 0.0045);
      // Cue deflects along the tangent (stun shot approximation).
      const dot = dx * ux + dz * uz;
      let txx = dx - ux * dot, tzz = dz - uz * dot;
      const tl = Math.hypot(txx, tzz);
      if (tl > 1e-3) {
        txx /= tl;
        tzz /= tl;
        placeSegment(cueLine.current!, gx, gz, gx + txx * 0.18 * tl, gz + tzz * 0.18 * tl, 0.0025);
      } else cueLine.current!.visible = false;
      bounce.current!.visible = false;
    } else {
      objLine.current!.visible = false;
      cueLine.current!.visible = false;
      // Reflect off the cushion for a short preview.
      const rx = t === tx ? -dx : dx, rz = t === tz ? -dz : dz;
      placeSegment(bounce.current!, gx, gz, gx + rx * 0.3, gz + rz * 0.3, 0.0025);
    }
  });

  return (
    <group>
      <mesh ref={line} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial color={color} transparent opacity={0.75} depthWrite={false} toneMapped={false} />
      </mesh>
      <mesh ref={ghost}>
        <sphereGeometry args={[R, 24, 16]} />
        <meshBasicMaterial color={color} transparent opacity={0.22} depthWrite={false} />
      </mesh>
      <mesh ref={objLine} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial color="#ffd166" transparent opacity={0.9} depthWrite={false} toneMapped={false} />
      </mesh>
      <mesh ref={cueLine} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial color={color} transparent opacity={0.45} depthWrite={false} />
      </mesh>
      <mesh ref={bounce} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial color={color} transparent opacity={0.35} depthWrite={false} />
      </mesh>
    </group>
  );
}

/** Lay a flat strip (plane rotated −90° on x) between two table points. */
function placeSegment(m: THREE.Mesh, ax: number, az: number, bx: number, bz: number, width: number) {
  const len = Math.hypot(bx - ax, bz - az);
  m.position.set((ax + bx) / 2, 0.002, (az + bz) / 2);
  // Plane's local y (length) maps to world −z after the x rotation; rotate about world y.
  m.rotation.set(-Math.PI / 2, 0, Math.atan2(bx - ax, bz - az) + Math.PI);
  m.scale.set(width, Math.max(0.0001, len), 1);
  m.visible = len > 0.001;
}

/** Ball-in-hand ring under the cue ball. */
export function PlacementRing({ game, valid }: { game: BilliardsGame; valid: React.RefObject<boolean> }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    const m = ref.current;
    if (!m) return;
    m.visible = game.canPlaceCue() && game.cue.onTable && !game.isAiTurn();
    m.position.set(game.cue.x, 0.002, game.cue.z);
    m.scale.setScalar(1 + Math.sin(clock.elapsedTime * 5) * 0.08);
    (m.material as THREE.MeshBasicMaterial).color.set(valid.current === false ? "#ff4d5e" : "#7cf29b");
  });
  return (
    <mesh ref={ref} rotation-x={-Math.PI / 2}>
      <ringGeometry args={[R * 1.35, R * 1.75, 32]} />
      <meshBasicMaterial transparent opacity={0.9} toneMapped={false} />
    </mesh>
  );
}
