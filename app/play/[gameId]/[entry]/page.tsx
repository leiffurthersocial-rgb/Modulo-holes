import { notFound } from "next/navigation";
import { GAMES, getGame } from "@/games/registry";
import { GameSetup } from "@/components/hub/GameSetup";

export function generateStaticParams() {
  return GAMES.flatMap((g) => g.menu.map((m) => ({ gameId: g.id, entry: m.id })));
}

export default async function Page({ params }: { params: Promise<{ gameId: string; entry: string }> }) {
  const { gameId, entry } = await params;
  const game = getGame(gameId);
  if (!game || !game.menu.some((m) => m.id === entry)) notFound();
  return <GameSetup gameId={gameId} entryId={entry} />;
}
