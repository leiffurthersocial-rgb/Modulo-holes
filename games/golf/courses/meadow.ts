import type { HoleDef } from "./types";
import { floor, rect } from "./dsl";

/** World 1 — Sunny Meadow: gentle intro, teaches every mechanic one at a time. */
export const MEADOW_HOLES: HoleDef[] = [
  {
    id: "meadow-1",
    name: "First Putt",
    par: 2,
    tee: [0, 0, 5],
    cup: [0, 0, -6],
    tip: "Drag back from the ball, release to putt.",
    pieces: [
      floor(rect(-1.6, -8, 1.6, 6.6), { tone: "fairway" }),
      { kind: "decor", type: "tree", at: [-4, 0, -3] },
      { kind: "decor", type: "tree", at: [4.2, 0, 1], scale: 1.2 },
      { kind: "decor", type: "flower", at: [2.6, 0, -6] },
      { kind: "decor", type: "rock", at: [-3, 0, 4] },
    ],
    coins: [[1.1, 0.3, -1]],
  },
];
