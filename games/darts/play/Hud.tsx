"use client";
import { AnimatePresence, motion } from "framer-motion";
import { Pause, Hand } from "lucide-react";
import { useEffect, useState } from "react";
import { AnimatedNumber, IconButton } from "@/components/ui";
import { CRICKET_NUMBERS } from "../sim/rules";
import type { DartsGame } from "./game";

/** Re-render when the game's visible state changes (cheap key comparison each frame). */
export function useGameSnapshot(game: DartsGame) {
  const [, setKey] = useState("");
  useEffect(() => {
    let id = 0;
    const loop = () => {
      const m = game.match;
      const k = `${game.phase}|${m.turn}|${m.darts.length}|${m.remaining}|${m.points}|${m.marks}|${m.clockTarget}|${m.legs}|${m.totalDarts}|${game.attempts}|${game.challengeHits.length}`;
      setKey((prev) => (prev === k ? prev : k));
      id = requestAnimationFrame(loop);
    };
    id = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(id);
  }, [game]);
}

export function DartsHud({ game, onPause, feedback, showHint }: { game: DartsGame; onPause: () => void; feedback: { text: string; key: number } | null; showHint: boolean }) {
  useGameSnapshot(game);
  const m = game.match;
  const mode = m.cfg.mode;
  const route = game.route();
  const ai = game.isAiTurn() && game.phase !== "over";

  return (
    <div className="pointer-events-none absolute inset-0 z-20 select-none text-white">
      <div className="safe-top flex items-start gap-2 px-3 sm:px-5">
        <div className="pointer-events-auto">
          <IconButton label="Pause" onClick={onPause}>
            <Pause size={20} fill="currentColor" />
          </IconButton>
        </div>
        <div className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
          {game.challenge ? (
            <div className="hud-chip max-w-[80vw] rounded-2xl px-4 py-1.5 text-center">
              <div className="font-display text-base font-semibold leading-tight">{game.challenge.name}</div>
              <div className="text-xs text-white/75">
                {game.challenge.hint} · Attempt {game.attempts + 1}
              </div>
            </div>
          ) : (
            <div className="flex gap-1.5">
              {game.players.map((p, i) => (
                <PlayerCard key={i} game={game} index={i} />
              ))}
            </div>
          )}
          <TurnStrip game={game} />
          {route && !ai && game.phase === "aim" && (
            <motion.div key={route.join()} initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="hud-chip rounded-full px-3 py-1 text-xs font-bold tracking-wider">
              <span className="text-white/60">CHECKOUT </span>
              {route.join(" · ")}
            </motion.div>
          )}
          {ai && (
            <div className="hud-chip flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold">
              {game.current.name} is throwing
              <span className="flex gap-0.5">
                {[0, 1, 2].map((i) => (
                  <motion.span key={i} className="h-1 w-1 rounded-full bg-white" animate={{ opacity: [0.2, 1, 0.2] }} transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15 }} />
                ))}
              </span>
            </div>
          )}
        </div>
        <div className="w-11" />
      </div>

      {mode === "cricket" && <CricketBoard game={game} />}

      <div className="safe-bottom absolute bottom-0 left-0 right-0 flex flex-col items-center gap-2 px-4 pb-4">
        <AnimatePresence mode="popLayout">
          {feedback && (
            <motion.div
              key={feedback.key}
              initial={{ opacity: 0, y: 10, scale: 0.8 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10 }}
              className={`hud-chip rounded-full px-4 py-1.5 font-display text-sm font-bold ${feedback.text === "Perfect release!" ? "text-[#7cf29b]" : "text-[#ffd166]"}`}
            >
              {feedback.text}
            </motion.div>
          )}
        </AnimatePresence>
        {showHint && game.phase === "aim" && !ai && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1, y: [0, -5, 0] }} transition={{ y: { repeat: Infinity, duration: 1.4 } }} className="hud-chip flex items-center gap-2 rounded-full px-4 py-2 font-display text-sm font-semibold">
            <Hand size={16} /> Hold to aim · flick up to throw
          </motion.div>
        )}
      </div>
    </div>
  );
}

