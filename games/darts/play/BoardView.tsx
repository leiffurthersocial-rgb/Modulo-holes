"use client";
/** Dartboard (procedural face + real wire spider), cabinet, room, darts and the aim reticle. */
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { TUNING } from "@/config/tuning";
import { RING, SECTORS } from "../sim/board";
import type { BoardTheme, FlightDesign } from "../themes";
import type { DartsGame, ThrownDart } from "./game";

const H = TUNING.darts.boardHeight;
const DART_LEN = 0.155;

// ------------------------------------------------------------------ textures

function boardTexture(t: BoardTheme) {
  const S = 2048;
  const c = document.createElement("canvas");
  c.width = c.height = S;
  const g = c.getContext("2d")!;
  const cx = S / 2, k = S / 2 / RING.board;
  g.fillStyle = t.surround;
  g.fillRect(0, 0, S, S);
  // Number ring background.
  g.beginPath();
  g.arc(cx, cx, RING.board * k, 0, Math.PI * 2);
  g.fillStyle = "#101010";
  if (t.id === "candy") g.fillStyle = "#ff8cc6";
  g.fill();
  const ring = (r0: number, r1: number, colA: string, colB: string) => {
    for (let i = 0; i < 20; i++) {
      // Canvas angles: 0 = +x, clockwise. Sector 20 is centred at the top (−90°).
      const a0 = ((-90 - 9 + i * 18) * Math.PI) / 180;
      const a1 = a0 + (18 * Math.PI) / 180;
      g.beginPath();
      g.arc(cx, cx, r1 * k, a0, a1);
      g.arc(cx, cx, r0 * k, a1, a0, true);
      g.closePath();
      g.fillStyle = i % 2 === 0 ? colA : colB;
      g.fill();
    }
  };
  ring(RING.trebleOut, RING.doubleIn, t.dark, t.light);
  ring(RING.outerBull, RING.trebleIn, t.dark, t.light);
  ring(RING.doubleIn, RING.doubleOut, t.red, t.green);
  ring(RING.trebleIn, RING.trebleOut, t.red, t.green);
  g.beginPath();
  g.arc(cx, cx, RING.outerBull * k, 0, Math.PI * 2);
  g.fillStyle = t.green;
  g.fill();
  g.beginPath();
  g.arc(cx, cx, RING.innerBull * k, 0, Math.PI * 2);
  g.fillStyle = t.red;
  g.fill();
  // Sisal fibre speckle.
  const img = g.getImageData(0, 0, S, S);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (Math.random() - 0.5) * 26;
    img.data[i] += n;
    img.data[i + 1] += n;
    img.data[i + 2] += n;
  }
  g.putImageData(img, 0, 0);
  // Numbers.
  g.fillStyle = t.id === "candy" ? "#ffffff" : "#f4f4f4";
  g.font = `bold ${Math.round(S * 0.048)}px "Fredoka Variable", Arial, sans-serif`;
  g.textAlign = "center";
  g.textBaseline = "middle";
  const rn = ((RING.doubleOut + RING.board) / 2) * k;
  SECTORS.forEach((n, i) => {
    const a = ((-90 + i * 18) * Math.PI) / 180;
    g.save();
    g.translate(cx + Math.cos(a) * rn, cx + Math.sin(a) * rn);
    g.rotate(a + Math.PI / 2);
    g.fillText(String(n), 0, 0);
    g.restore();
  });
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

