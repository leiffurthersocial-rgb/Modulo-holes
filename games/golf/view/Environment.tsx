"use client";
/** Sky dome, lake/void, lights (shadow frustum fitted to the hole) and ambient scenery. */
import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Stars } from "@react-three/drei";
import * as THREE from "three";
import type { CourseTheme, DecorKind } from "../courses/types";
import type { BuiltHole } from "../sim/build";
import { pointInPoly } from "../sim/build";
import { mulberry32, hashString } from "@/engine/rng";
import { Decor } from "./Decor";
import { QUALITY_PRESETS } from "@/engine/render/GameCanvas";
import { useEffectiveQuality } from "@/engine/save/settings";

export function Environment({ built, theme, world }: { built: BuiltHole; theme: CourseTheme; world: string }) {
  const quality = useEffectiveQuality();
  const { min, max } = built.bounds;
  const cx = (min[0] + max[0]) / 2, cz = (min[2] + max[2]) / 2;
  const span = Math.max(max[0] - min[0], max[2] - min[2]) / 2 + 4;
  const light = useRef<THREE.DirectionalLight>(null);
  const scene = useThree((s) => s.scene);

  useEffect(() => {
    scene.fog = new THREE.Fog(theme.fog, theme.fogNear, theme.fogFar);
    return () => {
      scene.fog = null;
    };
  }, [scene, theme]);

  useEffect(() => {
    const l = light.current;
    if (!l) return;
    l.target.position.set(cx, 0, cz);
    l.target.updateMatrixWorld();
    const cam = l.shadow.camera;
    cam.left = -span;
    cam.right = span;
    cam.top = span;
    cam.bottom = -span;
    cam.near = 1;
    cam.far = 80;
    cam.updateProjectionMatrix();
  }, [cx, cz, span]);

  const shadowSize = QUALITY_PRESETS[quality].shadowMapSize;

  return (
    <group>
      <SkyDome top={theme.skyTop} bottom={theme.skyBottom} />
      <hemisphereLight args={[theme.ambient, theme.cliff, theme.ambientIntensity]} />
      <directionalLight
        ref={light}
        position={[cx + 10, 22, cz + 12]}
        intensity={theme.sunIntensity}
        color={theme.sun}
        castShadow
        shadow-mapSize={[shadowSize, shadowSize]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.03}
      />
      {theme.below.kind === "water" ? <Water y={theme.below.y} color={theme.below.color} /> : <VoidFloor y={theme.below.y} theme={theme} />}
      {world === "neon" && <Stars radius={120} depth={40} count={1500} factor={4} fade speed={0.6} />}
      <Scenery built={built} theme={theme} world={world} />
    </group>
  );
}

function SkyDome({ top, bottom }: { top: string; bottom: string }) {
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
        uniforms: { top: { value: new THREE.Color(top) }, bottom: { value: new THREE.Color(bottom) } },
        vertexShader: `varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
        fragmentShader: `uniform vec3 top; uniform vec3 bottom; varying vec3 vP; void main(){ float h = clamp(vP.y*1.4+0.25,0.0,1.0); gl_FragColor = vec4(mix(bottom, top, pow(h,0.8)),1.0); }`,
      }),
    [top, bottom],
  );
  useEffect(() => () => mat.dispose(), [mat]);
  const cam = useThree((s) => s.camera);
  const ref = useRef<THREE.Mesh>(null);
  useFrame(() => ref.current?.position.copy(cam.position));
  return (
    <mesh ref={ref} material={mat} renderOrder={-1}>
      <sphereGeometry args={[300, 24, 16]} />
    </mesh>
  );
}

function Water({ y, color }: { y: number; color: string }) {
  const ref = useRef<THREE.MeshStandardMaterial>(null);
  useFrame(({ clock }) => {
    if (ref.current) ref.current.emissiveIntensity = 0.05 + Math.sin(clock.elapsedTime * 0.8) * 0.02;
  });
  return (
    <mesh position={[0, y, 0]} rotation-x={-Math.PI / 2} receiveShadow>
      <planeGeometry args={[600, 600]} />
      <meshStandardMaterial ref={ref} color={color} roughness={0.12} metalness={0.15} emissive={color} emissiveIntensity={0.05} />
    </mesh>
  );
}

function VoidFloor({ y, theme }: { y: number; theme: CourseTheme }) {
  const tex = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = c.height = 128;
    const g = c.getContext("2d")!;
    g.fillStyle = theme.below.color;
    g.fillRect(0, 0, 128, 128);
    g.strokeStyle = theme.rail;
    g.globalAlpha = 0.7;
    g.lineWidth = 2;
    g.strokeRect(0, 0, 128, 128);
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(120, 120);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, [theme]);
  useEffect(() => () => tex.dispose(), [tex]);
  useFrame((_, dt) => {
    tex.offset.y += dt * 0.15;
  });
  return (
    <mesh position={[0, y, 0]} rotation-x={-Math.PI / 2}>
      <planeGeometry args={[600, 600]} />
      <meshBasicMaterial map={tex} toneMapped={false} color="#bbbbbb" />
    </mesh>
  );
}

const SCENERY: Record<string, DecorKind[]> = {
  meadow: ["tree", "pine", "bush", "rock", "tree", "flower"],
  neon: ["neonPillar", "crystal", "neonRing", "crystal"],
  candy: ["lollipop", "gumdrop", "candyCane", "gumdrop", "lollipop"],
};

/** Seeded scatter of small islands/props around the hole, never on the course itself. */
function Scenery({ built, theme, world }: { built: BuiltHole; theme: CourseTheme; world: string }) {
  const items = useMemo(() => {
    const rand = mulberry32(hashString(built.def.id));
    const { min, max } = built.bounds;
    const polys = built.floors.map((f) => {
      const p = f.top.positions;
      const pts: [number, number][] = [];
      for (let i = 0; i < p.length; i += 3) pts.push([p[i], p[i + 2]]);
      return pts;
    });
    const out: { type: DecorKind; at: [number, number, number]; scale: number; island: boolean; yaw: number }[] = [];
    const kinds = SCENERY[world] ?? SCENERY.meadow;
    let tries = 0;
    while (out.length < 26 && tries++ < 400) {
      const x = min[0] - 9 + rand() * (max[0] - min[0] + 18);
      const z = min[2] - 9 + rand() * (max[2] - min[2] + 18);
      // Keep clear of the playable area (bounding-box margin + polygon test).
      const nearCourse = x > min[0] - 2 && x < max[0] + 2 && z > min[2] - 2 && z < max[2] + 2;
      if (nearCourse && polys.some((p) => pointInPoly(x, z, p))) continue;
      if (nearCourse && rand() < 0.7) continue;
      const island = theme.below.kind === "water";
      out.push({ type: kinds[Math.floor(rand() * kinds.length)], at: [x, island ? theme.below.y + 0.35 : theme.below.y + 4 + rand() * 3, z], scale: 0.8 + rand() * 0.8, island, yaw: rand() * 6 });
    }
    return out;
  }, [built, theme, world]);

  return (
    <group>
      {items.map((it, i) => (
        <group key={i}>
          {it.island && (
            <mesh position={[it.at[0], theme.below.y + 0.1, it.at[2]]} receiveShadow>
              <cylinderGeometry args={[1.3 * it.scale, 1.5 * it.scale, 0.55, 9]} />
              <meshStandardMaterial color={world === "candy" ? theme.green : theme.grass} flatShading />
            </mesh>
          )}
          <Decor d={{ type: it.type, at: it.at, scale: it.scale, yaw: it.yaw }} theme={theme} />
        </group>
      ))}
    </group>
  );
}
