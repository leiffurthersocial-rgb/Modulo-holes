/**
 * Headless course verifier: builds every hole with the real Rapier simulation and runs a
 * beam search over shots to prove each hole can be completed, reporting the best stroke
 * count found vs par. Run with `npm run verify:courses` (optionally pass hole ids).
 */
import * as THREE from "three";
import { loadRapier } from "@/engine/physics/rapier";
import { GolfSim, type SimSnapshot } from "@/games/golf/sim/GolfSim";
import { WORLDS } from "@/games/golf/courses";
import type { HoleDef, CourseTheme } from "@/games/golf/courses/types";
import type { BuiltHole } from "@/games/golf/sim/build";

const H = 1 / 120;

/** Geodesic distance field over walkable triangles (grid flood fill from the cup). */
function distanceField(b: BuiltHole) {
  const cell = 0.4;
  const cells = new Map<string, { y: number }>();
  const P = b.physicsMesh.positions, I = b.physicsMesh.indices;
  const A = new THREE.Vector3(), B = new THREE.Vector3(), C = new THREE.Vector3(), n = new THREE.Vector3();
  for (let t = 0; t < I.length; t += 3) {
    A.fromArray(P, I[t] * 3);
    B.fromArray(P, I[t + 1] * 3);
    C.fromArray(P, I[t + 2] * 3);
    n.subVectors(B, A).cross(new THREE.Vector3().subVectors(C, A)).normalize();
    if (Math.abs(n.y) < 0.4) continue;
    // Rasterise the triangle by sampling barycentric points.
    const steps = Math.ceil(Math.max(A.distanceTo(B), B.distanceTo(C), C.distanceTo(A)) / (cell * 0.5)) + 1;
    for (let i = 0; i <= steps; i++)
      for (let j = 0; j <= steps - i; j++) {
        const u = i / steps, v = j / steps, w = 1 - u - v;
        const x = A.x * u + B.x * v + C.x * w, y = A.y * u + B.y * v + C.y * w, z = A.z * u + B.z * v + C.z * w;
        const k = `${Math.round(x / cell)},${Math.round(z / cell)}`;
        const prev = cells.get(k);
        if (!prev || y > prev.y) cells.set(k, { y });
      }
  }
  for (const k of b.kinematics) {
    if (k.kind !== "mover" && k.kind !== "tilt") continue;
    const p = new THREE.Vector3(), q = new THREE.Quaternion();
    for (let t = 0; t < 10; t += 0.25) {
      k.pose(t, p, q);
      const s = k.size!;
      for (let x = -s[0] / 2; x <= s[0] / 2; x += cell) for (let z = -s[2] / 2; z <= s[2] / 2; z += cell) cells.set(`${Math.round((p.x + x) / cell)},${Math.round((p.z + z) / cell)}`, { y: p.y });
    }
  }
  const dist = new Map<string, number>();
  const [cx, , cz] = b.def.cup;
  const start = `${Math.round(cx / cell)},${Math.round(cz / cell)}`;
  dist.set(start, 0);
  const queue: string[] = [start];
  const tp = b.teleporters.map((t) => ({ a: `${Math.round(t.a[0] / cell)},${Math.round(t.a[2] / cell)}`, b: `${Math.round(t.b[0] / cell)},${Math.round(t.b[2] / cell)}` }));
  while (queue.length) {
    const k = queue.shift()!;
    const d = dist.get(k)!;
    const [x, z] = k.split(",").map(Number);
    const here = cells.get(k);
    const nbrs: [string, number][] = [];
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) nbrs.push([`${x + dx},${z + dz}`, cell]);
    for (const t of tp) if (t.b === k || Math.abs(+t.b.split(",")[0] - x) + Math.abs(+t.b.split(",")[1] - z) <= 2) nbrs.push([t.a, 0.5]);
    for (const [nk, c] of nbrs) {
      const nc = cells.get(nk);
      if (!nc || dist.has(nk)) continue;
      if (here && Math.abs(nc.y - here.y) > 1.2 && c > 0.5) continue;
      dist.set(nk, d + c);
      queue.push(nk);
    }
  }
  return (p: THREE.Vector3) => {
    let best = Infinity;
    const kx = Math.round(p.x / cell), kz = Math.round(p.z / cell);
    for (let r = 0; r <= 3 && best === Infinity; r++)
      for (let dx = -r; dx <= r; dx++)
        for (let dz = -r; dz <= r; dz++) {
          const d = dist.get(`${kx + dx},${kz + dz}`);
          if (d !== undefined) best = Math.min(best, d + Math.hypot(dx, dz) * cell);
        }
    return best === Infinity ? 1000 + Math.hypot(p.x - cx, p.z - cz) : best;
  };
}

