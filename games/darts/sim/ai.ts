/**
 * Darts AI: chooses a target like a real player (score on T20, follow checkout routes, close
 * cricket numbers / point when behind), then throws with level-dependent Gaussian scatter.
 */
import { TUNING } from "@/config/tuning";
import { targetPoint } from "./board";
import { checkout, setupTarget } from "./checkout";
import { CRICKET_NUMBERS, type Match } from "./rules";
import { aiScatter } from "./throw";

export type AiLevel = "easy" | "medium" | "hard";

export function chooseTarget(m: Match, p = m.turn): string {
  const dartsLeft = 3 - m.darts.length;
  switch (m.cfg.mode) {
    case "x01": {
      const r = m.remaining[p];
      const route = r <= 170 ? checkout(r, dartsLeft, m.cfg.doubleOut) : null;
      if (route) return route[0];
      return setupTarget(r, m.cfg.doubleOut);
    }
    case "cricket": {
      const opp = (p + 1) % m.cfg.players;
      const behind = m.points[p] <= m.points[opp];
      // Score on a number we've closed and they haven't, when behind.
      if (behind) {
        for (const n of CRICKET_NUMBERS) if (m.isClosed(p, n) && !m.isClosed(opp, n) && n !== 25) return `T${n}`;
      }
      for (const n of CRICKET_NUMBERS) if (!m.isClosed(p, n)) return n === 25 ? "BULL" : `T${n}`;
      return "BULL";
    }
    case "clock": {
      const t = m.clockTarget[p];
      return t === 21 ? "BULL" : `S${t}`;
    }
    default:
      return "T20";
  }
}

export function aiThrow(target: string, level: AiLevel, rand: () => number = Math.random): [number, number] {
  const [tx, ty] = targetPoint(target);
  return aiScatter(tx, ty, TUNING.darts.ai[level].sigma, rand);
}
