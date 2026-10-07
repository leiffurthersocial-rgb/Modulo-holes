import type { GameParams } from "@/games/types";

export function playHref(gameId: string, entryId: string, params: GameParams = {}) {
  const qs = new URLSearchParams(params).toString();
  return `/play/${gameId}/${entryId}/play${qs ? `?${qs}` : ""}`;
}