interface Node {
  snap: SimSnapshot;
  h: number;
  path: string[];
  coins: number;
}

function simulateShot(sim: GolfSim, angle: number, power: number) {
  sim.shoot(Math.sin(angle), -Math.cos(angle), power);
  let t = 0;
  while ((sim.phase === "moving" || sim.phase === "hazard") && t < 20) {
    sim.step(H);
    t += H;
  }
  sim.drainEvents();
}

async function solve(R: Awaited<ReturnType<typeof loadRapier>>, hole: HoleDef, below: CourseTheme["below"]) {
  const sim = new GolfSim(R, hole, below);
  for (let i = 0; i < 40; i++) sim.step(H);
  sim.drainEvents();
  const field = distanceField(sim.built);
  const [cx, , cz] = hole.cup;
  let beam: Node[] = [{ snap: sim.snapshot(), h: field(sim.ballPos), path: [], coins: 0 }];
  const maxDepth = hole.par + 3;
  let holeInOne = false;
  let coinsMax = 0;
  for (let depth = 1; depth <= maxDepth; depth++) {
    const cands: Node[] = [];
    let solved: Node | null = null;
    for (const node of beam) {
      sim.restore(node.snap);
      const bx = sim.ballPos.x, bz = sim.ballPos.z;
      const direct = Math.atan2(cx - bx, -(cz - bz));
      const angles: number[] = [];
      for (let i = 0; i < 32; i++) angles.push((i / 32) * Math.PI * 2);
      for (let i = -6; i <= 6; i++) angles.push(direct + i * 0.025);
      for (const a of angles)
        for (const p of [0.12, 0.2, 0.28, 0.36, 0.45, 0.55, 0.65, 0.78, 0.9, 1]) {
          sim.restore(node.snap);
          simulateShot(sim, a, p);
          const coins = sim.collected.size;
          coinsMax = Math.max(coinsMax, coins);
          const label = `${((a * 180) / Math.PI).toFixed(0)}°@${p}`;
          if (sim.phase === "holed") {
            if (depth === 1) holeInOne = true;
            if (!solved || sim.strokes < solved.path.length) solved = { snap: node.snap, h: 0, path: [...node.path, label], coins };
            continue;
          }
          if (sim.phase !== "aim") continue;
          cands.push({ snap: sim.snapshot(), h: field(sim.ballPos) + sim.penalties * 2, path: [...node.path, label], coins });
        }
    }
    if (solved) {
      sim.dispose();
      return { strokes: depth, path: solved.path, holeInOne, coinsMax };
    }
    // Keep diverse best candidates.
    cands.sort((a, b) => a.h - b.h);
    const next: Node[] = [];
    for (const c of cands) {
      if (next.length >= 4) break;
      if (next.some((n) => Math.abs(n.h - c.h) < 0.4)) continue;
      next.push(c);
    }
    beam = next;
    if (!beam.length) break;
  }
  sim.dispose();
  return { strokes: Infinity, path: [], holeInOne, coinsMax };
}

async function main() {
  const R = await loadRapier();
  const only = process.argv.slice(2);
  let failures = 0;
  for (const w of WORLDS) {
    for (const hole of w.holes) {
      if (only.length && !only.includes(hole.id) && !only.includes(w.id)) continue;
      const t0 = Date.now();
      const r = await solve(R, hole, w.theme.below);
      const ok = r.strokes <= hole.par + 1;
      if (!ok) failures++;
      console.log(
        `${ok ? "✓" : "✗"} ${hole.id.padEnd(10)} ${hole.name.padEnd(22)} par ${hole.par}  best ${r.strokes === Infinity ? "—" : r.strokes}  ${r.holeInOne ? "HIO " : "    "}coins ${r.coinsMax}/${hole.coins?.length ?? 0}  ${((Date.now() - t0) / 1000).toFixed(1)}s  ${r.path.join(" → ")}`,
      );
    }
  }
  if (failures) {
    console.log(`\n${failures} hole(s) not solved within par+1`);
    process.exitCode = 1;
  }
}

main();
