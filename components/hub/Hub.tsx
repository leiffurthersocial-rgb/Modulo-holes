"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Settings, Play, Sparkles } from "lucide-react";
import { useEffect } from "react";
import { GAMES } from "@/games/registry";
import type { GameModule } from "@/games/types";
import { IconButton } from "@/components/ui";
import { sfx } from "@/engine/audio/audio";
import { haptic } from "@/engine/juice/haptics";
import { useMounted } from "@/engine/save/useMounted";
import { playHref } from "./links";

export function Hub() {
  useEffect(() => sfx.setMood("hub"), []);
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col px-4 pb-10 sm:px-8">
      <header className="safe-top flex items-center justify-between pb-2 pt-3">
        <Logo />
        <SettingsButton />
      </header>

      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="mb-5 mt-6 sm:mt-10"
      >
        <h1 className="font-display text-4xl font-bold leading-[1.05] tracking-tight sm:text-6xl">
          Tiny games.
          <br />
          <span className="text-dim">Big feelings.</span>
        </h1>
      </motion.section>

      <ProgressStrip />

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        {GAMES.map((g, i) => (
          <GameCard key={g.id} game={g} index={i} />
        ))}
        <ComingSoonCard index={GAMES.length} />
      </div>

      <footer className="mt-auto pt-10 text-center text-xs text-dim">
        Modulo: Holes · all sounds & art generated in your browser
      </footer>
    </main>
  );
}

/** Trophy-cabinet summary: every game contributes its own stats via `useTrophies`. */
function ProgressStrip() {
  const mounted = useMounted();
  if (!mounted) return <div className="mb-6 h-10" />;
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="no-scrollbar mb-6 flex gap-2 overflow-x-auto">
      {GAMES.map((g) => (g.useTrophies ? <GameTrophies key={g.id} useItems={g.useTrophies} /> : null))}
    </motion.div>
  );
}

function GameTrophies({ useItems }: { useItems: NonNullable<GameModule["useTrophies"]> }) {
  const items = useItems().filter((it) => it.value > 0);
  return (
    <>
      {items.map((it) => (
        <div key={it.label} className="flex shrink-0 items-center gap-2 rounded-full border border-line bg-surface px-3.5 py-2 shadow-soft">
          <span style={{ color: it.color }}>{it.icon}</span>
          <span className="font-display text-lg font-bold tabular-nums">{it.value}</span>
          <span className="text-xs font-semibold text-dim">{it.label}</span>
        </div>
      ))}
    </>
  );
}

function SettingsButton() {
  const router = useRouter();
  return (
    <IconButton label="Settings" variant="secondary" onClick={() => router.push("/settings")}>
      <Settings size={20} />
    </IconButton>
  );
}

function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="relative grid h-10 w-10 place-items-center rounded-2xl bg-ink shadow-soft">
        <div className="h-4 w-4 rounded-full bg-accent shadow-[0_0_12px_var(--accent)]" />
      </div>
      <div className="leading-none">
        <div className="font-display text-xl font-bold tracking-tight">Modulo</div>
        <div className="font-display text-xs font-semibold uppercase tracking-[0.25em] text-dim">Holes</div>
      </div>
    </div>
  );
}

function GameCard({ game, index }: { game: GameModule; index: number }) {
  const router = useRouter();
  const mounted = useMounted();
  const Thumb = game.Thumbnail;
  const progress = game.useProgressLabel?.();

  const quick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    sfx.unlock();
    sfx.play("whoosh");
    haptic("light");
    const q = game.quickPlay();
    router.push(playHref(game.id, q.entryId, q.params));
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 24, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 300, damping: 26, delay: 0.08 + index * 0.08 }}
    >
      <motion.article
        whileHover={{ y: -4, scale: 1.01 }}
        whileTap={{ scale: 0.975 }}
        transition={{ type: "spring", stiffness: 420, damping: 24 }}
        className="group relative overflow-hidden rounded-[28px] shadow-soft"
        style={{ background: `linear-gradient(145deg, ${game.colors.from}, ${game.colors.to})` }}
      >
        <Link
          href={`/play/${game.id}`}
          onClick={() => {
            sfx.unlock();
            sfx.play("tap");
            haptic("tick");
          }}
          className="block"
          aria-label={`Open ${game.title}`}
        >
          <div className="relative aspect-[16/10] w-full">
            <Thumb active />
          </div>
          <div className="absolute inset-x-0 bottom-0 flex items-end gap-3 bg-gradient-to-t from-black/55 via-black/20 to-transparent p-5 pr-24 pt-16 text-white">
            <div className="min-w-0">
              <h2 className="font-display text-3xl font-bold tracking-tight drop-shadow">{game.title}</h2>
              <p className="truncate text-sm text-white/85">{game.tagline}</p>
              {mounted && progress && (
                <p className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-0.5 text-xs font-semibold backdrop-blur">
                  <Sparkles size={12} /> {progress}
                </p>
              )}
            </div>
          </div>
        </Link>
        <motion.button
          aria-label={`Quick play ${game.title}`}
          onClick={quick}
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.88 }}
          className="absolute bottom-5 right-5 grid h-14 w-14 place-items-center rounded-full bg-white shadow-lg"
          style={{ color: game.colors.accent }}
        >
          <Play size={24} fill="currentColor" className="ml-0.5" />
        </motion.button>
      </motion.article>
    </motion.div>
  );
}

function ComingSoonCard({ index }: { index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.08 + index * 0.08 }}
      className="flex aspect-[16/10] flex-col items-center justify-center gap-2 rounded-[28px] border-2 border-dashed border-line text-dim md:aspect-auto md:py-10"
    >
      <div className="font-display text-lg font-semibold">More games soon</div>
      <div className="text-sm">Bowling? Curling? Air hockey? 👀</div>
    </motion.div>
  );
}
