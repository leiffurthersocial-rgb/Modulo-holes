"use client";
/**
 * Renders a built hole: floors, rails, cup + flag, obstacles, zones, movers and decor.
 * Moving parts read their transforms from the GolfSim every frame.
 */
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { TUNING } from "@/config/tuning";
import type { CourseTheme } from "../courses/types";
import type { BuiltHole, MeshData } from "../sim/build";
import type { GolfSim } from "../sim/GolfSim";
import { beltTexture, candyStripeTexture, chevronTexture, gridTexture, sandTexture, sprinkleTexture, stripeTexture } from "./textures";
import { Decor } from "./Decor";

const G = TUNING.golf;

function toGeometry(m: MeshData, flatNormals = false) {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(m.positions, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(m.uvs, 2));
  g.setIndex(m.indices);
  if (flatNormals) {
    const ng = g.toNonIndexed();
    ng.computeVertexNormals();
    g.dispose();
    return ng;
  }
  g.computeVertexNormals();
  return g;
}

/** Dispose a GPU resource when it is replaced or unmounted. */
function useDispose(v: { dispose: () => void }) {
  useEffect(() => () => v.dispose(), [v]);
}

export function CourseView({ built, theme, sim, isCandy }: { built: BuiltHole; theme: CourseTheme; sim: GolfSim; isCandy: boolean }) {
  const neon = !!theme.glowEdges;

  const floorTex = useMemo(() => {
    if (neon) return { fairway: gridTexture(theme.grass, theme.accent), green: gridTexture(theme.green, theme.rail), path: gridTexture(theme.path, theme.accent) };
    if (isCandy) return { fairway: sprinkleTexture(theme.grass, theme.grassAlt), green: stripeTexture(theme.green, "#bff7e9", false), path: stripeTexture(theme.path, "#fff0de", false) };
    return { fairway: stripeTexture(theme.grass, theme.grassAlt), green: stripeTexture(theme.green, "#a3ea7e"), path: stripeTexture(theme.path, "#e2cf98", false) };
  }, [neon, isCandy, theme]);

  return (
    <group>
      {built.floors.map((f, i) => (
        <Floor key={i} top={f.top} side={f.side} tex={floorTex[f.tone ?? "fairway"]} theme={theme} neon={neon} />
      ))}
      {built.tracks.map((t, i) => (
        <Track key={i} mesh={t} theme={theme} neon={neon} />
      ))}
      <Cup built={built} sim={sim} theme={theme} />
      <Rails built={built} theme={theme} neon={neon} isCandy={isCandy} />
      {built.bumpers.map((b, i) => (
        <Bumper key={i} at={b.at} r={b.r} index={i} sim={sim} theme={theme} />
      ))}
      <Zones built={built} theme={theme} />
      {built.bouncePads.map((p, i) => (
        <BouncePad key={i} at={p.at} r={p.r} index={i} sim={sim} theme={theme} />
      ))}
      {built.teleporters.map((t, i) => (
        <Teleporter key={i} a={t.a} b={t.b} exitYaw={t.exitYaw} color={t.color ?? theme.accent} />
      ))}
      {sim.kin.map((k, i) => (
        <Kinematic key={i} index={i} sim={sim} theme={theme} />
      ))}
      {built.windmills.map((w, i) => (
        <WindmillHouse key={i} at={w.at} yaw={w.yaw} laneWidth={w.laneWidth} theme={theme} />
      ))}
      {built.gates.map((g, i) => (
        <Gate key={i} index={i} sim={sim} at={g.at} yaw={g.yaw} width={g.width} theme={theme} />
      ))}
      <Coins built={built} sim={sim} />
      {built.decor.map((d, i) => (
        <Decor key={i} d={d} theme={theme} />
      ))}
    </group>
  );
}

