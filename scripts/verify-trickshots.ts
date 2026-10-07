/** Brute-force search proving every trick shot is achievable with the real billiards physics. */
import { simulateShot, cloneBalls } from "@/games/billiards/sim/physics";
import { TRICK_SHOTS, trickBalls, trickSuccess } from "@/games/billiards/sim/trickshots";

let fails = 0;
for (const t of TRICK_SHOTS) {
  const base = trickBalls(t);
  let found: string | null = null;
  const t0 = performance.now();
  for (let a = 0; a < 720 && !found; a++) {
    const ang = (a / 720) * Math.PI * 2;
    for (const power of [0.2, 0.32, 0.45, 0.6, 0.75, 0.9]) {
      for (const [sx, sy] of [[0, 0], [0, 0.6], [0, -0.8], [-0.6, 0], [0.6, 0]]) {
        const balls = cloneBalls(base);
        const res = simulateShot(balls, { dx: Math.cos(ang), dz: Math.sin(ang), power, spinX: sx, spinY: sy });
        if (trickSuccess(t, res, balls)) {
          found ??= `${(ang * 180 / Math.PI).toFixed(1)}° p${power} spin(${sx},${sy})`;
        }
      }
    }
  }
  if (!found) fails++;
  console.log(`${found ? "✓" : "✗"} ${t.id.padEnd(4)} ${t.name.padEnd(18)} ${found ?? "no solution"}  (${((performance.now() - t0) / 1000).toFixed(1)}s)`);
}
if (fails) process.exitCode = 1;