function wallTexture(t: BoardTheme) {
  const c = document.createElement("canvas");
  c.width = c.height = 512;
  const g = c.getContext("2d")!;
  g.fillStyle = t.wallColor;
  g.fillRect(0, 0, 512, 512);
  if (t.wall === "brick") {
    for (let row = 0; row < 16; row++) {
      for (let col = 0; col < 5; col++) {
        const x = col * 110 + (row % 2) * 55 - 20, y = row * 32;
        const shade = 0.85 + Math.random() * 0.3;
        g.fillStyle = `rgba(${Math.round(150 * shade)},${Math.round(72 * shade)},${Math.round(50 * shade)},1)`;
        g.fillRect(x + 3, y + 3, 104, 26);
      }
    }
  } else if (t.wall === "panel") {
    for (let i = 0; i < 8; i++) {
      g.fillStyle = i % 2 ? "rgba(255,255,255,0.025)" : "rgba(0,0,0,0.15)";
      g.fillRect(i * 64, 0, 64, 512);
    }
  } else if (t.wall === "neon") {
    g.strokeStyle = "rgba(160,120,255,0.25)";
    for (let i = 0; i <= 512; i += 64) {
      g.beginPath();
      g.moveTo(i, 0);
      g.lineTo(i, 512);
      g.moveTo(0, i);
      g.lineTo(512, i);
      g.stroke();
    }
  } else {
    for (let i = 0; i < 40; i++) {
      g.fillStyle = ["#ffffff", "#ffb3da", "#b8f2e6", "#ffe08a"][i % 4];
      g.globalAlpha = 0.5;
      g.beginPath();
      g.arc(Math.random() * 512, Math.random() * 512, 6 + Math.random() * 10, 0, Math.PI * 2);
      g.fill();
    }
    g.globalAlpha = 1;
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(4, 3);
  return tex;
}

const flightCache = new Map<string, THREE.Texture>();
export function flightTexture(f: FlightDesign, color: string) {
  const key = `${f.id}:${color}`;
  const hit = flightCache.get(key);
  if (hit) return hit;
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d")!;
  g.fillStyle = color;
  g.fillRect(0, 0, 128, 128);
  if (f.pattern === "stripe") {
    g.fillStyle = "#ffffff";
    g.fillRect(0, 54, 128, 20);
  } else if (f.pattern === "flame") {
    const grd = g.createLinearGradient(0, 128, 0, 0);
    grd.addColorStop(0, "#ffd166");
    grd.addColorStop(0.5, "#ff6b2d");
    grd.addColorStop(1, "#b0121b");
    g.fillStyle = grd;
    g.fillRect(0, 0, 128, 128);
  } else if (f.pattern === "galaxy") {
    g.fillStyle = "#170f3d";
    g.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 60; i++) {
      g.fillStyle = i % 5 ? "#ffffff" : color;
      g.fillRect(Math.random() * 128, Math.random() * 128, 2, 2);
    }
  } else if (f.pattern === "chequer") {
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) if ((x + y) % 2) {
      g.fillStyle = "#111";
      g.fillRect(x * 16, y * 16, 16, 16);
    }
  } else {
    const grd = g.createLinearGradient(0, 0, 128, 128);
    grd.addColorStop(0, "#fff3b0");
    grd.addColorStop(0.5, "#ffc83d");
    grd.addColorStop(1, "#a86f00");
    g.fillStyle = grd;
    g.fillRect(0, 0, 128, 128);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  flightCache.set(key, t);
  return t;
}

// ------------------------------------------------------------------ board + room