function Floor({ top, side, tex, theme, neon }: { top: MeshData; side: MeshData; tex: THREE.Texture; theme: CourseTheme; neon: boolean }) {
  const topGeo = useMemo(() => toGeometry(top), [top]);
  useDispose(topGeo);
  const sideGeo = useMemo(() => toGeometry(side, true), [side]);
  useDispose(sideGeo);
  return (
    <group>
      <mesh geometry={topGeo} receiveShadow>
        <meshStandardMaterial map={tex} roughness={0.85} emissiveMap={neon ? tex : null} emissive={neon ? "#ffffff" : "#000000"} emissiveIntensity={neon ? 0.55 : 0} />
      </mesh>
      <mesh geometry={sideGeo} castShadow receiveShadow>
        <meshStandardMaterial color={theme.cliff} roughness={0.95} flatShading />
      </mesh>
    </group>
  );
}

function Track({ mesh, theme, neon }: { mesh: MeshData; theme: CourseTheme; neon: boolean }) {
  const geo = useMemo(() => toGeometry(mesh), [mesh]);
  useDispose(geo);
  return (
    <mesh geometry={geo} castShadow receiveShadow>
      <meshStandardMaterial
        color={neon ? theme.grassAlt : theme.path}
        emissive={neon ? theme.accent : "#000000"}
        emissiveIntensity={neon ? 0.25 : 0}
        roughness={0.55}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

function Rails({ built, theme, neon, isCandy }: { built: BuiltHole; theme: CourseTheme; neon: boolean; isCandy: boolean }) {
  const candyTex = useMemo(() => (isCandy ? candyStripeTexture() : null), [isCandy]);
  return (
    <group>
      {built.boxes.map((b, i) => {
        if (b.role === "windmill") return null;
        const q = new THREE.Quaternion(...b.quat);
        const isRail = b.role === "rail";
        const color = isRail
          ? theme.rail
          : b.style === "accent"
            ? theme.accent
            : b.style === "crate"
              ? "#c48a4a"
              : b.style === "wall"
                ? theme.rail
                : neon
                  ? "#1a1840"
                  : isCandy
                    ? "#7b4a32"
                    : "#9aa3ad";
        return (
          <group key={i} position={b.center} quaternion={q}>
            <mesh castShadow receiveShadow>
              <boxGeometry args={[b.half[0] * 2, b.half[1] * 2, b.half[2] * 2]} />
              <meshStandardMaterial
                color={color}
                map={isRail && candyTex ? candyTex : null}
                emissive={neon ? color : "#000000"}
                emissiveIntensity={neon ? (isRail ? 1.6 : 0.4) : 0}
                roughness={0.5}
              />
            </mesh>
            {isRail && !isCandy && (
              <mesh position={[0, b.half[1] + 0.02, 0]}>
                <boxGeometry args={[b.half[0] * 2, 0.04, b.half[2] * 2 + 0.02]} />
                <meshStandardMaterial color={theme.railTop} emissive={neon ? theme.railTop : "#000000"} emissiveIntensity={neon ? 2.2 : 0} roughness={0.4} />
              </mesh>
            )}
          </group>
        );
      })}
    </group>
  );
}

function Cup({ built, sim, theme }: { built: BuiltHole; sim: GolfSim; theme: CourseTheme }) {
  const geo = useMemo(() => toGeometry(built.cup), [built.cup]);
  useDispose(geo);
  const flagRef = useRef<THREE.Group>(null);
  const clothRef = useRef<THREE.Mesh>(null);
  const [cx, cy, cz] = built.def.cup;
  const cloth = useMemo(() => new THREE.PlaneGeometry(0.9, 0.55, 10, 5), []);
  useDispose(cloth);
  const base = useMemo(() => Float32Array.from(cloth.attributes.position.array), [cloth]);

  useFrame(({ clock }, dt) => {
    // Flag lifts out of the cup when the ball approaches.
    const g = flagRef.current;
    if (g) {
      const d = sim.distanceToCup();
      const lift = sim.phase === "holed" ? 1 : d < 1.6 && sim.phase === "moving" ? 1 : 0;
      g.position.y += ((lift ? 2.6 : 0) - g.position.y) * Math.min(1, dt * 5);
      g.rotation.z += ((lift ? -0.5 : 0) - g.rotation.z) * Math.min(1, dt * 4);
    }
    const c = clothRef.current;
    if (c) {
      const pos = c.geometry.attributes.position as THREE.BufferAttribute;
      const t = clock.elapsedTime;
      for (let i = 0; i < pos.count; i++) {
        const x = base[i * 3];
        const k = (x + 0.45) / 0.9;
        pos.setZ(i, Math.sin(t * 5 + x * 6) * 0.08 * k);
      }
      pos.needsUpdate = true;
      c.geometry.computeVertexNormals();
    }
  });

  return (
    <group>
      <mesh geometry={geo}>
        <meshStandardMaterial color="#141414" roughness={1} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[cx, cy + 0.005, cz]} rotation-x={-Math.PI / 2}>
        <ringGeometry args={[G.cup.radius, G.cup.radius + 0.07, 40]} />
        <meshStandardMaterial color="#ffffff" roughness={0.4} />
      </mesh>
      <group position={[cx, cy, cz]}>
        <group ref={flagRef}>
          <mesh position={[0, 1.1, 0]} castShadow>
            <cylinderGeometry args={[0.035, 0.035, 2.4, 8]} />
            <meshStandardMaterial color="#f5f5f5" metalness={0.3} roughness={0.3} />
          </mesh>
          <mesh ref={clothRef} geometry={cloth} position={[0.47, 2.0, 0]} castShadow>
            <meshStandardMaterial color={theme.flag} side={THREE.DoubleSide} emissive={theme.flag} emissiveIntensity={theme.glowEdges ? 1.2 : 0.08} />
          </mesh>
        </group>
      </group>
      {/* Soft glow marker so the cup reads from far away. */}
      <mesh position={[cx, cy + 0.02, cz]} rotation-x={-Math.PI / 2}>
        <ringGeometry args={[G.cup.radius + 0.12, G.cup.radius + 0.5, 40]} />
        <meshBasicMaterial color={theme.flag} transparent opacity={0.18} depthWrite={false} />
      </mesh>
    </group>
  );
}

function Bumper({ at, r, index, sim, theme }: { at: [number, number, number]; r: number; index: number; sim: GolfSim; theme: CourseTheme }) {
  const ref = useRef<THREE.Group>(null);
  const ringMat = useRef<THREE.MeshStandardMaterial>(null);
  useFrame(() => {
    const p = sim.bumperPulse[index] ?? 0;
    const g = ref.current;
    if (g) {
      const s = 1 + Math.sin(p * Math.PI * 3) * p * 0.18;
      g.scale.set(s, 1 / s, s);
    }
    if (ringMat.current) ringMat.current.emissiveIntensity = 0.6 + p * 4;
  });
  return (
    <group ref={ref} position={at}>
      <mesh position={[0, 0.4, 0]} castShadow>
        <cylinderGeometry args={[r, r * 1.05, 0.8, 28]} />
        <meshStandardMaterial color="#ffffff" roughness={0.3} />
      </mesh>
      <mesh position={[0, 0.55, 0]}>
        <cylinderGeometry args={[r * 1.04, r * 1.04, 0.18, 28]} />
        <meshStandardMaterial ref={ringMat} color={theme.accent} emissive={theme.accent} emissiveIntensity={0.6} />
      </mesh>
      <mesh position={[0, 0.82, 0]}>
        <sphereGeometry args={[r * 0.55, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color={theme.accent} roughness={0.25} />
      </mesh>
    </group>
  );
}

function polyGeometry(poly: [number, number][], y: number) {
  const shape = new THREE.Shape(poly.map(([x, z]) => new THREE.Vector2(x, -z)));
  const g = new THREE.ShapeGeometry(shape);
  g.rotateX(-Math.PI / 2);
  g.translate(0, y, 0);
  // World-space UVs.
  const pos = g.attributes.position;
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    uv[i * 2] = pos.getX(i) / 2;
    uv[i * 2 + 1] = pos.getZ(i) / 2;
  }
  g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  return g;
}

function Zones({ built, theme }: { built: BuiltHole; theme: CourseTheme }) {
  return (
    <group>
      {built.zones.map((z, i) => {
        if (z.kind === "sand") return <SandZone key={i} poly={z.poly} y={z.y} color={theme.sand} />;
        if (z.kind === "ice") return <IceZone key={i} poly={z.poly} y={z.y} color={theme.ice} />;
        if (z.kind === "boost") return <BoostPad key={i} center={z.center!} y={z.y} yaw={z.yaw!} length={z.length!} width={z.width!} color={theme.accent} />;
        return <Conveyor key={i} center={z.center!} y={z.y} yaw={z.yaw!} length={z.length!} width={z.width!} speed={z.speed ?? 2} />;
      })}
    </group>
  );
}

function SandZone({ poly, y, color }: { poly: [number, number][]; y: number; color: string }) {
  const geo = useMemo(() => polyGeometry(poly, y + 0.012), [poly, y]);
  useDispose(geo);
  const tex = useMemo(() => sandTexture(color), [color]);
  return (
    <mesh geometry={geo} receiveShadow>
      <meshStandardMaterial map={tex} roughness={1} polygonOffset polygonOffsetFactor={-2} />
    </mesh>
  );
}

function IceZone({ poly, y, color }: { poly: [number, number][]; y: number; color: string }) {
  const geo = useMemo(() => polyGeometry(poly, y + 0.012), [poly, y]);
  useDispose(geo);
  return (
    <mesh geometry={geo} receiveShadow>
      <meshPhysicalMaterial color={color} roughness={0.05} metalness={0.1} clearcoat={1} clearcoatRoughness={0.05} transparent opacity={0.9} polygonOffset polygonOffsetFactor={-2} />
    </mesh>
  );
}

function BoostPad({ center, y, yaw, length, width, color }: { center: [number, number]; y: number; yaw: number; length: number; width: number; color: string }) {
  const tex = useMemo(() => {
    const t = chevronTexture("#ffffff").clone();
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(1, length / width);
    t.needsUpdate = true;
    return t;
  }, [length, width]);
  useEffect(() => () => tex.dispose(), [tex]);
  useFrame((_, dt) => {
    tex.offset.y -= dt * 2.2;
  });
  return (
    <group position={[center[0], y + 0.015, center[1]]} rotation-y={-yaw}>
      <mesh rotation-x={-Math.PI / 2}>
        <planeGeometry args={[width, length]} />
        <meshStandardMaterial color="#111" emissive={color} emissiveMap={tex} emissiveIntensity={2.2} roughness={0.4} polygonOffset polygonOffsetFactor={-3} />
      </mesh>
    </group>
  );
}

function Conveyor({ center, y, yaw, length, width, speed }: { center: [number, number]; y: number; yaw: number; length: number; width: number; speed: number }) {
  const tex = useMemo(() => {
    const t = beltTexture().clone();
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(1, length * 2);
    t.needsUpdate = true;
    return t;
  }, [length]);
  useEffect(() => () => tex.dispose(), [tex]);
  useFrame((_, dt) => {
    tex.offset.y -= (dt * speed * 2) / 1;
  });
  return (
    <group position={[center[0], y + 0.014, center[1]]} rotation-y={-yaw}>
      <mesh rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[width, length]} />
        <meshStandardMaterial map={tex} roughness={0.7} polygonOffset polygonOffsetFactor={-3} />
      </mesh>
    </group>
  );
}

function BouncePad({ at, r, index, sim, theme }: { at: [number, number, number]; r: number; index: number; sim: GolfSim; theme: CourseTheme }) {
  const top = useRef<THREE.Mesh>(null);
  useFrame(() => {
    const p = sim.padPulse[index] ?? 0;
    if (top.current) {
      top.current.position.y = 0.06 + Math.sin(p * Math.PI) * 0.25;
      (top.current.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.5 + p * 3;
    }
  });
  return (
    <group position={at}>
      <mesh position={[0, 0.02, 0]} receiveShadow>
        <cylinderGeometry args={[r, r, 0.04, 28]} />
        <meshStandardMaterial color="#333" />
      </mesh>
      <mesh ref={top} position={[0, 0.06, 0]}>
        <cylinderGeometry args={[r * 0.88, r * 0.88, 0.05, 28]} />
        <meshStandardMaterial color={theme.accent} emissive={theme.accent} emissiveIntensity={0.5} roughness={0.3} />
      </mesh>
    </group>
  );
}

function Teleporter({ a, b, exitYaw, color }: { a: [number, number, number]; b: [number, number, number]; exitYaw: number; color: string }) {
  const r1 = useRef<THREE.Mesh>(null);
  const r2 = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (r1.current) {
      r1.current.rotation.z = t * 2;
      r1.current.scale.setScalar(1 + Math.sin(t * 4) * 0.06);
    }
    if (r2.current) r2.current.rotation.z = -t * 2;
  });
  return (
    <group>
      <group position={[a[0], a[1] + 0.02, a[2]]} rotation-x={-Math.PI / 2}>
        <mesh>
          <circleGeometry args={[0.55, 32]} />
          <meshBasicMaterial color={color} transparent opacity={0.35} toneMapped={false} />
        </mesh>
        <mesh ref={r1}>
          <torusGeometry args={[0.5, 0.05, 8, 32, Math.PI * 1.6]} />
          <meshBasicMaterial color={color} toneMapped={false} />
        </mesh>
      </group>
      <group position={[b[0], b[1] + 0.02, b[2]]}>
        <mesh rotation-x={-Math.PI / 2} ref={r2}>
          <torusGeometry args={[0.45, 0.04, 8, 32, Math.PI * 1.6]} />
          <meshBasicMaterial color={color} toneMapped={false} />
        </mesh>
        <group rotation-y={-exitYaw}>
          <mesh position={[0, 0.02, -0.75]} rotation-x={-Math.PI / 2}>
            <coneGeometry args={[0.18, 0.35, 3]} />
            <meshBasicMaterial color={color} toneMapped={false} />
          </mesh>
        </group>
      </group>
    </group>
  );
}

