"use client";
import { motion } from "framer-motion";
import { Check, Lock, Play } from "lucide-react";
import { useState } from "react";
import type { SetupProps } from "@/games/types";
import { Button, Segmented, Stars, TopBar } from "@/components/ui";
import { useMounted } from "@/engine/save/useMounted";
import { sfx } from "@/engine/audio/audio";
import { BOARD_THEMES, FLIGHTS } from "../themes";
import { useDartsSave, boardUnlocked, flightUnlocked, challengeStarsTotal } from "../save";
import { CHALLENGES } from "../sim/challenges";
import { flightCss } from "./flightCss";

export default function DartsSetup({ entryId, onStart, onBack }: SetupProps) {
  const mounted = useMounted();
  if (!mounted) return null;
  if (entryId === "challenge") return <ChallengeSetup onStart={onStart} onBack={onBack} />;
  return <MatchSetup local={entryId === "local"} onStart={onStart} onBack={onBack} />;
}

type P = Pick<SetupProps, "onStart" | "onBack">;

const LEVELS = [
  { id: "easy", name: "Rookie", desc: "Pub-league nerves. Averages ~30.", emoji: "🍺" },
  { id: "medium", name: "Shark", desc: "Solid thrower. Averages ~50.", emoji: "🎯" },
  { id: "hard", name: "Pro", desc: "Tour-level. Averages 80+, hits 180s.", emoji: "🏆" },
] as const;

