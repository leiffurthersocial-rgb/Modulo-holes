"use client";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Eye, Pause, RotateCcw, Video } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { IconButton } from "@/components/ui";
import { useSettings } from "@/engine/save/settings";
import { sfx } from "@/engine/audio/audio";
import { haptic } from "@/engine/juice";
import { TUNING } from "@/config/tuning";
import { ballColor, isSolid, isStripe } from "../sim/racks";
import type { BilliardsGame } from "./game";
import { useBilliardsHud } from "./hudStore";

export function BilliardsHud({ game, onPause, onReset, title, subtitle }: { game: BilliardsGame; onPause: () => void; onReset?: () => void; title?: string; subtitle?: string }) {
  const hud = useBilliardsHud();
  const left = useSettings((s) => s.leftHanded);
  const human = !game.isAiTurn() && hud.phase === "aim";

  return (
    <div className="pointer-events-none absolute inset-0 z-20 select-none text-white">
      <div className="safe-top flex items-start justify-between gap-2 px-3 sm:px-5">
        <div className="pointer-events-auto">
          <IconButton label="Pause" onClick={onPause}>
            <Pause size={20} fill="currentColor" />
          </IconButton>
        </div>
        {title ? (
          <div className="hud-chip max-w-[60vw] rounded-2xl px-4 py-1.5 text-center">
            <div className="font-display text-base font-semibold leading-tight">{title}</div>
            {subtitle && <div className="text-xs text-white/75">{subtitle}</div>}
          </div>
        ) : (
          <TurnIndicator game={game} />
        )}
        <div className="pointer-events-auto flex flex-col gap-2">
          <IconButton label={hud.cueCam ? "Overhead view" : "Cue view"} onClick={() => hud.set({ cueCam: !hud.cueCam })}>
            {hud.cueCam ? <Eye size={20} /> : <Video size={20} />}
          </IconButton>
          {onReset && (
            <IconButton label="Reset table" onClick={onReset} sound="whoosh">
              <RotateCcw size={18} />
            </IconButton>
          )}
        </div>
      </div>

      <AnimatePresence>
        {hud.ballInHand && human && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="absolute left-0 right-0 top-24 flex justify-center">
            <div className="hud-chip rounded-full px-4 py-1.5 text-sm font-semibold">Ball in hand{hud.kitchen ? " — behind the line" : ""} · drag the cue ball</div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className={`safe-bottom absolute bottom-0 left-0 right-0 flex items-end justify-between gap-3 px-3 sm:px-5 ${left ? "flex-row-reverse" : ""}`}>
        <SpinPicker game={game} disabled={!human} />
        <AimNudge game={game} disabled={!human} />
        <div className="w-[76px]" />
      </div>
      <PowerBar game={game} disabled={!human} left={left} />
    </div>
  );
}

function TurnIndicator({ game }: { game: BilliardsGame }) {
  const hud = useBilliardsHud();
  const rules = game.rules;
  return (
    <div className="flex min-w-0 items-center gap-1.5">
      {([0, 1] as const).map((p) => {
        const active = hud.turn === p && hud.phase !== "over";
        const g = hud.groups[p];
        const mine = g ? hud.onTable.filter((b) => (g === "solids" ? isSolid(b) : isStripe(b))) : [];
        return (
          <motion.div
            key={p}
            animate={{ scale: active ? 1 : 0.9, opacity: active ? 1 : 0.6 }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
            className={`hud-chip flex min-w-0 flex-col rounded-2xl px-3 py-1.5 ${active ? "!border-white/50 shadow-[0_0_24px_rgba(255,255,255,0.25)]" : ""}`}
          >
            <div className="flex items-center gap-1.5">
              {active && <motion.span layoutId="turn-dot" className="h-2 w-2 rounded-full bg-[#7cf29b] shadow-[0_0_8px_#7cf29b]" />}
              <span className="max-w-[24vw] truncate font-display text-sm font-semibold">{game.players[p].name}</span>
              {active && hud.aiThinking && <ThinkingDots />}
            </div>
            <div className="mt-0.5 flex h-3 items-center gap-0.5">
              {rules === "8ball" && g && mine.map((b) => <span key={b} className="h-2.5 w-2.5 rounded-full border border-white/40" style={{ background: g === "stripes" ? `linear-gradient(180deg,#fff 30%,${ballColor(b)} 30%,${ballColor(b)} 70%,#fff 70%)` : ballColor(b) }} />)}
              {rules === "8ball" && g && mine.length === 0 && <span className="text-[10px] font-bold uppercase tracking-wider text-[#ffd166]">on the 8</span>}
              {rules === "8ball" && !g && <span className="text-[10px] font-semibold uppercase tracking-wider text-white/60">open table</span>}
              {rules === "9ball" && active && hud.onTable.length > 0 && <span className="text-[10px] font-semibold uppercase tracking-wider text-white/80">hit the {Math.min(...hud.onTable)}</span>}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

function ThinkingDots() {
  return (
    <span className="flex gap-0.5">
      {[0, 1, 2].map((i) => (
        <motion.span key={i} className="h-1 w-1 rounded-full bg-white" animate={{ opacity: [0.2, 1, 0.2] }} transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15 }} />
      ))}
    </span>
  );
}

/** Pull-back power: drag down on the bar, release to strike. */
function PowerBar({ game, disabled, left }: { game: BilliardsGame; disabled: boolean; left: boolean }) {
  const [power, setPower] = useState(0);
  const start = useRef<number | null>(null);
  const lastStep = useRef(-1);
  const H = TUNING.billiards.shot.pullBackPx;

  // Mirror AI pulls on the bar too.
  useEffect(() => {
    let id = 0;
    const loop = () => {
      const shown = game.phase === "aim" || game.phase === "ai" ? game.power : 0;
      if (start.current === null) setPower((p) => (Math.abs(p - shown) > 0.005 ? shown : p));
      id = requestAnimationFrame(loop);
    };
    id = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(id);
  }, [game]);

  const col = power < 0.5 ? `color-mix(in oklab, #3ddc84, #ffd166 ${power * 200}%)` : `color-mix(in oklab, #ffd166, #ff4d5e ${(power - 0.5) * 200}%)`;
  return (
    <div className={`pointer-events-auto absolute top-1/2 ${left ? "left-3" : "right-3"} -translate-y-1/2`}>
      <div
        role="slider"
        aria-label="Shot power — drag down and release"
        aria-valuenow={Math.round(power * 100)}
        className={`hud-chip relative flex w-14 touch-none flex-col items-center rounded-full py-3 ${disabled ? "opacity-40" : ""}`}
        style={{ height: H + 40 }}
        onPointerDown={(e) => {
          if (disabled) return;
          (e.target as HTMLElement).setPointerCapture(e.pointerId);
          start.current = e.clientY;
          lastStep.current = -1;
          haptic("tick");
        }}
        onPointerMove={(e) => {
          if (start.current === null || disabled) return;
          const p = Math.max(0, Math.min(1, (e.clientY - start.current) / H));
          game.power = p;
          setPower(p);
          const step = Math.floor(p * 10);
          if (step !== lastStep.current) {
            lastStep.current = step;
            sfx.play("aim", { intensity: p });
            haptic(step === 10 ? "light" : "tick");
          }
        }}
        onPointerUp={() => {
          if (start.current === null) return;
          start.current = null;
          if (!disabled && game.power > 0.03) game.shoot();
          else game.power = 0;
          setPower(0);
        }}
        onPointerCancel={() => {
          start.current = null;
          game.power = 0;
          setPower(0);
        }}
      >
        <div className="text-[10px] font-bold uppercase tracking-widest text-white/60">Pull</div>
        <div className="relative mt-2 w-3 flex-1 overflow-hidden rounded-full bg-white/10">
          <div className="absolute left-0 right-0 top-0 rounded-full" style={{ height: `${power * 100}%`, background: col, boxShadow: `0 0 14px ${col}` }} />
        </div>
        <div className="mt-2 font-display text-sm font-bold tabular-nums">{Math.round(power * 100)}</div>
      </div>
    </div>
  );
}

/** Cue-ball english selector. */
function SpinPicker({ game, disabled }: { game: BilliardsGame; disabled: boolean }) {
  const [spin, setSpin] = useState(game.spin);
  const ref = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  useEffect(() => {
    let id = 0;
    const loop = () => {
      if (!dragging.current) setSpin((s) => (s.x !== game.spin.x || s.y !== game.spin.y ? { ...game.spin } : s));
      id = requestAnimationFrame(loop);
    };
    id = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(id);
  }, [game]);
  const setFrom = (cx: number, cy: number) => {
    const r = ref.current!.getBoundingClientRect();
    let x = ((cx - r.left) / r.width) * 2 - 1;
    let y = -(((cy - r.top) / r.height) * 2 - 1);
    const l = Math.hypot(x, y);
    if (l > 0.85) {
      x = (x / l) * 0.85;
      y = (y / l) * 0.85;
    }
    const s = { x: x / 0.85, y: y / 0.85 };
    game.spin = s;
    setSpin(s);
  };
  return (
    <div className={`pointer-events-auto flex flex-col items-center gap-1 ${disabled ? "opacity-40" : ""}`}>
      <div
        ref={ref}
        role="slider"
        aria-label="Cue ball spin"
        aria-valuenow={Math.round(spin.y * 100)}
        className="relative h-[76px] w-[76px] touch-none rounded-full shadow-lg"
        style={{ background: "radial-gradient(circle at 35% 30%, #ffffff, #e9e5d8 55%, #b8b2a2)" }}
        onPointerDown={(e) => {
          if (disabled) return;
          (e.target as HTMLElement).setPointerCapture(e.pointerId);
          dragging.current = true;
          setFrom(e.clientX, e.clientY);
          sfx.play("toggle");
        }}
        onPointerMove={(e) => dragging.current && !disabled && setFrom(e.clientX, e.clientY)}
        onPointerUp={() => (dragging.current = false)}
        onDoubleClick={() => {
          game.spin = { x: 0, y: 0 };
          setSpin({ x: 0, y: 0 });
        }}
      >
        <div className="absolute left-1/2 top-0 h-full w-px bg-black/10" />
        <div className="absolute left-0 top-1/2 h-px w-full bg-black/10" />
        <motion.div
          className="absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#e0262f] shadow-[0_0_8px_#e0262f]"
          animate={{ left: `${50 + spin.x * 42.5}%`, top: `${50 - spin.y * 42.5}%` }}
          transition={{ type: "spring", stiffness: 700, damping: 35 }}
        />
      </div>
      <div className="text-[10px] font-bold uppercase tracking-widest text-white/70">{spinLabel(spin)}</div>
    </div>
  );
}

function spinLabel(s: { x: number; y: number }) {
  if (Math.hypot(s.x, s.y) < 0.15) return "Center";
  const v = s.y > 0.3 ? "Follow" : s.y < -0.3 ? "Draw" : "";
  const h = s.x > 0.3 ? "Right" : s.x < -0.3 ? "Left" : "";
  return [v, h].filter(Boolean).join(" + ") || "Spin";
}

/** Hold-to-repeat fine aim buttons. */
function AimNudge({ game, disabled }: { game: BilliardsGame; disabled: boolean }) {
  const timer = useRef<number | null>(null);
  const nudge = (dir: number) => {
    const a = Math.atan2(game.aim.dz, game.aim.dx) + dir * 0.0026;
    game.aim = { dx: Math.cos(a), dz: Math.sin(a) };
    sfx.play("tick");
  };
  const start = (dir: number) => {
    if (disabled) return;
    nudge(dir);
    let n = 0;
    timer.current = window.setInterval(() => nudge(dir * (++n > 10 ? 3 : 1)), 70);
  };
  const stop = () => {
    if (timer.current) window.clearInterval(timer.current);
    timer.current = null;
  };
  useEffect(() => stop, []);
  return (
    <div className={`pointer-events-auto mb-4 flex items-center gap-2 ${disabled ? "opacity-40" : ""}`}>
      {[-1, 1].map((d) => (
        <button
          key={d}
          aria-label={d < 0 ? "Nudge aim left" : "Nudge aim right"}
          className="hud-chip grid h-12 w-12 touch-none place-items-center rounded-full active:scale-90"
          onPointerDown={() => start(d)}
          onPointerUp={stop}
          onPointerLeave={stop}
          onPointerCancel={stop}
        >
          {d < 0 ? <ChevronLeft size={22} /> : <ChevronRight size={22} />}
        </button>
      ))}
    </div>
  );
}

