"use client";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Home, Play, RotateCcw, Trophy, Volume2, VolumeX, Music, Smartphone } from "lucide-react";
import { useEffect } from "react";
import { Button, Stars, AnimatedNumber, Toggle } from "@/components/ui";
import { useSettings } from "@/engine/save/settings";
import { sfx } from "@/engine/audio/audio";
import { formatToPar, scoreName } from "../scoring";
import type { Player } from "./round";

const backdrop = "fixed inset-0 z-40 flex items-center justify-center p-4";

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.div
      initial={{ scale: 0.7, y: 40, opacity: 0 }}
      animate={{ scale: 1, y: 0, opacity: 1 }}
      exit={{ scale: 0.9, y: 20, opacity: 0 }}
      transition={{ type: "spring", stiffness: 380, damping: 24 }}
      className={`relative w-full max-w-sm overflow-hidden rounded-[30px] border border-white/10 bg-[#13151f]/92 p-6 text-white shadow-2xl backdrop-blur-xl ${className}`}
    >
      {children}
    </motion.div>
  );
}

export function IntroBanner({ show, number, name, par, tip, worldName }: { show: boolean; number: number; name: string; par: number; tip?: string; worldName: string }) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="pointer-events-none absolute inset-x-0 top-[22%] z-30 flex flex-col items-center text-center text-white"
          initial={{ opacity: 0, y: 20, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -30, scale: 1.05 }}
          transition={{ type: "spring", stiffness: 300, damping: 22 }}
        >
          <div className="font-display text-sm font-semibold uppercase tracking-[0.3em] text-white/80 drop-shadow">{worldName} · Hole {number}</div>
          <div className="font-display text-5xl font-bold tracking-tight drop-shadow-[0_4px_20px_rgba(0,0,0,0.45)] sm:text-6xl">{name}</div>
          <div className="mt-2 rounded-full bg-black/30 px-4 py-1 font-display text-lg font-semibold backdrop-blur">Par {par}</div>
          {tip && <div className="mt-3 max-w-xs text-sm text-white/90 drop-shadow">{tip}</div>}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export interface ResultsData {
  strokes: number;
  par: number;
  stars: number;
  coins: number;
  coinsTotal: number;
  combo: string[];
  newBest: boolean;
  pickedUp: boolean;
  streak: number;
}

