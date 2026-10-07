import { simulateShot, respot } from "@/games/billiards/sim/physics";
import { rack8, rack9 } from "@/games/billiards/sim/racks";
import { initialState, judge } from "@/games/billiards/sim/rules";
import { planShot, type AiLevel } from "@/games/billiards/sim/ai";
import { mulberry32 } from "@/engine/rng";

function play(rules: "8ball" | "9ball", levels: [AiLevel, AiLevel], seed: number) {
  const rand = mulberry32(seed);
  const balls = rules === "8ball" ? rack8(rand) : rack9(rand);
  let state = initialState(rules, balls.filter((b) => b.id).map((b) => b.id));
  let shots = 0, fouls = 0, planMs = 0;
  while (state.winner === null && shots < 200) {
    const gen = planShot(balls, state, levels[state.turn], rand);
    const t0 = performance.now();
    let r = gen.next();
    while (!r.done) r = gen.next();
    planMs = Math.max(planMs, performance.now() - t0);
    const plan = r.value;
    if (plan.place) { balls[0].x = plan.place.x; balls[0].z = plan.place.z; balls[0].onTable = true; balls[0].pocket = -1; }
    const res = simulateShot(balls, plan.shot);
    const v = judge(state, res);
    if (v.foul) fouls++;
    for (const id of v.respot) respot(balls, balls.find((b) => b.id === id)!);
    if (!balls[0].onTable) { balls[0].onTable = true; balls[0].x = -0.6; balls[0].z = 0; }
    state = v.state;
    shots++;
  }
  console.log(`${rules} ${levels.join(" vs ")} seed${seed}: winner=P${state.winner} shots=${shots} fouls=${fouls} maxPlan=${planMs.toFixed(0)}ms groups=${state.groups}`);
}
for (const seed of [1, 2, 3]) play("8ball", ["hard", "easy"], seed);
for (const seed of [4, 5]) play("8ball", ["medium", "medium"], seed);
for (const seed of [6, 7]) play("9ball", ["hard", "medium"], seed);