export function DartsRoom({ theme, boardRef }: { theme: BoardTheme; boardRef: React.RefObject<THREE.Group | null> }) {
  const face = useMemo(() => boardTexture(theme), [theme]);
  const wall = useMemo(() => wallTexture(theme), [theme]);
  useEffect(() => () => face.dispose(), [face]);
  useEffect(() => () => wall.dispose(), [wall]);
  const neon = theme.wall === "neon";
  const lampTarget = useMemo(() => new THREE.Object3D(), []);

  return (
    <group>
      {/* Wall + floor */}
      <mesh position={[0, H, -0.06]} receiveShadow>
        <planeGeometry args={[8, 5]} />
        <meshStandardMaterial map={wall} roughness={0.9} />
      </mesh>
      <mesh position={[0, 0, 1.5]} rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[8, 6]} />
        <meshStandardMaterial color={neon ? "#07051a" : "#2a1d14"} roughness={0.8} />
      </mesh>

      {/* Cabinet with open doors */}
      <group position={[0, H, -0.05]}>
        <mesh position={[0, 0, 0]} receiveShadow castShadow>
          <boxGeometry args={[0.78, 0.78, 0.02]} />
          <meshStandardMaterial color={theme.cabinet} roughness={0.6} />
        </mesh>
        {[-1, 1].map((s) => (
          <group key={s} position={[s * 0.39, 0, 0.03]} rotation-y={s * 1.15}>
            <mesh position={[s * 0.195, 0, 0]} castShadow receiveShadow>
              <boxGeometry args={[0.39, 0.78, 0.025]} />
              <meshStandardMaterial color={theme.cabinet} roughness={0.55} />
            </mesh>
            <mesh position={[s * 0.195, 0, 0.0135]}>
              <planeGeometry args={[0.32, 0.68]} />
              <meshStandardMaterial color={neon ? "#120a2a" : theme.id === "candy" ? "#fff0f8" : "#1d2420"} roughness={1} />
            </mesh>
          </group>
        ))}
      </group>

      {/* Board */}
      <group ref={boardRef} position={[0, H, 0]}>
        <mesh position={[0, 0, -0.02]} rotation-x={Math.PI / 2} castShadow receiveShadow>
          <cylinderGeometry args={[RING.board + 0.004, RING.board + 0.004, 0.04, 64]} />
          <meshStandardMaterial color="#0d0d0d" roughness={0.7} />
        </mesh>
        <mesh position={[0, 0, 0.0002]} receiveShadow>
          <circleGeometry args={[RING.board, 128]} />
          <meshStandardMaterial map={face} roughness={0.95} />
        </mesh>
        {/* Surround catches wild darts */}
        <mesh position={[0, 0, -0.005]} receiveShadow>
          <ringGeometry args={[RING.board, 0.33, 96]} />
          <meshStandardMaterial color={theme.surround} roughness={1} />
        </mesh>
        <Spider theme={theme} />
        {theme.ring && (
          <mesh position={[0, 0, 0.03]}>
            <torusGeometry args={[0.3, 0.012, 12, 96]} />
            <meshBasicMaterial color={theme.ring} toneMapped={false} />
          </mesh>
        )}
      </group>

      {/* Lighting: board lamps + room fill */}
      <ambientLight intensity={neon ? 0.25 : 0.35} />
      <hemisphereLight args={[theme.lamp, "#1a120c", 0.35]} />
      <primitive object={lampTarget} position={[0, H, 0]} />
      <spotLight position={[0, H + 0.9, 0.9]} target={lampTarget} angle={0.55} penumbra={0.6} intensity={9} decay={1.2} color={theme.lamp} castShadow shadow-mapSize={[1024, 1024]} shadow-bias={-0.0003} />
      <pointLight position={[0.5, H + 0.2, 1.6]} intensity={0.8} distance={4} color={theme.lamp} />
    </group>
  );
}

/** Real 3D wire spider: ring wires and radial wires, catching the light. */
function Spider({ theme }: { theme: BoardTheme }) {
  const neon = theme.wall === "neon";
  const mat = <meshStandardMaterial color={theme.wire} metalness={0.95} roughness={0.25} emissive={neon ? theme.wire : "#000"} emissiveIntensity={neon ? 1.4 : 0} />;
  const rings = [RING.innerBull, RING.outerBull, RING.trebleIn, RING.trebleOut, RING.doubleIn, RING.doubleOut];
  return (
    <group position={[0, 0, 0.0006]}>
      {rings.map((r) => (
        <mesh key={r}>
          <torusGeometry args={[r, 0.0006, 6, 128]} />
          {mat}
        </mesh>
      ))}
      {Array.from({ length: 20 }, (_, i) => {
        const a = ((i * 18 + 9) * Math.PI) / 180; // wire between sectors, clockwise from top
        const len = RING.doubleOut - RING.outerBull;
        const r = RING.outerBull + len / 2;
        return (
          <mesh key={i} position={[Math.sin(a) * r, Math.cos(a) * r, 0]} rotation-z={-a}>
            <boxGeometry args={[0.0011, len, 0.0011]} />
            {mat}
          </mesh>
        );
      })}
    </group>
  );
}

// ------------------------------------------------------------------ darts

