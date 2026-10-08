import type { GameModule } from "./types";
import { golf } from "./golf";
import { billiards } from "./billiards";
import { darts } from "./darts";
import { GAME_ROUTES } from "./manifest";

/**
 * All games in the hub, in display order.
 * Adding a game = create `/games/<id>/index.ts` exporting a GameModule and add it here.
 */
export const GAMES: GameModule[] = [golf, billiards, darts];

export function getGame(id: string): GameModule | undefined {
  return GAMES.find((g) => g.id === id);
}

// Keep the server-side route manifest honest.
if (process.env.NODE_ENV !== "production") {
  for (const g of GAMES) {
    const routes = GAME_ROUTES[g.id];
    const ids = g.menu.map((m) => m.id);
    if (!routes || routes.join() !== ids.join()) console.error(`[registry] games/manifest.ts is out of sync for "${g.id}": expected [${ids}]`);
  }
}