function Kinematic({ index, sim, theme }: { index: number; sim: GolfSim; theme: CourseTheme }) {
  const ref = useRef<THREE.Group>(null);
  const k = sim.kin[index];
  useFrame(() => {
    if (!ref.current) return;
    ref.current.position.copy(k.pos);
    ref.current.quaternion.copy(k.quat);
  });
  const neon = !!theme.glowEdges;
  return (
    <group ref={ref}>
      {k.def.shapes.map((s, i) => {
        const q = s.rot ? new THREE.Quaternion(...s.rot) : undefined;
        const isPlatform = k.def.kind === "mover" || k.def.kind === "tilt";
        const color = isPlatform ? theme.path : k.def.kind === "windmill" ? "#fbf3e4" : theme.accent;
        return (
          <mesh key={i} position={s.offset} quaternion={q} castShadow receiveShadow>
            {s.kind === "box" ? <boxGeometry args={[s.half[0] * 2, s.half[1] * 2, s.half[2] * 2]} /> : <cylinderGeometry args={[s.half[0], s.half[0], s.half[1] * 2, 20]} />}
            <meshStandardMaterial color={color} roughness={0.5} emissive={neon ? theme.accent : "#000000"} emissiveIntensity={neon ? 0.35 : 0} />
          </mesh>
        );
      })}
      {(k.def.kind === "mover" || k.def.kind === "tilt") && k.def.size && (
        // Hazard stripes around the platform edge.
        <mesh position={[0, -k.def.size[1] / 2, 0]}>
          <boxGeometry args={[k.def.size[0] + 0.04, k.def.size[1] * 0.4, k.def.size[2] + 0.04]} />
          <meshStandardMaterial color={theme.accent} emissive={theme.accent} emissiveIntensity={neon ? 1.2 : 0.15} />
        </mesh>
      )}
    </group>
  );
}