function DartModel({ color, flight }: { color: string; flight: FlightDesign }) {
  const tex = flightTexture(flight, color);
  // Local +z points from the tip back toward the flights.
  const flightShape = useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(0, 0);
    s.lineTo(0.022, 0.012);
    s.lineTo(0.024, 0.036);
    s.lineTo(0, 0.04);
    s.closePath();
    const g = new THREE.ShapeGeometry(s);
    // UVs from bounds.
    const pos = g.attributes.position;
    const uv = new Float32Array(pos.count * 2);
    for (let i = 0; i < pos.count; i++) {
      uv[i * 2] = pos.getX(i) / 0.024;
      uv[i * 2 + 1] = pos.getY(i) / 0.04;
    }
    g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
    return g;
  }, []);
  return (
    <group>
      <mesh position={[0, 0, 0.012]} rotation-x={-Math.PI / 2}>
        <coneGeometry args={[0.0011, 0.024, 8]} />
        <meshStandardMaterial color="#d9d9d9" metalness={1} roughness={0.2} />
      </mesh>
      <mesh position={[0, 0, 0.047]} rotation-x={Math.PI / 2} castShadow>
        <cylinderGeometry args={[0.0034, 0.0029, 0.048, 14]} />
        <meshStandardMaterial color="#8d9299" metalness={1} roughness={0.32} />
      </mesh>
      {[0.035, 0.045, 0.055].map((z) => (
        <mesh key={z} position={[0, 0, z]} rotation-x={Math.PI / 2}>
          <torusGeometry args={[0.0033, 0.0006, 6, 16]} />
          <meshStandardMaterial color="#5a5f66" metalness={1} roughness={0.4} />
        </mesh>
      ))}
      <mesh position={[0, 0, 0.088]} rotation-x={Math.PI / 2} castShadow>
        <cylinderGeometry args={[0.0021, 0.0021, 0.036, 10]} />
        <meshStandardMaterial color={color} roughness={0.35} />
      </mesh>
      {[0, 1, 2, 3].map((i) => (
        <mesh key={i} geometry={flightShape} position={[0, 0, 0.106]} rotation={[Math.PI / 2, (i * Math.PI) / 2, 0]} castShadow>
          <meshStandardMaterial map={tex} side={THREE.DoubleSide} roughness={0.5} />
        </mesh>
      ))}
    </group>
  );
}

/** All darts: in flight (parabolic arc, spinning), stuck (with quiver) or bouncing out. */
export function Darts({ game, flight }: { game: DartsGame; flight: FlightDesign }) {
  const MAX = 6;
  const refs = useRef<(THREE.Group | null)[]>([]);
  const tmp = useMemo(() => ({ p: new THREE.Vector3(), q: new THREE.Vector3(), m: new THREE.Matrix4(), up: new THREE.Vector3(0, 1, 0) }), []);
  useFrame(() => {
    const live = game.darts;
    for (let i = 0; i < MAX; i++) {
      const g = refs.current[i];
      if (!g) continue;
      const d: ThrownDart | undefined = live[i];
      if (!d || d.state === "gone") {
        g.visible = false;
        continue;
      }
      g.visible = true;
      // Recolour per owner via userData flag (children share materials per dart instance).
      if (d.state === "flying") {
        const u = game.flightProgress(d);
        const ex = d.x, ey = H + d.y, ez = 0.0;
        const [sx, sy, sz] = d.from;
        const arc = TUNING.darts.flight.arc * 4 * u * (1 - u);
        tmp.p.set(sx + (ex - sx) * u, sy + (ey - sy) * u + arc, sz + (ez - sz) * u);
        // Direction = derivative of the path.
        const du = Math.min(1, u + 0.02);
        const arc2 = TUNING.darts.flight.arc * 4 * du * (1 - du);
        tmp.q.set(sx + (ex - sx) * du, sy + (ey - sy) * du + arc2, sz + (ez - sz) * du);
        g.position.copy(tmp.p);
        // Tail (+z local) points opposite to travel.
        g.lookAt(tmp.p.clone().multiplyScalar(2).sub(tmp.q));
        g.rotateZ(u * 14);
      } else if (d.state === "stuck") {
        // Tip buried ~7mm into the sisal.
        g.position.set(d.x, H + d.y, -0.007);
        const wob = Math.sin(d.quiver * 32) * Math.exp(-d.quiver * 7) * 0.09;
        g.rotation.set(-d.tiltX + wob, d.tiltY + wob * 0.6, 0);
      } else if (d.state === "bouncing") {
        g.position.set(d.bp[0], d.bp[1], d.bp[2]);
        g.rotation.x += 0.25;
        g.rotation.y += 0.12;
      }
    }
  });
  return (
    <group>
      {Array.from({ length: MAX }, (_, i) => (
        <group key={i} ref={(el) => void (refs.current[i] = el)} visible={false}>
          <OwnerDart game={game} index={i} flight={flight} />
        </group>
      ))}
    </group>
  );
}

