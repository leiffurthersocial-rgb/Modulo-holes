import type { GameModule } from "./types";
import { golf } from "./golf";
import { billiards } from "./billiards";

/**
 * All games in the hub, in display order.
 * Adding a game = create `/games/<id>/index.ts` exporting a GameModule and add it here.
 */
export const GAMES: GameModule[] = [golf, billiards];

export function getGame(id: string): GameModule | undefined {
  return GAMES.find((g) => g.id === id);
}
