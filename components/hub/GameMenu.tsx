"use client";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ChevronRight, Lock, Play } from "lucide-react";
import { useEffect } from "react";
import { getGame } from "@/games/registry";
import { Button, TopBar } from "@/components/ui";
import { sfx } from "@/engine/audio/audio";
import { useMounted } from "@/engine/save/useMounted";
import { playHref } from "./links";

export function GameMenu({ gameId }: { gameId: string }) {
  const game = getGame(gameId)!;
  const router = useRouter();
  const mounted = useMounted();
  const Thumb = game.Thumbnail;
  const quick = mounted ? game.quickPlay() : null;

  useEffect(() => sfx.setMood(game.music), [game.music]);

  return (
    <main className="mx-auto min-h-dvh w-full max-w-3xl pb-12">
      <TopBar onBack={() => router.push("/")} title={game.title} subtitle={game.tagline} />
      <div className="px-4 sm:px-6">
        <motion.div
          layoutId={`thumb-${game.id}`}
          className="relative overflow-hidden rounded-[28px] shadow-soft"
          style={{ background: `linear-gradient(145deg, ${game.colors.from}, ${game.colors.to})` }}
        >
          <div className="aspect-[16/9] w-full sm:aspect-[21/9]">
            <Thumb active />
          </div>
          <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-3 bg-gradient-to-t from-black/50 to-transparent p-4 pt-12">
            <p className="max-w-[60%] text-sm text-white/90">{game.description}</p>
            <Button
              size="lg"
              variant="primary"
              sound="whoosh"
              disabled={!quick}
              style={{ background: game.colors.accent }}
              onClick={() => quick && router.push(playHref(game.id, quick.entryId, quick.params))}
            >
              <Play size={20} fill="currentColor" /> {quick?.label ?? "Play"}
            </Button>
          </div>
        </motion.div>

        <h2 className="mb-3 mt-8 font-display text-sm font-semibold uppercase tracking-[0.2em] text-dim">Modes</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {game.menu.map((m, i) => {
            const lock = mounted ? m.locked?.() ?? null : null;
            const Icon = m.icon;
            return (
              <motion.button
                key={m.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 + i * 0.05 }}
                whileHover={lock ? undefined : { scale: 1.02 }}
                whileTap={lock ? { x: [0, -6, 6, -4, 0] } : { scale: 0.97 }}
                onClick={() => {
                  if (lock) {
                    sfx.play("foul");
                    return;
                  }
                  sfx.play("tap");
                  router.push(m.hasSetup ? `/play/${game.id}/${m.id}` : playHref(game.id, m.id));
                }}
                className={`flex items-center gap-4 rounded-[22px] border border-line bg-surface p-4 text-left shadow-soft ${lock ? "opacity-60" : ""}`}
              >
                <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-white" style={{ background: game.colors.accent }}>
                  {lock ? <Lock size={20} /> : <Icon size={22} />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-display text-lg font-semibold">{m.title}</div>
                  <div className="truncate text-sm text-dim">{lock ?? m.subtitle}</div>
                </div>
                <ChevronRight className="text-dim" size={20} />
              </motion.button>
            );
          })}
        </div>

        <h2 className="mb-3 mt-8 font-display text-sm font-semibold uppercase tracking-[0.2em] text-dim">How to play</h2>
        <ul className="space-y-2 rounded-[22px] border border-line bg-surface p-5 text-sm shadow-soft">
          {game.howTo.map((h) => (
            <li key={h} className="flex gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: game.colors.accent }} />
              <span>{h}</span>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