function WindmillHouse({ at, yaw, laneWidth, theme }: { at: [number, number, number]; yaw: number; laneWidth: number; theme: CourseTheme }) {
  const W = laneWidth + 1.4;
  const neon = !!theme.glowEdges;
  const wall = neon ? "#191a3a" : "#fbf3e4";
  return (
    <group position={at} rotation-y={-yaw}>
      {/* Pillars + lintel + tower, matching the physics boxes. */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * (laneWidth / 2 + 0.35), 1.55, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.7, 3.1, 1.4]} />
          <meshStandardMaterial color={wall} roughness={0.8} emissive={neon ? theme.accent : "#000"} emissiveIntensity={neon ? 0.2 : 0} />
        </mesh>
      ))}
      <mesh position={[0, 0.95 + (3.1 - 0.95) / 2, 0]} castShadow>
        <boxGeometry args={[laneWidth + 0.02, 3.1 - 0.95, 1.4]} />
        <meshStandardMaterial color={wall} roughness={0.8} />
      </mesh>
      {/* Roof */}
      <mesh position={[0, 3.1 + 0.7, 0]} rotation-y={Math.PI / 4} castShadow>
        <coneGeometry args={[W * 0.78, 1.4, 4]} />
        <meshStandardMaterial color={theme.accent} roughness={0.6} flatShading emissive={neon ? theme.accent : "#000"} emissiveIntensity={neon ? 0.8 : 0} />
      </mesh>
      {/* Door frame accent */}
      <mesh position={[0, 0.95, 0.71]}>
        <boxGeometry args={[laneWidth + 0.2, 0.12, 0.04]} />
        <meshStandardMaterial color={theme.rail} emissive={neon ? theme.rail : "#000"} emissiveIntensity={neon ? 2 : 0} />
      </mesh>
      {/* Hub */}
      <mesh position={[0, 1.95, 0.72 + 0.1]} rotation-x={Math.PI / 2}>
        <cylinderGeometry args={[0.2, 0.2, 0.3, 16]} />
        <meshStandardMaterial color="#555" />
      </mesh>
    </group>
  );
}