function PlayerCard({ game, index }: { game: DartsGame; index: number }) {
  const m = game.match;
  const p = game.players[index];
  const active = m.turn === index && game.phase !== "over";
  const mode = m.cfg.mode;
  const main = mode === "x01" ? m.remaining[index] : mode === "cricket" ? m.points[index] : mode === "clock" ? Math.min(21, m.clockTarget[index]) : m.stats[index].points + (active ? m.turnTotal : 0);
  const label = mode === "x01" ? "left" : mode === "cricket" ? "pts" : mode === "clock" ? "target" : "total";
  return (
    <motion.div
      animate={{ scale: active ? 1 : 0.92, opacity: active ? 1 : 0.6 }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
      className={`hud-chip min-w-[7.5rem] rounded-2xl px-3 py-1.5 ${active ? "!border-white/50 shadow-[0_0_24px_rgba(255,255,255,0.2)]" : ""}`}
    >
      <div className="flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-full" style={{ background: p.color, boxShadow: active ? `0 0 8px ${p.color}` : undefined }} />
        <span className="max-w-[22vw] truncate font-display text-sm font-semibold">{p.name}</span>
        {m.cfg.legsToWin > 1 && (
          <span className="ml-auto flex gap-0.5">
            {Array.from({ length: m.cfg.legsToWin }, (_, i) => (
              <span key={i} className={`h-1.5 w-1.5 rounded-full ${i < m.legs[index] ? "bg-[#ffd166]" : "bg-white/20"}`} />
            ))}
          </span>
        )}
      </div>
      <div className="flex items-baseline gap-1.5">
        <AnimatedNumber value={mode === "clock" && main === 21 ? 25 : main} className="font-display text-3xl font-bold leading-none" format={(n) => (mode === "clock" && main === 21 ? "BULL" : String(Math.round(n)))} />
        <span className="text-[10px] font-semibold uppercase tracking-wider text-white/55">{label}</span>
      </div>
      <div className="text-[10px] font-semibold uppercase tracking-wider text-white/50">{mode === "clock" ? `${m.stats[index].darts} darts` : `avg ${game.match.average(index).toFixed(1)}`}</div>
    </motion.div>
  );
}

function TurnStrip({ game }: { game: DartsGame }) {
  const m = game.match;
  const darts = m.darts;
  return (
    <div className="hud-chip flex items-center gap-1 rounded-2xl px-2 py-1">
      {[0, 1, 2].map((i) => {
        const d = darts[i];
        const label = d ? (d.hit.label === "BOUNCE" ? "OUT" : d.hit.label) : "";
        return (
          <motion.div
            key={i + (d ? d.hit.label : "")}
            initial={d ? { scale: 1.6, opacity: 0 } : false}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 500, damping: 18 }}
            className={`grid h-8 w-12 place-items-center rounded-xl font-display text-sm font-bold ${d ? (d.hit.multiplier === 3 ? "bg-[#1fa05a]/80" : d.hit.multiplier === 2 || d.hit.label === "BULL" ? "bg-[#d33]/80" : d.hit.points ? "bg-white/15" : "bg-black/30 text-white/60") : "border border-dashed border-white/25"}`}
          >
            {label}
          </motion.div>
        );
      })}
      <div className="ml-1 min-w-[2.5rem] text-center font-display text-xl font-bold tabular-nums">
        <AnimatedNumber value={darts.some((d) => d.bust) ? 0 : m.turnTotal} />
      </div>
    </div>
  );
}

const MARK = ["", "/", "✕", "ⓧ"];

function CricketBoard({ game }: { game: DartsGame }) {
  const m = game.match;
  return (
    <div className="absolute left-2 top-1/2 -translate-y-1/2 sm:left-5">
      <div className="hud-chip rounded-2xl px-2 py-2 text-center font-display text-sm">
        {CRICKET_NUMBERS.map((n, i) => (
          <div key={n} className="grid grid-cols-[1.4rem_2rem_1.4rem] items-center">
            <span className="font-bold" style={{ color: game.players[0].color }}>
              {MARK[Math.min(3, m.marks[0][i])]}
            </span>
            <span className={`font-bold ${m.marks.every((r) => r[i] >= 3) ? "text-white/30 line-through" : ""}`}>{n === 25 ? "B" : n}</span>
            <span className="font-bold" style={{ color: game.players[1]?.color }}>
              {m.marks[1] ? MARK[Math.min(3, m.marks[1][i])] : ""}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
