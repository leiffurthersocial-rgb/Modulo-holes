import { R, FOOT_SPOT, HEAD_STRING_X, makeBall, type Ball } from "./physics";

export const BALL_COLORS: Record<number, string> = {
  0: "#f8f6ee",
  1: "#f6c90e",
  2: "#1f4fd8",
  3: "#e0262f",
  4: "#6a2fa0",
  5: "#ff7a00",
  6: "#108a4a",
  7: "#8a1c2b",
  8: "#141414",
};

export const ballColor = (id: number) => BALL_COLORS[id > 8 ? id - 8 : id];
export const isStripe = (id: number) => id >= 9;
export const isSolid = (id: number) => id >= 1 && id <= 7;

const GAP = 0.0012;
const DX = Math.sqrt(3) * R + GAP;
const DZ = R + GAP / 2;

function rackPositions(rows: number[]): [number, number][] {
  const out: [number, number][] = [];
  rows.forEach((n, r) => {
    for (let i = 0; i < n; i++) out.push([FOOT_SPOT[0] + r * DX, (i - (n - 1) / 2) * 2 * DZ]);
  });
  return out;
}

/** Tiny random jitter so no two breaks are identical (seeded by caller's rng). */
const jitter = (rand: () => number) => (rand() - 0.5) * 0.0006;

export function rack8(rand: () => number): Ball[] {
  const pos = rackPositions([1, 2, 3, 4, 5]);
  // Standard-ish: 1 at apex, 8 in the middle of row 3, a solid & stripe in the back corners.
  const order = [1, 9, 2, 10, 8, 3, 11, 4, 12, 5, 13, 6, 14, 7, 15];
  const rest = order.filter((n) => ![1, 8, 7, 15].includes(n)).sort(() => rand() - 0.5);
  const layout = [1, rest[0], rest[1], rest[2], 8, rest[3], rest[4], rest[5], rest[6], rest[7], 7, rest[8], rest[9], rest[10], 15];
  return [cueBall(), ...layout.map((id, i) => makeBall(id, pos[i][0] + jitter(rand), pos[i][1] + jitter(rand)))];
}

export function rack9(rand: () => number): Ball[] {
  const pos = rackPositions([1, 2, 3, 2, 1]);
  const m = [2, 3, 4, 5, 6, 7, 8].sort(() => rand() - 0.5);
  // 1 at the apex, 9 in the centre of the diamond (index 4), the rest random.
  const layout = [1, m[0], m[1], m[2], 9, m[3], m[4], m[5], m[6]];
  return [cueBall(), ...layout.map((id, i) => makeBall(id, pos[i][0] + jitter(rand), pos[i][1] + jitter(rand)))];
}

export function cueBall(): Ball {
  return makeBall(0, HEAD_STRING_X - 0.12, 0);
}
