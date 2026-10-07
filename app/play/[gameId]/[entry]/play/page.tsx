import { Suspense } from "react";
import { notFound } from "next/navigation";
import { entryRouteParams, isKnownRoute } from "@/games/manifest";
import { GamePlay } from "@/components/hub/GamePlay";

export function generateStaticParams() {
  return entryRouteParams();
}

export default async function Page({ params }: { params: Promise<{ gameId: string; entry: string }> }) {
  const { gameId, entry } = await params;
  if (!isKnownRoute(gameId, entry)) notFound();
  return (
    <Suspense fallback={<div className="fixed inset-0 bg-black" />}>
      <GamePlay gameId={gameId} entryId={entry} />
    </Suspense>
  );
}
