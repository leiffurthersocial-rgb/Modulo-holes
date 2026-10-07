/**
 * Trick-shot puzzles: a preset table plus a goal. Pocket indices:
 * 0 (−x,−z) 1 (−x,+z) 2 (+x,−z) 3 (+x,+z) corners · 4 side (−z) · 5 side (+z).
 * Every puzzle is verified solvable by scripts/verify-trickshots.ts.
 */
import { makeBall, type Ball, type SimResult } from "./physics";

export interface TrickGoal {
  /** All of these must be pocketed in the one shot. */
  pot: number[];
  /** Optional required pocket per ball. */
  pockets?: Record<number, number>;
  /** The cue ball must contact this ball first. */
  firstHit?: number;
  /** Cue ball must touch at least this many cushions before its first contact. */
  cushionsFirst?: number;
  /** These balls must hit a cushion before dropping (bank shots). */
  banked?: number[];
  /** Cue ball must finish inside this circle. */
  cueZone?: { x: number; z: number; r: number };
}

export interface TrickShot {
  id: string;
  name: string;
  hint: string;
  cue: [number, number];
  balls: [number, number, number][];
  goal: TrickGoal;
}

export const TRICK_SHOTS: TrickShot[] = [
  { id: "t1", name: "Warm-Up", hint: "Line it up and pot the 1.", cue: [-0.4, 0.1], balls: [[1, 0.55, -0.3]], goal: { pot: [1] } },
  { id: "t2", name: "Thin Cut", hint: "Shave the 2 into the top-right corner.", cue: [-0.2, 0.35], balls: [[2, 0.95, -0.47]], goal: { pot: [2], pockets: { 2: 2 } } },
  { id: "t3", name: "Side Door", hint: "Drop the 3 in the near side pocket.", cue: [-0.55, -0.15], balls: [[3, 0.06, 0.42]], goal: { pot: [3], pockets: { 3: 5 } } },
  { id: "t4", name: "Combination", hint: "Hit the 1 into the 9. Only the 9 has to fall.", cue: [-0.5, 0], balls: [[1, 0.35, -0.12], [9, 0.75, -0.33]], goal: { pot: [9], firstHit: 1 } },
  { id: "t5", name: "Draw Back", hint: "Pot the 6 and screw the cue ball back into the circle.", cue: [-0.1, 0], balls: [[6, 0.45, 0]], goal: { pot: [6], cueZone: { x: -0.55, z: 0, r: 0.16 } } },
  { id: "t6", name: "Bank Job", hint: "The 8 is blocked. Bank it off the rail into the side.", cue: [0.25, 0.3], balls: [[8, 0.0, -0.4], [4, 0.0, -0.14], [12, -0.3, -0.5], [13, 0.3, -0.5]], goal: { pot: [8], banked: [8], pockets: { 8: 5 } } },
  { id: "t7", name: "Double Down", hint: "Two balls, one stroke.", cue: [-0.6, 0.05], balls: [[5, -0.1, 0.05], [7, 0.5, -0.38]], goal: { pot: [5, 7] } },
  { id: "t8", name: "Around the Horn", hint: "Hit two cushions before you touch the 11 — then sink it.", cue: [-0.8, 0.35], balls: [[11, 0.85, 0.42], [14, 0.0, 0.2], [10, 0.0, -0.1]], goal: { pot: [11], cushionsFirst: 2 } },
  { id: "t9", name: "Kiss of Death", hint: "Frozen balls aim true. Pot the 15 off the 14.", cue: [-0.3, -0.3], balls: [[14, 0.9, 0.36], [15, 0.9 + 0.0577 * 0.707, 0.36 + 0.0577 * 0.707]], goal: { pot: [15], firstHit: 14 } },
  { id: "t10", name: "Cluster Buster", hint: "Break the cluster and pot any two.", cue: [-0.7, 0], balls: [[1, 0.6, 0], [2, 0.65, -0.03], [3, 0.65, 0.03], [4, 0.7, 0]], goal: { pot: [] } },
];

/** "Any N" goals are encoded as empty pot list + this count. */
export const CLUSTER_COUNT: Record<string, number> = { t10: 2 };

export function trickBalls(t: TrickShot): Ball[] {
  return [makeBall(0, t.cue[0], t.cue[1]), ...t.balls.map(([id, x, z]) => makeBall(id, x, z))];
}

export function trickSuccess(t: TrickShot, res: SimResult, balls: Ball[]): boolean {
  if (res.pocketed.includes(0)) return false;
  const g = t.goal;
  const need = CLUSTER_COUNT[t.id];
  if (need !== undefined) return res.pocketed.filter((b) => b !== 0).length >= need;
  if (!g.pot.every((id) => res.pocketed.includes(id))) return false;
  if (g.pockets) for (const [id, p] of Object.entries(g.pockets)) if (balls.find((b) => b.id === +id)?.pocket !== p) return false;
  if (g.firstHit !== undefined && res.firstHit !== g.firstHit) return false;
  if (g.cushionsFirst !== undefined && res.cushionsBeforeContact < g.cushionsFirst) return false;
  if (g.banked && !g.banked.every((id) => res.railBalls.has(id))) return false;
  if (g.cueZone) {
    const c = balls[0];
    if (Math.hypot(c.x - g.cueZone.x, c.z - g.cueZone.z) > g.cueZone.r) return false;
  }
  return true;
}

export function trickStars(attempts: number) {
  return attempts <= 1 ? 3 : attempts <= 3 ? 2 : 1;
}
