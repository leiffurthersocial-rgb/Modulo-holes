/** Darts challenges: three darts, one goal. Stars by attempts (first try = 3★). */
import type { Hit } from "./board";

export interface Challenge {
  id: string;
  name: string;
  hint: string;
  /** Recommended aim for the solver/tests. */
  plan: string[];
  check: (hits: Hit[]) => boolean;
  /** Optional x01 start (shown as "Checkout 40"). */
  start?: number;
}

const total = (h: Hit[]) => h.reduce((a, x) => a + x.points, 0);

/** Valid double-out checkout of `start` using these darts (stops counting once finished). */
function checksOut(start: number, hits: Hit[]) {
  let left = start;
  for (const h of hits) {
    const next = left - h.points;
    if (next < 0 || next === 1 || (next === 0 && h.multiplier !== 2)) return false;
    left = next;
    if (left === 0) return true;
  }
  return false;
}

export const CHALLENGES: Challenge[] = [
  { id: "c1", name: "Bullseye!", hint: "Hit the bull (25 or 50) with any of three darts.", plan: ["BULL", "BULL", "BULL"], check: (h) => h.some((x) => x.number === 25) },
  { id: "c2", name: "Top of the Shop", hint: "Hit treble 20.", plan: ["T20", "T20", "T20"], check: (h) => h.some((x) => x.label === "T20") },
  { id: "c3", name: "Ton Up", hint: "Score 100 or more with three darts.", plan: ["T20", "T20", "T20"], check: (h) => total(h) >= 100 },
  { id: "c4", name: "Tops", hint: "Check out 40 on double 20.", start: 40, plan: ["D20", "D20", "D20"], check: (h) => checksOut(40, h) },
  { id: "c5", name: "Shanghai", hint: "Single, double and treble 20 — in one turn.", plan: ["S20", "D20", "T20"], check: (h) => [1, 2, 3].every((m) => h.some((x) => x.number === 20 && x.multiplier === m)) },
  { id: "c6", name: "Madhouse", hint: "Check out 2 on double 1. Good luck.", start: 2, plan: ["D1", "D1", "D1"], check: (h) => checksOut(2, h) },
  { id: "c7", name: "Ton-Forty", hint: "Score 140+ with three darts.", plan: ["T20", "T20", "T20"], check: (h) => total(h) >= 140 },
  { id: "c8", name: "Double Bull", hint: "Two inner bulls in one turn.", plan: ["BULL", "BULL", "BULL"], check: (h) => h.filter((x) => x.label === "BULL").length >= 2 },
  { id: "c9", name: "The Big Fish", hint: "Check out 170: T20, T20, Bull.", start: 170, plan: ["T20", "T20", "BULL"], check: (h) => checksOut(170, h) },
  { id: "c10", name: "Maximum", hint: "The perfect turn: 180.", plan: ["T20", "T20", "T20"], check: (h) => total(h) === 180 },
];

export function challengeStars(attempts: number) {
  return attempts <= 1 ? 3 : attempts <= 4 ? 2 : 1;
}
