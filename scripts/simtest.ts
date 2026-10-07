import { loadRapier } from "@/engine/physics/rapier";
import { GolfSim } from "@/games/golf/sim/GolfSim";
import { WORLDS } from "@/games/golf/courses";

async function main() {
  const R = await loadRapier();
  const find = (id: string) => { for (const w of WORLDS) for (const h of w.holes) if (h.id === id) return { h, w }; throw new Error(id); };
  const run = (id: string, angleDeg: number, power: number, wait = 0) => {
    const { h, w } = find(id);
    const sim = new GolfSim(R, h, w.theme.below);
    for (let i = 0; i < 30 + wait; i++) sim.step();
    sim.drainEvents();
    const a = (angleDeg * Math.PI) / 180;
    sim.shoot(Math.sin(a), -Math.cos(a), power);
    let minZ = 99;
    let t = 0;
    const evs = new Set<string>();
    while (sim.phase === "moving" && t < 15) { sim.step(); t += 1 / 120; minZ = Math.min(minZ, sim.ballPos.z); for (const e of sim.drainEvents()) evs.add(e.type + ("surface" in e ? ":" + e.surface : "")); }
    console.log(`${id} ${angleDeg}°@${power} wait=${wait} → ${sim.phase} pos=${sim.ballPos.toArray().map((x) => x.toFixed(1))} minZ=${minZ.toFixed(1)} ev=${[...evs].join(",")}`);
    sim.dispose();
  };
  run("neon-8", 0, 0.6);
  run("neon-8", 0, 0.9);
  for (const wt of [0, 40, 80, 120]) run("meadow-5", 0, 0.5, wt);
  run("neon-1", 0, 0.5);
  run("candy-1", 0, 0.4);
  run("neon-6", 0, 0.5, 0);
  run("neon-6", 0, 0.5, 400);
}
main();
