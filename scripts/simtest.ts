import { loadRapier } from "@/engine/physics/rapier";
import { GolfSim } from "@/games/golf/sim/GolfSim";
import { TEST_HOLE } from "@/games/golf/courses/test";

async function main() {
  const R = await loadRapier();
  for (const power of [0.3, 0.35, 0.4, 0.45, 0.5, 0.6]) {
    const sim = new GolfSim(R, TEST_HOLE, { kind: "water", color: "#00f", y: -1.2 });
    for (let i = 0; i < 30; i++) sim.step();
    sim.shoot(0, -1, power);
    let t = 0;
    const evs: string[] = [];
    let maxY = 0;
    while (sim.phase === "moving" && t < 15) {
      sim.step();
      t += 1 / 120;
      maxY = Math.max(maxY, sim.ballPos.y);
      for (const e of sim.drainEvents()) if (e.type !== "shot") evs.push(e.type + ("surface" in e ? `:${e.surface}:${e.speed.toFixed(1)}@${e.pos.map((x) => x.toFixed(2))}` : ""));
    }
    console.log(`p=${power} v=${GolfSim.shotSpeed(power).toFixed(1)} t=${t.toFixed(2)} phase=${sim.phase} pos=${sim.ballPos.toArray().map((x) => x.toFixed(2))} maxY=${maxY.toFixed(3)} ev=${evs.slice(0, 8).join(" ")}`);
    sim.dispose();
  }
}
main();
