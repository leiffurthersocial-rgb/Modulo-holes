/**
 * Plain-data list of game ids and their menu entry ids, for server-side route generation.
 * Kept separate from the registry on purpose: importing the registry (which holds lazy
 * `import()`s of client code) into a server component would make Next prefetch every game's
 * 3D bundle on the hub. `registry.ts` asserts this stays in sync.
 */
export const GAME_ROUTES: Record<string, string[]> = {
  golf: ["campaign", "quick", "daily", "party"],
  billiards: ["ai", "local", "trick", "practice"],
};

export const gameRouteParams = () => Object.keys(GAME_ROUTES).map((gameId) => ({ gameId }));
export const entryRouteParams = () => Object.entries(GAME_ROUTES).flatMap(([gameId, entries]) => entries.map((entry) => ({ gameId, entry })));
export const isKnownRoute = (gameId: string, entry?: string) => !!GAME_ROUTES[gameId] && (entry === undefined || GAME_ROUTES[gameId].includes(entry));
