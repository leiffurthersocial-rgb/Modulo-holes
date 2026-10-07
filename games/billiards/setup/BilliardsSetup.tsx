"use client";
import { motion } from "framer-motion";
import { Check, Lock, Play } from "lucide-react";
import { useState } from "react";
import type { SetupProps } from "@/games/types";
import { Button, Segmented, Stars, TopBar } from "@/components/ui";
import { useMounted } from "@/engine/save/useMounted";
import { sfx } from "@/engine/audio/audio";
import { TABLE_THEMES } from "../themes";
import { useBilliardsSave, themeUnlocked, trickStarsTotal } from "../save";
import { TRICK_SHOTS } from "../sim/trickshots";

export default function BilliardsSetup({ entryId, onStart, onBack }: SetupProps) {
  const mounted = useMounted();
  if (!mounted) return null;
  if (entryId === "trick") return <TrickSetup onStart={onStart} onBack={onBack} />;
  return <MatchSetup local={entryId === "local"} onStart={onStart} onBack={onBack} />;
}

type P = Pick<SetupProps, "onStart" | "onBack">;

const LEVELS = [
  { id: "easy", name: "Rookie", desc: "Misses often. Learning the ropes.", emoji: "🙂" },
  { id: "medium", name: "Shark", desc: "Solid potter, plays position.", emoji: "😎" },
  { id: "hard", name: "Hustler", desc: "Laser aim, plans ahead. Good luck.", emoji: "🦈" },
] as const;

function MatchSetup({ local, onStart, onBack }: P & { local: boolean }) {
  const [rules, setRules] = useState<"8ball" | "9ball">("8ball");
  const [level, setLevel] = useState<"easy" | "medium" | "hard">("medium");
  const [p1, setP1] = useState("");
  const [p2, setP2] = useState("");
  const winsByLevel = useBilliardsSave((s) => s.winsByLevel);
  return (
    <main className="mx-auto min-h-dvh w-full max-w-xl pb-12">
      <TopBar onBack={onBack} title={local ? "2 Players" : "vs Computer"} subtitle="Rack 'em up" />
      <div className="space-y-6 px-4 sm:px-6">
        <section className="rounded-[24px] border border-line bg-surface p-5 shadow-soft">
          <h2 className="mb-3 font-display text-lg font-bold">Game</h2>
          <Segmented value={rules} onChange={setRules} options={[{ value: "8ball", label: "8-Ball" }, { value: "9ball", label: "9-Ball" }]} />
          <p className="mt-3 text-sm text-dim">{rules === "8ball" ? "Claim solids or stripes, clear them, then sink the 8." : "Always hit the lowest ball first. Sink the 9 to win — even on a combo."}</p>
        </section>
        {local ? (
          <section className="space-y-2 rounded-[24px] border border-line bg-surface p-5 shadow-soft">
            <h2 className="mb-1 font-display text-lg font-bold">Players</h2>
            {[
              [p1, setP1, "Player 1", "#ff5d73"],
              [p2, setP2, "Player 2", "#4cc9f0"],
            ].map(([v, set, ph, c]) => (
              <div key={ph as string} className="flex items-center gap-3">
                <span className="h-4 w-4 rounded-full" style={{ background: c as string }} />
                <input
                  value={v as string}
                  maxLength={12}
                  placeholder={ph as string}
                  onChange={(e) => (set as (s: string) => void)(e.target.value)}
                  className="h-11 w-full select-text rounded-xl border border-line bg-surface-2 px-3 font-semibold outline-none focus:border-accent"
                />
              </div>
            ))}
          </section>
        ) : (
          <section className="grid gap-3">
            {LEVELS.map((l) => (
              <motion.button
                key={l.id}
                whileTap={{ scale: 0.97 }}
                onClick={() => {
                  sfx.play("tap");
                  setLevel(l.id);
                }}
                className={`flex items-center gap-4 rounded-[22px] border p-4 text-left shadow-soft transition-colors ${level === l.id ? "border-accent bg-accent/10" : "border-line bg-surface"}`}
              >
                <div className="text-3xl">{l.emoji}</div>
                <div className="flex-1">
                  <div className="font-display text-lg font-semibold">{l.name}</div>
                  <div className="text-sm text-dim">{l.desc}</div>
                </div>
                {winsByLevel[l.id] > 0 && <div className="rounded-full bg-good/15 px-2.5 py-1 text-xs font-bold text-good">{winsByLevel[l.id]} W</div>}
              </motion.button>
            ))}
          </section>
        )}
        <ThemePicker />
        <Button size="xl" block sound="whoosh" onClick={() => onStart(local ? { rules, p1: p1.trim(), p2: p2.trim() } : { rules, level })}>
          <Play size={22} fill="currentColor" /> Rack &apos;em
        </Button>
      </div>
    </main>
  );
}

