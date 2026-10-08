/**
 * Darts verification: board scoring geometry, checkout table, challenge plans (perfect aim),
 * flick model sanity, and AI self-play statistics per level.
 */
import { score, targetPoint, RING } from "@/games/darts/sim/board";
import { checkout } from "@/games/darts/sim/checkout";
import { Match } from "@/games/darts/sim/rules";
import { chooseTarget, aiThrow, type AiLevel } from "@/games/darts/sim/ai";
import { CHALLENGES } from "@/games/darts/sim/challenges";
import { resolveFlick } from "@/games/darts/sim/throw";
import { mulberry32 } from "@/engine/rng";

let fails = 0;
const expect = (name: string, cond: boolean, info = "") => {
  if (!cond) {
    fails++;
    console.log(`✗ ${name} ${info}`);
  }
};

// 1. Scoring geometry.
const cases: [string, string][] = [["T20", "T20"], ["D16", "D16"], ["S5", "5"], ["s11", "11"], ["T19", "T19"], ["D1", "D1"], ["BULL", "BULL"], ["25", "25"], ["T3", "T3"], ["D6", "D6"]];
for (const [t, want] of cases) {
  const [x, y] = targetPoint(t);
  expect(`score(${t})`, score(x, y).label === want, `got ${score(x, y).label}`);
}
expect("top is 20", score(0, 0.13).number === 20);
expect("right is 6", score(0.13, 0).number === 6);
expect("bottom is 3", score(0, -0.13).number === 3);
expect("left is 11", score(-0.13, 0).number === 11);
expect("miss outside", score(0, RING.doubleOut + 0.01).label === "MISS");
console.log("✓ scoring geometry");

// 2. Checkout table: every finish 2..170 except the bogeys has a ≤3-dart route.
const bogeys = [169, 168, 166, 165, 163, 162, 159];
for (let r = 2; r <= 170; r++) {
  const c = checkout(r, 3, true);
  if (bogeys.includes(r)) expect(`bogey ${r}`, c === null);
  else {
    expect(`checkout ${r}`, !!c, "no route");
    if (c) {
      const pts = c.reduce((a, l) => { const [x, y] = targetPoint(l); return a + score(x, y).points; }, 0);
      expect(`checkout ${r} sums`, pts === r, c.join(" "));
    }
  }
}
console.log(`✓ checkout table (e.g. 170 = ${checkout(170, 3)?.join(" ")}, 121 = ${checkout(121, 3)?.join(" ")}, 40 = ${checkout(40, 3)?.join(" ")})`);

// 3. Challenges succeed with perfect aim.
for (const c of CHALLENGES) {
  const hits = c.plan.map((l) => { const [x, y] = targetPoint(l); return score(x, y); });
  expect(`challenge ${c.id}`, c.check(hits), c.name);
}
console.log(`✓ ${CHALLENGES.length} challenges achievable`);

// 4. Flick model.
expect("tiny flick cancels", resolveFlick(0, 0, 0, 0.2) === null);
const perfect = resolveFlick(0, 0, 0, 2.5, () => 0.5)!;
expect("perfect flick near aim", Math.hypot(perfect.x, perfect.y) < 0.006, `${perfect.x},${perfect.y}`);
expect("soft flick lands low", resolveFlick(0, 0, 0, 0.8, () => 0.5)!.y < -0.04);
expect("hard flick lands high", resolveFlick(0, 0, 0, 6, () => 0.5)!.y > 0.05);
expect("sideways flick pulls right", resolveFlick(0, 0, 0.5, 2.5, () => 0.5)!.x > 0.015);
console.log("✓ flick model");

// 5. AI self-play: 501 double-out legs, darts per leg & average per level.
for (const level of ["easy", "medium", "hard"] as AiLevel[]) {
  const rand = mulberry32(42);
  let darts = 0, legs = 0, oneEighties = 0, avgSum = 0;
  for (let g = 0; g < 40; g++) {
    const m = new Match({ mode: "x01", start: 501, doubleOut: true, legsToWin: 1, players: 1 });
    let guard = 0;
    while (m.winner === null && guard++ < 400) {
      const [x, y] = aiThrow(chooseTarget(m), level, rand);
      const o = m.register(score(x, y));
      if (o.turnOver) m.nextTurn();
    }
    expect(`${level} finishes`, m.winner === 0);
    darts += m.stats[0].darts;
    oneEighties += m.stats[0].oneEighties;
    avgSum += m.average(0);
    legs++;
  }
  console.log(`✓ ${level.padEnd(6)} 501: ${(darts / legs).toFixed(1)} darts/leg · 3-dart avg ${(avgSum / legs).toFixed(1)} · ${oneEighties} × 180 in ${legs} legs`);
}
// Cricket AI finishes.
{
  const rand = mulberry32(7);
  const m = new Match({ mode: "cricket", start: 0, doubleOut: false, legsToWin: 1, players: 2 });
  let guard = 0;
  while (m.winner === null && guard++ < 600) {
    const [x, y] = aiThrow(chooseTarget(m), m.turn === 0 ? "hard" : "medium", rand);
    const o = m.register(score(x, y));
    if (o.turnOver) m.nextTurn();
  }
  expect("cricket finishes", m.winner !== null);
  console.log(`✓ cricket hard vs medium → winner P${m.winner} in ${m.totalDarts} darts, points ${m.points.join("–")}`);
}

if (fails) {
  console.log(`\n${fails} check(s) failed`);
  process.exitCode = 1;
} else console.log("\nAll darts checks passed.");
