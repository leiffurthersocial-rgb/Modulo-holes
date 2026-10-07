/** Golf scoring helpers: stars, names for scores relative to par. */

export function starsFor(strokes: number, par: number, pickedUp = false) {
  if (pickedUp) return 0;
  if (strokes <= Math.max(1, par - 1)) return 3;
  if (strokes <= par) return 2;
  return 1;
}

export interface ScoreName {
  label: string;
  tone: "legend" | "great" | "good" | "ok" | "meh";
}

export function scoreName(strokes: number, par: number): ScoreName {
  if (strokes === 1) return { label: "HOLE IN ONE!", tone: "legend" };
  const d = strokes - par;
  if (d <= -3) return { label: "ALBATROSS!", tone: "legend" };
  if (d === -2) return { label: "EAGLE!", tone: "great" };
  if (d === -1) return { label: "BIRDIE!", tone: "great" };
  if (d === 0) return { label: "PAR", tone: "good" };
  if (d === 1) return { label: "BOGEY", tone: "ok" };
  if (d === 2) return { label: "DOUBLE BOGEY", tone: "meh" };
  return { label: `+${d}`, tone: "meh" };
}

export function formatToPar(n: number) {
  if (n === 0) return "E";
  return n > 0 ? `+${n}` : `${n}`;
}
