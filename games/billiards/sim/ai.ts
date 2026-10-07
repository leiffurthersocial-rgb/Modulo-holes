/**
 * Billiards AI.
 *  1. Enumerate pot candidates (legal ball × pocket) with ghost-ball geometry and clear-path
 *     checks, scored by cut angle and distance.
 *  2. Simulate the best few with several speeds/spins using the real physics and the real rules,
 *     rewarding pots, wins and good cue-ball position for the next shot.
 *  3. If nothing pots, play a safety that avoids a foul.
 * Difficulty controls look-ahead breadth and the execution noise added afterwards.
 * Implemented as a generator so the search can be spread across animation frames.
 */
import { TUNING } from "@/config/tuning";
import { R, L, W, POCKETS, HEAD_STRING_X, cloneBalls, simulateShot, validPlacement, type Ball, type ShotParams } from "./physics";
import { judge, legalTargets, type RulesState } from "./rules";

export type AiLevel = "easy" | "medium" | "hard";

export interface AiPlan {
  shot: ShotParams;
  place?: { x: number; z: number };
  kind: "break" | "pot" | "safety";
}

interface Candidate {
  target: number;
  pocket: number;
  dx: number;
  dz: number;
  score: number;
  dist: number;
}

function segPointDist(ax: number, az: number, bx: number, bz: number, px: number, pz: number) {
  const ex = bx - ax, ez = bz - az;
  const l2 = ex * ex + ez * ez || 1e-9;
  const t = Math.max(0, Math.min(1, ((px - ax) * ex + (pz - az) * ez) / l2));
  return Math.hypot(ax + ex * t - px, az + ez * t - pz);
}

function pathClear(balls: Ball[], ax: number, az: number, bx: number, bz: number, ignore: number[]) {
  return balls.every((b) => !b.onTable || ignore.includes(b.id) || segPointDist(ax, az, bx, bz, b.x, b.z) > 2 * R - 0.002);
}

/** Analytic pot candidates from the cue ball's current spot. */
export function potCandidates(balls: Ball[], targets: number[], cueX = balls[0].x, cueZ = balls[0].z): Candidate[] {
  const out: Candidate[] = [];
  for (const id of targets) {
    const t = balls.find((b) => b.id === id && b.onTable);
    if (!t) continue;
    POCKETS.forEach((p, pi) => {
      const px = p.ax - t.x, pz = p.az - t.z;
      const pd = Math.hypot(px, pz);
      const ux = px / pd, uz = pz / pd;
      // Pocket acceptance: side pockets need a fairly square approach.
      if (p.side && Math.abs(uz) < 0.55) return;
      if (!p.side && ux * Math.sign(p.x) + uz * Math.sign(p.z) < 0.55 * Math.SQRT2) return;
      const gx = t.x - ux * 2 * R, gz = t.z - uz * 2 * R;
      const cx = gx - cueX, cz = gz - cueZ;
      const cd = Math.hypot(cx, cz);
      if (cd < 1e-4) return;
      const cut = Math.acos(Math.max(-1, Math.min(1, (cx * ux + cz * uz) / cd)));
      if (cut > (78 * Math.PI) / 180) return;
      if (!pathClear(balls, cueX, cueZ, gx, gz, [0, id])) return;
      if (!pathClear(balls, t.x, t.z, p.ax, p.az, [0, id])) return;
      // Ghost ball must itself be on the cloth.
      if (Math.abs(gx) > L / 2 - R * 0.9 || Math.abs(gz) > W / 2 - R * 0.9) return;
      const score = cut * cut * 3 + cd * 0.6 + pd * 0.9 + (p.side ? 0.15 : 0);
      out.push({ target: id, pocket: pi, dx: cx / cd, dz: cz / cd, score, dist: cd + pd });
    });
  }
  return out.sort((a, b) => a.score - b.score);
}

function gauss(rand: () => number) {
  return Math.sqrt(-2 * Math.log(rand() + 1e-9)) * Math.cos(2 * Math.PI * rand());
}

/** Choose a ball-in-hand spot that sets up an easy, straight pot. */
function choosePlacement(balls: Ball[], state: RulesState): { x: number; z: number } {
  const targets = legalTargets(state);
  let best: { x: number; z: number; s: number } | null = null;
  const tryPos = (x: number, z: number) => {
    if (!validPlacement(balls, x, z, state.kitchen)) return;
    const c = potCandidates(balls, targets, x, z)[0];
    const s = c ? c.score : 99;
    if (!best || s < best.s) best = { x, z, s };
  };
  for (const id of targets) {
    const t = balls.find((b) => b.id === id && b.onTable);
    if (!t) continue;
    for (const p of POCKETS) {
      const px = p.ax - t.x, pz = p.az - t.z;
      const pd = Math.hypot(px, pz);
      for (const back of [0.18, 0.3, 0.45]) tryPos(t.x - (px / pd) * (2 * R + back), t.z - (pz / pd) * (2 * R + back));
    }
  }
  if (!best) {
    for (let i = 0; i < 60 && !best; i++) {
      const x = state.kitchen ? -L / 2 + 0.1 + Math.random() * (HEAD_STRING_X + L / 2 - 0.15) : (Math.random() - 0.5) * (L - 0.2);
      tryPos(x, (Math.random() - 0.5) * (W - 0.2));
    }
  }
  return best ?? { x: HEAD_STRING_X - 0.12, z: 0 };
}

