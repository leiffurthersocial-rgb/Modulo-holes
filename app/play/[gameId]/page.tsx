import { notFound } from "next/navigation";
import { GAMES, getGame } from "@/games/registry";
import { GameMenu } from "@/components/hub/GameMenu";

export function generateStaticParams() {
  return GAMES.map((g) => ({ gameId: g.id }));
}

export default async function Page({ params }: { params: Promise<{ gameId: string }> }) {
  const { gameId } = await params;
  if (!getGame(gameId)) notFound();
  return <GameMenu gameId={gameId} />;
}
