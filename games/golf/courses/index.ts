import type { HoleDef, WorldDef } from "./types";
import { MEADOW, NEON, CANDY } from "./themes";
import { MEADOW_HOLES } from "./meadow";
import { NEON_HOLES } from "./neon";
import { CANDY_HOLES } from "./candy";

export const WORLDS: WorldDef[] = [
  { id: "meadow", name: "Sunny Meadow", subtitle: "Where it all begins", emoji: "🌼", unlockStars: 0, theme: MEADOW, mood: "meadow", holes: MEADOW_HOLES },
  { id: "neon", name: "Neon Night", subtitle: "Glow, bounce, teleport", emoji: "🌃", unlockStars: 12, theme: NEON, mood: "neon", holes: NEON_HOLES },
  { id: "candy", name: "Candy Land", subtitle: "Sweet chaos", emoji: "🍭", unlockStars: 30, theme: CANDY, mood: "candy", holes: CANDY_HOLES },
];

export function getWorld(id: string) {
  return WORLDS.find((w) => w.id === id) ?? WORLDS[0];
}

export interface HoleRef {
  world: WorldDef;
  index: number;
  hole: HoleDef;
}

export function holeRef(worldId: string, index: number): HoleRef | null {
  const world = getWorld(worldId);
  const hole = world.holes[index];
  return hole ? { world, index, hole } : null;
}

export function allHoles(): HoleRef[] {
  return WORLDS.flatMap((world) => world.holes.map((hole, index) => ({ world, index, hole })));
}
