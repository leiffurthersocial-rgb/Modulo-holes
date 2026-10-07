import { notFound } from "next/navigation";
import { entryRouteParams, isKnownRoute } from "@/games/manifest";
import { GameSetup } from "@/components/hub/GameSetup";

export function generateStaticParams() {
  return entryRouteParams();
}

export default async function Page({ params }: { params: Promise<{ gameId: string; entry: string }> }) {
  const { gameId, entry } = await params;
  if (!isKnownRoute(gameId, entry)) notFound();
  return <GameSetup gameId={gameId} entryId={entry} />;
}
