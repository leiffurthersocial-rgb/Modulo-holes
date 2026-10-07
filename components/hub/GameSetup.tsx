"use client";
import { useRouter } from "next/navigation";
import { Suspense, useEffect } from "react";
import { getGame } from "@/games/registry";
import { SETUP_COMPONENTS } from "./lazy";
import { Loading } from "./Loading";
import { playHref } from "./links";

export function GameSetup({ gameId, entryId }: { gameId: string; entryId: string }) {
  const game = getGame(gameId)!;
  const router = useRouter();
  const entry = game.menu.find((m) => m.id === entryId)!;
  const Setup = entry.hasSetup ? SETUP_COMPONENTS[gameId] ?? null : null;

  useEffect(() => {
    if (!Setup) router.replace(playHref(gameId, entryId));
  }, [Setup, router, gameId, entryId]);

  if (!Setup) return <Loading />;
  return (
    <Suspense fallback={<Loading />}>
      <Setup entryId={entryId} onStart={(params) => router.push(playHref(gameId, entryId, params))} onBack={() => router.push(`/play/${gameId}`)} />
    </Suspense>
  );
}
