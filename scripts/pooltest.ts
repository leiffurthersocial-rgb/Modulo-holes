import { simulateShot, cloneBalls, stepBalls, strike, anyMoving, newResult, breakChaos } from "@/games/billiards/sim/physics";
import { rack8, rack9 } from "@/games/billiards/sim/racks";
import { mulberry32 } from "@/engine/rng";

const balls = rack8(mulberry32(1));
const apex = balls[1];
console.log("cue", balls[0].x, balls[0].z, "apex", apex.x, apex.z);
strike(balls[0], { dx: apex.x - balls[0].x, dz: apex.z - balls[0].z, power: 1, spinX: 0, spinY: 0, isBreak: true });
const res = newResult();
let t = 0;
for (; t < 20 && anyMoving(balls); t += 1 / 960) {
  breakChaos.active = t < 0.5;
  stepBalls(balls, 1 / 960, null, res);
  if (Math.abs(t - 0.5) < 0.0006) console.log("t=0.5 speeds", balls.map((b) => Math.hypot(b.vx, b.vz).toFixed(2)).join(" "));
}
console.log("rest at", t.toFixed(2), "potted", res.pocketed);
console.log(balls.map((b) => `${b.id}:${b.onTable ? b.x.toFixed(2) + "," + b.z.toFixed(2) : "P" + b.pocket}`).join(" "));

for (const spinY of [-1, -0.5, 0, 0.4, 1]) {
  const bs = rack9(mulberry32(1)).slice(0, 2);
  bs[0].x = -0.6; bs[0].z = 0; bs[1].x = -0.2; bs[1].z = 0;
  const b = cloneBalls(bs);
  simulateShot(b, { dx: 1, dz: 0, power: 0.3, spinX: 0, spinY });
  console.log(`spinY=${spinY}: cue ends x=${b[0].x.toFixed(3)} obj x=${b[1].x.toFixed(3)} onTable=${b[1].onTable}`);
}