/** Dart colour follows its owner (re-renders only when the owner changes). */
function OwnerDart({ game, index, flight }: { game: DartsGame; index: number; flight: FlightDesign }) {
  const ref = useRef<THREE.Group>(null);
  const owner = useRef(-1);
  const colors = useMemo(() => game.players.map((p) => p.color), [game.players]);
  useFrame(() => {
    const d = game.darts[index];
    const o = d ? d.owner : 0;
    if (o !== owner.current && ref.current) {
      owner.current = o;
      ref.current.children.forEach((c, i) => (c.visible = i === o));
    }
  });
  return (
    <group ref={ref}>
      {colors.map((c, i) => (
        <group key={i} visible={i === 0}>
          <DartModel color={c} flight={flight} />
        </group>
      ))}
    </group>
  );
}

/** Aim reticle on the board: ring + cross that sways with the hand. */
export function Reticle({ game, color = "#ffffff" }: { game: DartsGame; color?: string }) {
  const ref = useRef<THREE.Group>(null);
  const spread = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    const g = ref.current;
    if (!g) return;
    const show = game.phase === "aim" || game.phase === "ai";
    g.visible = show;
    if (!show) return;
    const [sx, sy] = game.phase === "aim" ? game.sway() : [0, 0];
    g.position.set(game.aim.x + sx, H + game.aim.y + sy, 0.004);
    const hold = game.holding ? 1 : 0.85 + Math.sin(clock.elapsedTime * 3) * 0.05;
    g.scale.setScalar(hold);
    if (spread.current) {
      const s = TUNING.darts.sway;
      const amp = Math.min(s.max, s.base + Math.max(0, game.holdTime - s.steadyTime) * s.growth);
      spread.current.scale.setScalar(1 + amp * 120);
      (spread.current.material as THREE.MeshBasicMaterial).opacity = game.holding ? 0.25 + Math.min(0.4, amp * 25) : 0.12;
    }
  });
  return (
    <group ref={ref}>
      <mesh>
        <ringGeometry args={[0.0085, 0.0105, 40]} />
        <meshBasicMaterial color={color} toneMapped={false} transparent opacity={0.95} depthWrite={false} />
      </mesh>
      <mesh>
        <circleGeometry args={[0.0018, 16]} />
        <meshBasicMaterial color={color} toneMapped={false} depthWrite={false} transparent />
      </mesh>
      {[0, 1, 2, 3].map((i) => (
        <mesh key={i} position={[Math.cos((i * Math.PI) / 2) * 0.016, Math.sin((i * Math.PI) / 2) * 0.016, 0]} rotation-z={(i * Math.PI) / 2}>
          <planeGeometry args={[0.008, 0.0016]} />
          <meshBasicMaterial color={color} toneMapped={false} transparent opacity={0.9} depthWrite={false} />
        </mesh>
      ))}
      <mesh ref={spread}>
        <circleGeometry args={[0.012, 32]} />
        <meshBasicMaterial color={color} transparent opacity={0.15} depthWrite={false} />
      </mesh>
    </group>
  );
}

export const DART_LENGTH = DART_LEN;