/** Value of a simulated outcome for the shooter. */
function evaluate(before: RulesState, balls: Ball[], shot: ShotParams, level: AiLevel): number {
  const sim = cloneBalls(balls);
  const res = simulateShot(sim, shot);
  const v = judge(before, res);
  if (v.gameOver) return v.state.winner === before.turn ? 1000 : -1000;
  if (v.foul) return -60 - (v.state.ballInHand ? 20 : 0);
  let value = 0;
  if (v.continues) {
    value += 40 + v.scored.length * 8;
    // Position play: how easy is the next shot from where the cue ball stopped?
    if (level !== "easy") {
      const next = potCandidates(sim, legalTargets(v.state))[0];
      value += next ? Math.max(0, 20 - next.score * 6) : -10;
    }
  } else {
    // Missed: prefer leaving the opponent nothing easy.
    const opp = potCandidates(sim, legalTargets(v.state))[0];
    value += opp ? -Math.max(0, 15 - opp.score * 5) : 8;
  }
  return value;
}

export function* planShot(balls: Ball[], state: RulesState, level: AiLevel, rand: () => number = Math.random): Generator<number, AiPlan> {
  const cfg = TUNING.billiards.ai[level];
  let place: { x: number; z: number } | undefined;
  let work = balls;
  if (state.ballInHand) {
    place = choosePlacement(balls, state);
    work = cloneBalls(balls);
    work[0].x = place.x;
    work[0].z = place.z;
    work[0].onTable = true;
    yield 0.1;
  }
  const cue = work[0];

  // Break: smash the head ball.
  if (state.breakShot) {
    const head = work.filter((b) => b.id !== 0 && b.onTable).sort((a, b) => a.x - b.x)[0];
    const dx = head.x - cue.x, dz = head.z - cue.z + (rand() - 0.5) * 0.01;
    return finalize({ dx, dz, power: 1, spinX: 0, spinY: -0.1, isBreak: true }, "break", place, cfg, rand);
  }

  const targets = legalTargets(state);
  const cands = potCandidates(work, targets).slice(0, cfg.lookAhead);
  let best: { shot: ShotParams; value: number } | null = null;
  const spins = level === "easy" ? [0] : level === "medium" ? [0, 0.4, -0.4] : [0, 0.45, -0.5, 0.2];
  for (let i = 0; i < cands.length; i++) {
    const c = cands[i];
    const base = Math.min(1, 0.22 + c.dist * 0.18);
    for (const pw of [base, Math.min(1, base * 1.35), base * 0.8]) {
      for (const sy of spins) {
        const shot: ShotParams = { dx: c.dx, dz: c.dz, power: pw, spinX: 0, spinY: sy };
        const value = evaluate(state, work, shot, level) - c.score * 2;
        if (!best || value > best.value) best = { shot, value };
      }
    }
    yield 0.1 + (0.8 * (i + 1)) / Math.max(1, cands.length);
  }
  if (best && best.value > 20) return finalize(best.shot, "pot", place, cfg, rand);

  // Safety: roll softly onto a legal ball, avoid fouls, hide the cue ball.
  let safe: { shot: ShotParams; value: number } | null = best;
  for (const id of targets) {
    const t = work.find((b) => b.id === id && b.onTable);
    if (!t) continue;
    for (const off of [-0.7, -0.35, 0, 0.35, 0.7]) {
      const dx = t.x - cue.x, dz = t.z - cue.z;
      const d = Math.hypot(dx, dz);
      const nx = -dz / d, nz = dx / d;
      const ax = t.x + nx * off * R * 1.8 - cue.x, az = t.z + nz * off * R * 1.8 - cue.z;
      for (const pw of [0.25, 0.4]) {
        const shot: ShotParams = { dx: ax, dz: az, power: pw, spinX: 0, spinY: 0 };
        const value = evaluate(state, work, shot, level);
        if (!safe || value > safe.value) safe = { shot, value };
      }
    }
    yield 0.95;
  }
  if (safe) return finalize(safe.shot, safe.value > 20 ? "pot" : "safety", place, cfg, rand);
  // Nothing sensible: hit something.
  const anyBall = work.find((b) => b.id !== 0 && b.onTable)!;
  return finalize({ dx: anyBall.x - cue.x, dz: anyBall.z - cue.z, power: 0.5, spinX: 0, spinY: 0 }, "safety", place, cfg, rand);
}

function finalize(shot: ShotParams, kind: AiPlan["kind"], place: AiPlan["place"], cfg: { aimNoiseDeg: number; powerNoise: number }, rand: () => number): AiPlan {
  // Human-like execution error.
  const a = (gauss(rand) * cfg.aimNoiseDeg * Math.PI) / 180;
  const c = Math.cos(a), s = Math.sin(a);
  const dx = shot.dx * c - shot.dz * s, dz = shot.dx * s + shot.dz * c;
  const power = Math.max(0.05, Math.min(1, shot.power * (1 + gauss(rand) * cfg.powerNoise)));
  return { shot: { ...shot, dx, dz, power }, kind, place };
}