function Gate({ index, sim, at, yaw, width, theme }: { index: number; sim: GolfSim; at: [number, number, number]; yaw: number; width: number; theme: CourseTheme }) {
  const flap = useRef<THREE.Group>(null);
  useFrame(() => {
    if (flap.current) flap.current.rotation.x = -(sim.gateOpen[index] ?? 0) * 1.25;
  });
  return (
    <group position={at} rotation-y={-yaw}>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[(s * width) / 2, 0.45, 0]} castShadow>
          <boxGeometry args={[0.1, 0.9, 0.1]} />
          <meshStandardMaterial color={theme.rail} />
        </mesh>
      ))}
      <mesh position={[0, 0.9, 0]}>
        <boxGeometry args={[width + 0.1, 0.08, 0.1]} />
        <meshStandardMaterial color={theme.rail} />
      </mesh>
      <group ref={flap} position={[0, 0.86, 0]}>
        <mesh position={[0, -0.4, 0]} castShadow>
          <boxGeometry args={[width - 0.08, 0.76, 0.05]} />
          <meshStandardMaterial color={theme.accent} transparent opacity={0.85} emissive={theme.accent} emissiveIntensity={0.3} />
        </mesh>
        {/* Arrow showing the allowed direction (local −z = travel). */}
        <mesh position={[0, -0.4, -0.04]} rotation-x={-Math.PI / 2}>
          <coneGeometry args={[0.16, 0.3, 3]} />
          <meshBasicMaterial color="#ffffff" />
        </mesh>
      </group>
    </group>
  );
}

function Coins({ built, sim }: { built: BuiltHole; sim: GolfSim }) {
  const refs = useRef<(THREE.Group | null)[]>([]);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    refs.current.forEach((g, i) => {
      if (!g) return;
      const got = sim.collected.has(i);
      g.visible = !got;
      g.rotation.y = t * 2.4 + i;
      g.position.y = built.coins[i][1] + 0.15 + Math.sin(t * 3 + i) * 0.08;
    });
  });
  return (
    <group>
      {built.coins.map((c, i) => (
        <group key={i} ref={(el) => void (refs.current[i] = el)} position={c}>
          <mesh rotation-x={Math.PI / 2} castShadow>
            <cylinderGeometry args={[0.26, 0.26, 0.06, 24]} />
            <meshStandardMaterial color="#ffc83d" metalness={0.85} roughness={0.25} emissive="#ff9d00" emissiveIntensity={0.45} />
          </mesh>
          <mesh rotation-x={Math.PI / 2}>
            <torusGeometry args={[0.2, 0.025, 8, 24]} />
            <meshStandardMaterial color="#fff1b3" metalness={0.9} roughness={0.2} emissive="#ffd166" emissiveIntensity={0.6} />
          </mesh>
        </group>
      ))}
    </group>
  );
}
