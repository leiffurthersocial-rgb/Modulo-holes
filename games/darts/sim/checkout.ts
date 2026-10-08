/**
 * Checkout routes for x01 (double-out). Fewest darts first, then the classic preferences:
 * finish on D20/D16/D8/D10/D18/D12/BULL, set up with trebles of high numbers.
 */
import { THROWS } from "./board";

const DOUBLE_PREF = ["D20", "D16", "D8", "D10", "D18", "D12", "D4", "D6", "D14", "D2", "BULL", "D19", "D17", "D15", "D13", "D11", "D9", "D7", "D5", "D3", "D1"];
const cache = new Map<string, string[] | null>();

function doubleRank(l: string) {
  const i = DOUBLE_PREF.indexOf(l);
  return i === -1 ? 50 : i;
}
function setupRank(l: string) {
  // Prefer big trebles / singles that are easy to hit.
  if (l === "T20") return 0;
  if (l === "T19") return 1;
  if (l.startsWith("T")) return 2 + (20 - parseInt(l.slice(1), 10)) * 0.1;
  if (l.startsWith("S")) return 4 + (20 - parseInt(l.slice(1), 10)) * 0.05;
  if (l === "25") return 6;
  return 8;
}

/** Best route to finish `remaining` with at most `darts` darts (null if impossible). */
export function checkout(remaining: number, darts: number, doubleOut = true): string[] | null {
  const key = `${remaining}:${darts}:${doubleOut}`;
  if (cache.has(key)) return cache.get(key)!;
  let best: string[] | null = null;
  let bestScore = Infinity;
  const finishes = THROWS.filter((t) => !doubleOut || t.double);
  for (let n = 1; n <= darts && !best; n++) {
    const rec = (left: number, path: string[]) => {
      if (path.length === n - 1) {
        for (const f of finishes) {
          if (f.points !== left) continue;
          // Throw the setup darts biggest-first (T20 before T7), double last.
          const full = [...[...path].sort((x, y) => setupRank(x) - setupRank(y)), f.label];
          const s = doubleRank(f.label) * 10 + full.slice(0, -1).reduce((a, l) => a + setupRank(l), 0);
          if (s < bestScore) {
            bestScore = s;
            best = full;
          }
        }
        return;
      }
      for (const t of THROWS) if (left - t.points >= 2) rec(left - t.points, [...path, t.label]);
    };
    rec(remaining, []);
  }
  cache.set(key, best);
  return best;
}

/** What to aim at when no checkout is possible: score, but avoid leaving 1 / odd awkward numbers. */
export function setupTarget(remaining: number, doubleOut = true): string {
  if (remaining > 100 || !doubleOut) return "T20";
  // Leave a nice double (40, 32, 16…) with a single if we can.
  for (const leave of [40, 32, 16, 36, 24, 20, 8, 12, 4]) {
    const need = remaining - leave;
    if (need >= 1 && need <= 20) return `S${need}`;
  }
  return remaining > 60 ? "T20" : remaining % 2 === 1 ? "S1" : `S${Math.min(20, Math.max(1, remaining - 32))}`;
}
