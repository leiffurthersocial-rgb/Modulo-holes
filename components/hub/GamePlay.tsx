"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo } from "react";
import { getGame } from "@/games/registry";
import { PLAY_COMPONENTS } from "./lazy";
import { Loading } from "./Loading";
import { playHref } from "./links";

export function GamePlay({ gameId, entryId }: { gameId: string; entryId: string }) {
  const game = getGame(gameId)!;
  const router = useRouter();
  const search = useSearchParams();
  const params = useMemo(() => Object.fromEntries(search.entries()), [search]);
  const Play = PLAY_COMPONENTS[gameId];
  const entry = game.menu.find((m) => m.id === entryId)!;
  const key = `${entryId}?${search.toString()}`;

  return (
    <div className="fixed inset-0 overflow-hidden bg-black">
      <Suspense fallback={<Loading dark label={game.title} />}>
        <Play
          key={key}
          entryId={entryId}
          params={params}
          onExit={() => router.push(entry.hasSetup ? `/play/${gameId}/${entryId}` : `/play/${gameId}`)}
          onNavigate={(e, p) => router.replace(playHref(gameId, e, p))}
        />
      </Suspense>
    </div>
  );
}
