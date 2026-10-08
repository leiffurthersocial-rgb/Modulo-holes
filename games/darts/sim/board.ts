/**
 * Regulation dartboard geometry and scoring (all distances in metres, board space:
 * origin at the bull, +x right, +y up). Pure functions — used by the game, AI and tests.
 */

/** Ring radii (WDF/BDO regulation, measured to the inside of the wire). */
export const RING = {
  innerBull: 0.00635,
  outerBull: 0.0159,
  trebleIn: 0.099,
  trebleOut: 0.107,
  doubleIn: 0.162,
  doubleOut: 0.17,
  /** Edge of the playable surface / number ring. */
  board: 0.2255,
} as const;

/** Sector numbers clockwise from the top. */
export const SECTORS = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5] as const;

export const WIRE = 0.0006; // half-thickness of a wire (for bounce-outs)

export type Multiplier = 0 | 1 | 2 | 3;

export interface Hit {
  /** 1–20, 25 for bull (either ring), 0 for a miss. */
  number: number;
  multiplier: Multiplier;
  points: number;
  /** "T20", "D16", "BULL", "25", "MISS"… */
  label: string;
  /** Distance to the nearest wire (m) — small values can bounce out. */
  wireDist: number;
  onBoard: boolean;
}

/** Angle (degrees, clockwise from top) of a sector's centre. */
export function sectorAngle(n: number) {
  const i = SECTORS.indexOf(n as (typeof SECTORS)[number]);
  return i * 18;
}

export function score(x: number, y: number): Hit {
  const r = Math.hypot(x, y);
  // Angle clockwise from +y.
  let a = (Math.atan2(x, y) * 180) / Math.PI;
  if (a < 0) a += 360;
  const idx = Math.floor(((a + 9) % 360) / 18);
  const n = SECTORS[idx];
  // Distance to nearest radial wire (arc length) and ring wire.
  const local = ((a + 9) % 18) - 9; // −9..9 from sector centre… wires at ±9
  const radialWire = r * (Math.abs(Math.abs(local) - 9) * Math.PI) / 180;
  const rings = [RING.innerBull, RING.outerBull, RING.trebleIn, RING.trebleOut, RING.doubleIn, RING.doubleOut];
  const ringWire = Math.min(...rings.map((q) => Math.abs(r - q)));
  const wireDist = r < RING.outerBull ? ringWire : Math.min(ringWire, radialWire);

  if (r <= RING.innerBull) return { number: 25, multiplier: 2, points: 50, label: "BULL", wireDist, onBoard: true };
  if (r <= RING.outerBull) return { number: 25, multiplier: 1, points: 25, label: "25", wireDist, onBoard: true };
  if (r > RING.doubleOut) return { number: 0, multiplier: 0, points: 0, label: "MISS", wireDist: r > RING.doubleOut + 0.003 ? 1 : wireDist, onBoard: r <= RING.board };
  let m: Multiplier = 1;
  if (r >= RING.trebleIn && r <= RING.trebleOut) m = 3;
  else if (r >= RING.doubleIn) m = 2;
  return { number: n, multiplier: m, points: n * m, label: (m === 3 ? "T" : m === 2 ? "D" : "") + n, wireDist, onBoard: true };
}

/** Board-space centre of a named target ("T20", "D16", "S5" big single, "s5" small single, "BULL", "25"). */
export function targetPoint(label: string): [number, number] {
  if (label === "BULL") return [0, 0];
  if (label === "25") return [0, (RING.innerBull + RING.outerBull) / 2];
  const kind = label[0];
  const n = parseInt(label.replace(/^[TDSs]/, ""), 10);
  const ang = (sectorAngle(n) * Math.PI) / 180;
  const r =
    kind === "T" ? (RING.trebleIn + RING.trebleOut) / 2
    : kind === "D" ? (RING.doubleIn + RING.doubleOut) / 2
    : kind === "s" ? (RING.outerBull + RING.trebleIn) / 2
    : (RING.trebleOut + RING.doubleIn) / 2;
  return [Math.sin(ang) * r, Math.cos(ang) * r];
}

/** All distinct throw outcomes (for checkout search). */
export const THROWS: { label: string; points: number; double: boolean }[] = [
  ...Array.from({ length: 20 }, (_, i) => ({ label: `S${i + 1}`, points: i + 1, double: false })),
  ...Array.from({ length: 20 }, (_, i) => ({ label: `D${i + 1}`, points: 2 * (i + 1), double: true })),
  ...Array.from({ length: 20 }, (_, i) => ({ label: `T${i + 1}`, points: 3 * (i + 1), double: false })),
  { label: "25", points: 25, double: false },
  { label: "BULL", points: 50, double: true },
];
