import { Suspense } from "react";
import { notFound } from "next/navigation";
import { GAMES, getGame } from "@/games/registry";
import { GamePlay } from "@/components/hub/GamePlay";

export function generateStaticParams() {
  return GAMES.flatMap((g) => g.menu.map((m) => ({ gameId: g.id, entry: m.id })));
}

export default async function Page({ params }: { params: Promise<{ gameId: string; entry: string }> }) {
  const { gameId, entry } = await params;
  const game = getGame(gameId);
  if (!game || !game.menu.some((m) => m.id === entry)) notFound();
  return (
    <Suspense fallback={<div className="fixed inset-0 bg-black" />}>
      <GamePlay gameId={gameId} entryId={entry} />
    </Suspense>
  );
}
