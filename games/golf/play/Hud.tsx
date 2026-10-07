"use client";
import { AnimatePresence, motion } from "framer-motion";
import { Pause, RotateCcw, Map as MapIcon, Crosshair } from "lucide-react";
import { IconButton, AnimatedNumber } from "@/components/ui";
import { useSettings } from "@/engine/save/settings";
import { useGolfHud } from "./hudStore";
import { powerColor } from "../view/AimView";
import type { Player } from "./round";

interface Props {
  holeNumber: number;
  holeName: string;
  par: number;
  coinsTotal: number;
  player?: Player;
  showHint: boolean;
  onPause: () => void;
  onRestart: () => void;
}

/** Minimal glassy HUD: the world is the hero. */
export function Hud({ holeNumber, holeName, par, coinsTotal, player, showHint, onPause, onRestart }: Props) {
  const strokes = useGolfHud((s) => s.strokes);
  const coins = useGolfHud((s) => s.coins);
  const aiming = useGolfHud((s) => s.aiming);
  const power = useGolfHud((s) => s.power);
  const overview = useGolfHud((s) => s.overview);
  const setHud = useGolfHud((s) => s.set);
  const left = useSettings((s) => s.leftHanded);
  const col = `#${powerColor(power).getHexString()}`;

  return (
    <div className="pointer-events-none absolute inset-0 z-20 select-none text-white">
      {/* Top */}
      <div className="safe-top flex items-start justify-between gap-2 px-3 sm:px-5">
        <div className="pointer-events-auto">
          <IconButton label="Pause" onClick={onPause}>
            <Pause size={20} fill="currentColor" />
          </IconButton>
        </div>
        <div className="hud-chip flex min-w-0 flex-col items-center rounded-2xl px-4 py-1.5 text-center">
          <div className="font-display text-xs font-semibold uppercase tracking-[0.18em] text-white/70">
            Hole {holeNumber} · Par {par}
          </div>
          <div className="max-w-[46vw] truncate font-display text-base font-semibold leading-tight">{holeName}</div>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <div className="hud-chip flex items-center gap-2 rounded-2xl px-3.5 py-1.5">
            <span className="font-display text-xs font-semibold uppercase tracking-wider text-white/70">Strokes</span>
            <AnimatedNumber value={strokes} className={`font-display text-2xl font-bold ${strokes > par ? "text-[#ffb4b4]" : ""}`} />
          </div>
          {coinsTotal > 0 && (
            <div className="hud-chip flex items-center gap-1.5 rounded-full px-2.5 py-1 text-sm font-semibold">
              <span className="inline-block h-3.5 w-3.5 rounded-full bg-[#ffc83d] shadow-[0_0_8px_#ffc83d]" />
              <AnimatedNumber value={coins} />/{coinsTotal}
            </div>
          )}
          {player && (
            <div className="hud-chip flex items-center gap-1.5 rounded-full px-2.5 py-1 text-sm font-semibold">
              <span className="h-3 w-3 rounded-full" style={{ background: player.color }} />
              {player.name}
            </div>
          )}
        </div>
      </div>

      {/* Power meter */}
      <AnimatePresence>
        {aiming && (
          <motion.div
            initial={{ opacity: 0, x: left ? -20 : 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0 }}
            className={`absolute top-1/2 ${left ? "left-4" : "right-4"} flex -translate-y-1/2 flex-col items-center gap-2`}
          >
            <div className="hud-chip relative h-48 w-5 overflow-hidden rounded-full">
              <motion.div className="absolute bottom-0 left-0 right-0 rounded-full" style={{ height: `${power * 100}%`, background: col, boxShadow: `0 0 16px ${col}` }} />
            </div>
            <div className="font-display text-lg font-bold tabular-nums" style={{ color: col }}>
              {Math.round(power * 100)}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* First-shot hint */}
      <AnimatePresence>
        {showHint && !aiming && strokes === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: [0, -6, 0] }}
            exit={{ opacity: 0 }}
            transition={{ y: { repeat: Infinity, duration: 1.4 } }}
            className="absolute bottom-28 left-0 right-0 flex justify-center"
          >
            <div className="hud-chip flex items-center gap-2 rounded-full px-4 py-2 font-display font-semibold">
              <Crosshair size={18} /> Drag back from the ball, release to putt
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom controls */}
      <div className={`safe-bottom absolute bottom-0 left-0 right-0 flex items-end justify-between px-3 sm:px-5 ${left ? "flex-row-reverse" : ""}`}>
        <div className="pointer-events-auto">
          <IconButton label={overview ? "Back to ball" : "Overview"} onClick={() => setHud({ overview: !overview })} size={52} className={overview ? "!bg-white !text-black" : ""}>
            <MapIcon size={22} />
          </IconButton>
        </div>
        <div className="pointer-events-auto">
          <IconButton label="Restart hole" onClick={onRestart} size={52} sound="whoosh">
            <RotateCcw size={22} />
          </IconButton>
        </div>
      </div>
    </div>
  );
}