export function ResultsCard({ open, data, nextLabel, onNext, onRetry, onMenu }: { open: boolean; data: ResultsData | null; nextLabel: string | null; onNext: () => void; onRetry: () => void; onMenu: () => void }) {
  const sn = data ? scoreName(data.strokes, data.par) : null;
  return (
    <AnimatePresence>
      {open && data && sn && (
        <motion.div className={backdrop} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="absolute inset-0 bg-black/30" />
          <Card>
            <Glow tone={sn.tone} />
            <div className="relative text-center">
              <motion.div
                initial={{ scale: 0.4, rotate: -10 }}
                animate={{ scale: 1, rotate: -2 }}
                transition={{ type: "spring", stiffness: 500, damping: 12 }}
                className="font-display text-4xl font-bold tracking-tight"
                style={{ color: TONE_COLORS[sn.tone] }}
              >
                {data.pickedUp ? "Picked up" : sn.label}
              </motion.div>
              {data.combo.length > 0 && (
                <div className="mt-1 flex flex-wrap justify-center gap-1.5">
                  {data.combo.map((c, i) => (
                    <motion.span
                      key={c}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.15 + i * 0.1 }}
                      className="rounded-full bg-white/10 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider"
                    >
                      {c}
                    </motion.span>
                  ))}
                </div>
              )}
              <div className="mt-5 flex justify-center">
                <Stars count={data.stars} size={46} animate delay={0.1} />
              </div>
              <div className="mt-5 grid grid-cols-3 gap-2 text-center">
                <Stat label="Strokes" value={<AnimatedNumber value={data.strokes} ticks />} />
                <Stat label="To par" value={formatToPar(data.strokes - data.par)} />
                <Stat label="Coins" value={`${data.coins}/${data.coinsTotal}`} />
              </div>
              {(data.newBest || data.streak >= 2) && (
                <div className="mt-3 flex justify-center gap-2">
                  {data.newBest && <span className="rounded-full bg-[#ffc83d] px-3 py-1 text-xs font-bold uppercase text-black">New best!</span>}
                  {data.streak >= 2 && <span className="rounded-full bg-[#ff6b5b] px-3 py-1 text-xs font-bold uppercase">🔥 {data.streak} under-par streak</span>}
                </div>
              )}
              <div className="mt-6 flex flex-col gap-2.5">
                {nextLabel && (
                  <Button size="lg" block onClick={onNext} sound="whoosh">
                    {nextLabel} <ArrowRight size={20} />
                  </Button>
                )}
                <div className="flex gap-2.5">
                  <Button variant="glass" block onClick={onRetry}>
                    <RotateCcw size={18} /> Retry
                  </Button>
                  <Button variant="glass" block onClick={onMenu} sound="back">
                    <Home size={18} /> Menu
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

const TONE_COLORS = { legend: "#ffd166", great: "#7cf29b", good: "#ffffff", ok: "#cfd3e3", meh: "#ffb4b4" };

function Glow({ tone }: { tone: keyof typeof TONE_COLORS }) {
  return <div className="pointer-events-none absolute -top-24 left-1/2 h-48 w-72 -translate-x-1/2 rounded-full opacity-40 blur-3xl" style={{ background: TONE_COLORS[tone] }} />;
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-white/[0.07] px-2 py-2.5">
      <div className="font-display text-2xl font-bold">{value}</div>
      <div className="text-[11px] font-semibold uppercase tracking-wider text-white/60">{label}</div>
    </div>
  );
}

export function PassCard({ open, player, holeNumber, onGo }: { open: boolean; player: Player | null; holeNumber: number; onGo: () => void }) {
  return (
    <AnimatePresence>
      {open && player && (
        <motion.div className={backdrop} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
          <Card className="text-center">
            <div className="text-sm font-semibold uppercase tracking-[0.25em] text-white/60">Hole {holeNumber}</div>
            <motion.div
              className="mx-auto mt-4 grid h-20 w-20 place-items-center rounded-full text-3xl font-bold text-black"
              style={{ background: player.color }}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 400, damping: 12 }}
            >
              {player.name.slice(-1)}
            </motion.div>
            <div className="mt-4 font-display text-3xl font-bold">{player.name}&apos;s turn</div>
            <p className="mt-1 text-white/70">Pass the device!</p>
            <Button size="lg" block className="mt-6" onClick={onGo} style={{ background: player.color, color: "#111" }}>
              <Play size={20} fill="currentColor" /> Go
            </Button>
          </Card>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function Scorecard({
  open,
  title,
  players,
  scores,
  pars,
  final,
  onContinue,
  onMenu,
}: {
  open: boolean;
  title: string;
  players: Player[];
  scores: (number | null)[][];
  pars: number[];
  final: boolean;
  onContinue: () => void;
  onMenu: () => void;
}) {
  const totals = players.map((_, p) => scores[p].reduce<number>((a, s) => a + (s ?? 0), 0));
  const played = pars.map((_, h) => scores.every((row) => row[h] !== null));
  const parTotal = pars.reduce((a, p, h) => a + (played[h] ? p : 0), 0);
  const best = Math.min(...totals);
  const winners = players.filter((_, i) => totals[i] === best);

  useEffect(() => {
    if (open && final) sfx.play("bigFanfare");
  }, [open, final]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div className={backdrop} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="absolute inset-0 bg-black/45 backdrop-blur-sm" />
          <Card className="max-w-md">
            <div className="text-center">
              {final && <Trophy className="mx-auto mb-1 text-[#ffd166]" size={40} />}
              <div className="font-display text-3xl font-bold">{final ? (winners.length > 1 ? "It's a tie!" : `${winners[0].name} wins!`) : title}</div>
            </div>
            <div className="no-scrollbar mt-4 overflow-x-auto">
              <table className="w-full text-center text-sm tabular-nums">
                <thead>
                  <tr className="text-white/50">
                    <th className="px-1 py-1 text-left font-semibold">Hole</th>
                    {pars.map((_, i) => (
                      <th key={i} className="px-1 font-semibold">
                        {i + 1}
                      </th>
                    ))}
                    <th className="px-1 font-semibold">Tot</th>
                  </tr>
                  <tr className="text-white/40">
                    <td className="px-1 py-1 text-left">Par</td>
                    {pars.map((p, i) => (
                      <td key={i}>{p}</td>
                    ))}
                    <td>{parTotal}</td>
                  </tr>
                </thead>
                <tbody>
                  {players.map((pl, p) => (
                    <motion.tr key={p} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 + p * 0.08 }} className="border-t border-white/10">
                      <td className="flex items-center gap-1.5 px-1 py-2 text-left font-semibold">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ background: pl.color }} />
                        <span className="max-w-[5.5rem] truncate">{pl.name}</span>
                      </td>
                      {scores[p].map((s, h) => (
                        <td key={h} className={s !== null && s < pars[h] ? "font-bold text-[#7cf29b]" : s !== null && s > pars[h] ? "text-[#ffb4b4]" : ""}>
                          {s ?? "·"}
                        </td>
                      ))}
                      <td className="font-display text-base font-bold">{totals[p]}</td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-6 flex gap-2.5">
              <Button variant="glass" block onClick={onMenu} sound="back">
                <Home size={18} /> Menu
              </Button>
              <Button block onClick={onContinue} sound="whoosh">
                {final ? (
                  <>
                    <RotateCcw size={18} /> Rematch
                  </>
                ) : (
                  <>
                    Next hole <ArrowRight size={18} />
                  </>
                )}
              </Button>
            </div>
          </Card>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function DailySummary({ open, toPar, best, isNewBest, stars, onMenu, onRetry }: { open: boolean; toPar: number; best: number | null; isNewBest: boolean; stars: number; onMenu: () => void; onRetry: () => void }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div className={backdrop} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="absolute inset-0 bg-black/45 backdrop-blur-sm" />
          <Card className="text-center">
            <div className="text-sm font-semibold uppercase tracking-[0.25em] text-white/60">Daily Challenge</div>
            <motion.div initial={{ scale: 0.5 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 400, damping: 12 }} className="mt-2 font-display text-6xl font-bold">
              {formatToPar(toPar)}
            </motion.div>
            <div className="mt-2 flex justify-center">
              <Stars count={stars} size={36} animate />
            </div>
            <p className="mt-3 text-white/70">{isNewBest ? "New personal best for today!" : best !== null ? `Today's best: ${formatToPar(best)}` : ""}</p>
            <p className="mt-1 text-sm text-white/50">A fresh challenge drops every day at midnight.</p>
            <div className="mt-6 flex gap-2.5">
              <Button variant="glass" block onClick={onMenu} sound="back">
                <Home size={18} /> Menu
              </Button>
              <Button block onClick={onRetry}>
                <RotateCcw size={18} /> Again
              </Button>
            </div>
          </Card>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function PauseMenu({ open, onResume, onRestart, onQuit }: { open: boolean; onResume: () => void; onRestart: () => void; onQuit: () => void }) {
  const s = useSettings();
  return (
    <AnimatePresence>
      {open && (
        <motion.div className={backdrop} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <motion.div className="absolute inset-0 bg-black/50 backdrop-blur-md" onClick={onResume} />
          <Card className="text-center">
            <div className="font-display text-4xl font-bold">Paused</div>
            <div className="mt-5 flex flex-col gap-2.5">
              <Button size="lg" block onClick={onResume}>
                <Play size={20} fill="currentColor" /> Resume
              </Button>
              <Button variant="glass" size="lg" block onClick={onRestart}>
                <RotateCcw size={20} /> Restart hole
              </Button>
              <Button variant="glass" size="lg" block onClick={onQuit} sound="back">
                <Home size={20} /> Quit
              </Button>
            </div>
            <div className="mt-5 space-y-3 rounded-2xl bg-white/[0.06] p-4 text-left">
              <QuickToggle icon={s.sound ? <Volume2 size={18} /> : <VolumeX size={18} />} label="Sound" checked={s.sound} onChange={(v) => s.set({ sound: v })} />
              <QuickToggle icon={<Music size={18} />} label="Music" checked={s.music} onChange={(v) => s.set({ music: v })} />
              <QuickToggle icon={<Smartphone size={18} />} label="Haptics" checked={s.haptics} onChange={(v) => s.set({ haptics: v })} />
            </div>
          </Card>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function QuickToggle({ icon, label, checked, onChange }: { icon: React.ReactNode; label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-white/70">{icon}</span>
      <span className="flex-1 font-semibold">{label}</span>
      <Toggle label={label} checked={checked} onChange={onChange} />
    </div>
  );
}