function MatchSetup({ local, onStart, onBack }: P & { local: boolean }) {
  const [game, setGame] = useState<"501" | "301" | "cricket">("501");
  const [legs, setLegs] = useState<"1" | "3">("1");
  const [level, setLevel] = useState<"easy" | "medium" | "hard">("medium");
  const [p1, setP1] = useState("");
  const [p2, setP2] = useState("");
  const winsByLevel = useDartsSave((s) => s.winsByLevel);
  return (
    <main className="mx-auto min-h-dvh w-full max-w-xl pb-12">
      <TopBar onBack={onBack} title={local ? "2 Players" : "vs Computer"} subtitle="Step up to the oche" />
      <div className="space-y-6 px-4 sm:px-6">
        <section className="rounded-[24px] border border-line bg-surface p-5 shadow-soft">
          <h2 className="mb-3 font-display text-lg font-bold">Game</h2>
          <Segmented value={game} onChange={setGame} options={[{ value: "501", label: "501" }, { value: "301", label: "301" }, { value: "cricket", label: "Cricket" }]} />
          <div className="mt-3">
            <Segmented value={legs} onChange={setLegs} options={[{ value: "1", label: "Single leg" }, { value: "3", label: "Best of 3" }]} />
          </div>
          <p className="mt-3 text-sm text-dim">{game === "cricket" ? "Close 15–20 and the bull (3 marks each), score on numbers your opponent hasn't closed." : "Count down to exactly zero. Finish on a double (or the bull). Overshoot and you bust."}</p>
        </section>
        {local ? (
          <section className="space-y-2 rounded-[24px] border border-line bg-surface p-5 shadow-soft">
            <h2 className="mb-1 font-display text-lg font-bold">Players</h2>
            {(
              [
                [p1, setP1, "Player 1", "#ff5d5d"],
                [p2, setP2, "Player 2", "#4cc9f0"],
              ] as const
            ).map(([v, set, ph, c]) => (
              <div key={ph} className="flex items-center gap-3">
                <span className="h-4 w-4 rounded-full" style={{ background: c }} />
                <input value={v} maxLength={12} placeholder={ph} onChange={(e) => set(e.target.value)} className="h-11 w-full select-text rounded-xl border border-line bg-surface-2 px-3 font-semibold outline-none focus:border-accent" />
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
        <Cosmetics />
        <Button size="xl" block sound="whoosh" onClick={() => onStart(local ? { game, legs, p1: p1.trim(), p2: p2.trim() } : { game, legs, level })}>
          <Play size={22} fill="currentColor" /> Game on
        </Button>
      </div>
    </main>
  );
}

function Cosmetics() {
  const save = useDartsSave();
  return (
    <>
      <section>
        <h2 className="mb-3 font-display text-lg font-bold">Board</h2>
        <div className="no-scrollbar flex gap-3 overflow-x-auto pb-2">
          {BOARD_THEMES.map((t) => {
            const ok = boardUnlocked(t, save);
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
                <div className="relative grid h-20 place-items-center" style={{ background: t.wallColor }}>
                  <div
                    className="h-14 w-14 rounded-full"
                    style={{ background: `repeating-conic-gradient(${t.dark} 0 18deg, ${t.light} 18deg 36deg)`, boxShadow: `0 0 0 3px ${t.red}, 0 0 0 5px ${t.green}${t.ring ? `, 0 0 16px ${t.ring}` : ""}` }}
                  />
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
      <section>
        <h2 className="mb-3 font-display text-lg font-bold">Flights</h2>
        <div className="no-scrollbar flex gap-3 overflow-x-auto pb-2">
          {FLIGHTS.map((f) => {
            const ok = flightUnlocked(f, save);
            const sel = save.flight === f.id;
            return (
              <motion.button
                key={f.id}
                whileTap={{ scale: 0.9 }}
                onClick={() => {
                  if (!ok) return sfx.play("foul");
                  sfx.play("unlock");
                  save.setFlight(f.id);
                }}
                className={`flex w-20 shrink-0 flex-col items-center gap-1.5 rounded-2xl border p-2.5 ${sel ? "border-accent bg-accent/10" : "border-line bg-surface"}`}
              >
                <div className="relative h-11 w-11">
                  <div className="h-full w-full" style={{ background: flightCss(f), clipPath: "polygon(50% 0, 100% 35%, 85% 100%, 15% 100%, 0 35%)" }} />
                  {!ok && (
                    <div className="absolute inset-0 grid place-items-center rounded-lg bg-black/50 text-white">
                      <Lock size={16} />
                    </div>
                  )}
                </div>
                <div className="text-xs font-semibold">{f.name}</div>
                {!ok && <div className="text-center text-[10px] leading-tight text-dim">{f.unlockLabel}</div>}
              </motion.button>
            );
          })}
        </div>
      </section>
    </>
  );
}

function ChallengeSetup({ onStart, onBack }: P) {
  const ch = useDartsSave((s) => s.challenges);
  const total = challengeStarsTotal(ch);
  return (
    <main className="mx-auto min-h-dvh w-full max-w-2xl pb-12">
      <TopBar onBack={onBack} title="Challenges" subtitle={`${total}/${CHALLENGES.length * 3} ★`} />
      <div className="grid gap-3 px-4 sm:grid-cols-2 sm:px-6">
        {CHALLENGES.map((c, i) => {
          const stars = ch[c.id] ?? 0;
          const locked = i > 0 && !ch[CHALLENGES[i - 1].id] && !stars;
          return (
            <motion.button
              key={c.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              whileTap={locked ? { x: [0, -5, 5, 0] } : { scale: 0.97 }}
              onClick={() => {
                if (locked) return sfx.play("foul");
                sfx.play("whoosh");
                onStart({ id: c.id });
              }}
              className={`flex items-center gap-4 rounded-[22px] border border-line bg-surface p-4 text-left shadow-soft ${locked ? "opacity-55" : ""}`}
            >
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#c0392b] font-display text-xl font-bold text-white">{locked ? <Lock size={18} /> : i + 1}</div>
              <div className="min-w-0 flex-1">
                <div className="font-display font-semibold">{c.name}</div>
                <div className="truncate text-sm text-dim">{c.hint}</div>
              </div>
              <Stars count={stars} size={14} />
            </motion.button>
          );
        })}
      </div>
    </main>
  );
}
