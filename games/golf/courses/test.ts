import type { HoleDef } from "./types";
import { floor, rect } from "./dsl";

export const TEST_HOLE: HoleDef = {
  id: "test",
  name: "Test",
  par: 2,
  tee: [0, 0, 5],
  cup: [0, 0, -6],
  pieces: [floor(rect(-1.5, -8, 1.5, 6.5), { tone: "fairway" })],
};