function ThemePicker() {
  const save = useBilliardsSave();
  return (
    <section>
      <h2 className="mb-3 font-display text-lg font-bold">Table</h2>
      <div className="no-scrollbar flex gap-3 overflow-x-auto pb-2">
        {TABLE_THEMES.map((t) => {
          const ok = themeUnlocked(t, save);
          const sel = save.theme === t.id;
          return (
            <motion.button
              key={t.id}
              whileTap={{ scale: 0.94 }}
              onClick={() => {
                if (!ok) return sfx.play("foul");
                sfx.play("unlock");
                save.setTheme(t.id);
              }}
              className={`relative w-28 shrink-0 overflow-hidden rounded-2xl border-2 text-left ${sel ? "border-accent" : "border-transparent"}`}
            >
              <div className="relative h-16 p-2" style={{ background: t.wood }}>
                <div className="h-full w-full rounded-md" style={{ background: t.felt, boxShadow: t.glow ? `0 0 12px ${t.glow}` : undefined }} />
                {!ok && (
                  <div className="absolute inset-0 grid place-items-center bg-black/55 text-white">
                    <Lock size={18} />
                  </div>
                )}
                {sel && (
                  <div className="absolute right-1.5 top-1.5 grid h-5 w-5 place-items-center rounded-full bg-accent text-white">
                    <Check size={12} />
                  </div>
                )}
              </div>
              <div className="bg-surface px-2 py-1.5">
                <div className="truncate text-xs font-bold">{t.name}</div>
                <div className="truncate text-[10px] text-dim">{ok ? "Unlocked" : t.unlockLabel}</div>
              </div>
            </motion.button>
          );
        })}
      </div>
    </section>
  );
}

function TrickSetup({ onStart, onBack }: P) {
  const trick = useBilliardsSave((s) => s.trick);
  const total = trickStarsTotal(trick);
  return (
    <main className="mx-auto min-h-dvh w-full max-w-2xl pb-12">
      <TopBar onBack={onBack} title="Trick Shots" subtitle={`${total}/${TRICK_SHOTS.length * 3} ★`} />
      <div className="grid gap-3 px-4 sm:grid-cols-2 sm:px-6">
        {TRICK_SHOTS.map((t, i) => {
          const stars = trick[t.id] ?? 0;
          const locked = i > 0 && !trick[TRICK_SHOTS[i - 1].id] && !stars;
          return (
            <motion.button
              key={t.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              whileTap={locked ? { x: [0, -5, 5, 0] } : { scale: 0.97 }}
              onClick={() => {
                if (locked) return sfx.play("foul");
                sfx.play("whoosh");
                onStart({ id: t.id });
              }}
              className={`flex items-center gap-4 rounded-[22px] border border-line bg-surface p-4 text-left shadow-soft ${locked ? "opacity-55" : ""}`}
            >
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#1e7a5c] font-display text-xl font-bold text-white">{locked ? <Lock size={18} /> : i + 1}</div>
              <div className="min-w-0 flex-1">
                <div className="font-display font-semibold">{t.name}</div>
                <div className="truncate text-sm text-dim">{t.hint}</div>
              </div>
              <Stars count={stars} size={14} />
            </motion.button>
          );
        })}
      </div>
    </main>
  );
}
