import { notFound } from "next/navigation";
import { gameRouteParams, isKnownRoute } from "@/games/manifest";
import { GameMenu } from "@/components/hub/GameMenu";

export function generateStaticParams() {
  return gameRouteParams();
}

export default async function Page({ params }: { params: Promise<{ gameId: string }> }) {
  const { gameId } = await params;
  if (!isKnownRoute(gameId)) notFound();
  return <GameMenu gameId={gameId} />;
}
