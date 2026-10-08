"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Home, RotateCcw, ArrowRight, Trophy } from "lucide-react";
import type { PlayProps } from "@/games/types";
import { GameCanvas } from "@/engine/render/GameCanvas";
import { CameraRig } from "@/engine/camera/CameraRig";
import { Remount } from "@/engine/render/Remount";
import { CameraRigState } from "@/engine/camera/rig";
import { PopupLayer } from "@/engine/juice/PopupLayer";
import { emitParticles, haptic, popup, resetShake, resetTime, usePopups } from "@/engine/juice";
import { sfx } from "@/engine/audio/audio";
import { Button, Stars } from "@/components/ui";
import { PauseMenu } from "@/components/ui/PauseMenu";
import { GameCard, overlayBackdrop } from "@/components/ui/GameCard";
import { BilliardsGame, type BMode, type ShotOutcome } from "./game";
import { AimGuide, Balls, CueStick, PlacementRing, Table } from "./TableView";
import { BilliardsController } from "./BilliardsController";
import { BilliardsHud } from "./Hud";
import { useBilliardsHud } from "./hudStore";
import { getTheme } from "../themes";
import { useBilliardsSave, unlockedThemes } from "../save";
import { TRICK_SHOTS, trickStars } from "../sim/trickshots";
import type { AiLevel } from "../sim/ai";
import type { RuleSet } from "../sim/rules";

type Overlay = "none" | "pause" | "over" | "trick";

const LEVEL_NAMES: Record<AiLevel, string> = { easy: "Rookie", medium: "Shark", hard: "Hustler" };

export default function BilliardsPlay({ entryId, params, onExit, onNavigate }: PlayProps) {
  const mode = (["ai", "local", "trick", "practice"].includes(entryId) ? entryId : "ai") as BMode;
  const rules: RuleSet = params.rules === "9ball" ? "9ball" : "8ball";
  const level: AiLevel = params.level === "easy" || params.level === "hard" ? params.level : "medium";
  const themeId = useBilliardsSave((s) => s.theme);
  const theme = getTheme(themeId);
  const [round, setRound] = useState(0);
  const [overlay, setOverlay] = useState<Overlay>("none");
  const [over, setOver] = useState<{ winner: 0 | 1; title: string; sub: string } | null>(null);
  const [trickResult, setTrickResult] = useState<{ ok: boolean; stars: number } | null>(null);
  const placeValid = useRef<boolean>(true);

  const game = useMemo(() => {
    const players: BilliardsGame["players"] =
      mode === "ai"
        ? [{ name: "You", ai: null }, { name: `${LEVEL_NAMES[level]} AI`, ai: level }]
        : mode === "local"
          ? [{ name: params.p1 || "Player 1", ai: null }, { name: params.p2 || "Player 2", ai: null }]
          : [{ name: "You", ai: null }, { name: "—", ai: null }];
    return new BilliardsGame({ mode, rules, players, trickId: params.id });
    // `round` re-creates the game for rematches.
    void round;
  }, [mode, rules, level, params.p1, params.p2, params.id, round]);
  const rig = useMemo(() => new CameraRigState({ pitch: 1.32, distance: 3.2, fov: 46 }), []);

  useEffect(() => {
    sfx.setMood("lounge");
    resetTime();
    resetShake();
    usePopups.getState().clear();
    useBilliardsHud.getState().set({ phase: game.phase, turn: game.state.turn, groups: [null, null], onTable: [...game.state.onTable], ballInHand: game.state.ballInHand, kitchen: game.state.kitchen });
    rig.snap();
  }, [game, rig]);

  useEffect(() => {
    if (mode === "trick" && game.trick) popup({ text: game.trick.name, sub: game.trick.hint, style: "small" }, 2.6);
    else if (mode !== "practice") popup({ text: rules === "9ball" ? "9-Ball" : "8-Ball", sub: `${game.currentPlayer.name} to break`, style: "big" }, 1.8);
  }, [game, mode, rules]);

  useEffect(() => {
    game.onShotResolved = (o: ShotOutcome) => {
      if (mode === "trick") return handleTrick(o);
      const v = o.verdict!;
      if (v.gameOver) {
        const winner = v.state.winner!;
        const youWon = mode === "ai" ? winner === 0 : true;
        const title = mode === "ai" ? (youWon ? "You win!" : `${game.players[1].name} wins`) : `${game.players[winner].name} wins!`;
        const sub = v.message ?? "";
        popup({ text: title.toUpperCase(), sub, style: "hero", color: youWon ? "#ffd166" : "#ff8a8a" }, 2.2);
        if (youWon) {
          sfx.play("bigFanfare");
          haptic("celebrate");
          emitParticles({ kind: "confetti", position: [0, 0.4, 0], count: 200, speed: 3, spread: 0.6, size: 0.35 });
        } else sfx.play("foul");
        // Persist.
        const save = useBilliardsSave.getState();
        const before = unlockedThemes(save).map((t) => t.id);
        if (mode === "ai") save.recordGame(winner === 0, level);
        save.addPots(game.stats.pots[0] + (mode === "local" ? game.stats.pots[1] : 0), game.stats.bestStreak);
        const after = unlockedThemes(useBilliardsSave.getState());
        const fresh = after.find((t) => !before.includes(t.id));
        if (fresh) window.setTimeout(() => {
          sfx.play("unlock");
          popup({ text: "New table!", sub: fresh.name, style: "big", color: "#ffd166" }, 2.4);
        }, 2300);
        window.setTimeout(() => {
          setOver({ winner, title, sub });
          setOverlay("over");
        }, 2400);
        return;
      }
      if (v.foul) {
        sfx.play("foul");
        haptic("fail");
        popup({ text: "FOUL", sub: `${v.foul} · ball in hand`, style: "bad" }, 1.6);
      } else if (v.message) {
        popup({ text: v.message, style: "big", color: "#ffd166" }, 1.4);
        sfx.play("unlock");
      }
      if (!v.foul && v.scored.length) {
        const s = game.streak;
        sfx.play("star", { pitch: Math.min(12, (s - 1) * 2) });
        if (s >= 2) popup({ text: `×${s}`, sub: s >= 4 ? "ON FIRE 🔥" : s >= 3 ? "HOT STREAK" : "COMBO", style: "big", color: s >= 3 ? "#ff8a3d" : "#7cf29b", y: 20 }, 1.2);
      }
      if (!v.continues && !v.foul && mode !== "practice") {
        const next = game.players[v.state.turn].name;
        popup({ text: next === "You" ? "Your turn" : `${next}'s turn`, style: "small", y: 70 }, 1.1);
      }
    };

    function handleTrick(o: ShotOutcome) {
      if (o.trickSuccess) {
        const stars = trickStars(game.attempts);
        useBilliardsSave.getState().recordTrick(game.trick!.id, stars);
        sfx.play("bigFanfare");
        haptic("celebrate");
        emitParticles({ kind: "confetti", position: [0, 0.4, 0], count: 180, speed: 3, spread: 0.6, size: 0.35 });
        popup({ text: "NAILED IT!", sub: game.attempts === 1 ? "First try!" : `${game.attempts} attempts`, style: "hero", color: "#ffd166" }, 1.8);
        window.setTimeout(() => {
          setTrickResult({ ok: true, stars });
          setOverlay("trick");
        }, 1700);
      } else {
        sfx.play("foul");
        popup({ text: "So close!", sub: "Try again", style: "bad" }, 1.1);
        window.setTimeout(() => game.retryTrick(), 1100);
      }
    }
    return () => {
      game.onShotResolved = null;
    };
  }, [game, mode, level]);

  const trickIdx = TRICK_SHOTS.findIndex((t) => t.id === game.trick?.id);
  const nextTrick = TRICK_SHOTS[trickIdx + 1];
  const restartLabel = mode === "trick" ? "Reset shot" : "New rack";

  return (
    <div className="absolute inset-0" style={{ background: theme.room }}>
      <GameCanvas bloom={{ intensity: theme.glow ? 0.9 : 0.35, threshold: 0.85 }} vignette={0.55}>
        <CameraRig rig={rig} />
        <ambientLight intensity={0.35} />
        <hemisphereLight args={["#fff6e5", theme.room, 0.5]} />
        <spotLight position={[0, 2.6, 0.2]} angle={0.85} penumbra={0.7} intensity={28} decay={1.6} castShadow shadow-mapSize={[1024, 1024]} shadow-bias={-0.0002} color="#fff3dc" />
        <directionalLight position={[1.5, 3, 1]} intensity={0.6} />
        <Table theme={theme} kitchen={game.state.kitchen && game.state.ballInHand} zone={game.trick?.goal.cueZone ?? null} targetPockets={game.trick?.goal.pockets ? Object.values(game.trick.goal.pockets) : undefined} />
        <Remount id={`balls-${round}-${trickResult ? 1 : 0}`}>
          <Balls game={game} />
        </Remount>
        <CueStick game={game} />
        <AimGuide game={game} />
        <PlacementRing game={game} valid={placeValid} />
        <BilliardsController game={game} rig={rig} accent={theme.glow ?? "#ffd166"} placeValid={placeValid} paused={overlay === "pause"} />
      </GameCanvas>

      <BilliardsHud
        game={game}
        onPause={() => setOverlay("pause")}
        onReset={mode === "practice" ? () => setRound((r) => r + 1) : mode === "trick" ? () => game.retryTrick() : undefined}
        title={mode === "trick" ? game.trick?.name : mode === "practice" ? "Practice" : undefined}
        subtitle={mode === "trick" ? `${game.trick?.hint} · Attempt ${game.attempts + 1}` : mode === "practice" ? "No rules — just shoot" : undefined}
      />
      <PopupLayer />

      <PauseMenu
        open={overlay === "pause"}
        restartLabel={restartLabel}
        onResume={() => setOverlay("none")}
        onRestart={() => {
          setOverlay("none");
          if (mode === "trick") game.retryTrick();
          else setRound((r) => r + 1);
        }}
        onQuit={onExit}
      />

      <AnimatePresence>
        {overlay === "over" && over && (
          <motion.div className={overlayBackdrop} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="absolute inset-0 bg-black/45 backdrop-blur-sm" />
            <GameCard className="text-center">
              <Trophy className="mx-auto text-[#ffd166]" size={44} />
              <div className="mt-1 font-display text-4xl font-bold">{over.title}</div>
              {over.sub && <div className="mt-1 text-white/70">{over.sub}</div>}
              <div className="mt-5 grid grid-cols-3 gap-2">
                <StatBox label={`${game.players[0].name} pots`} value={game.stats.pots[0]} />
                <StatBox label="Best streak" value={game.stats.bestStreak} />
                <StatBox label="Fouls" value={game.stats.fouls[0]} />
              </div>
              <div className="mt-6 flex gap-2.5">
                <Button variant="glass" block onClick={onExit} sound="back">
                  <Home size={18} /> Menu
                </Button>
                <Button
                  block
                  onClick={() => {
                    setOverlay("none");
                    setOver(null);
                    setRound((r) => r + 1);
                  }}
                >
                  <RotateCcw size={18} /> Rematch
                </Button>
              </div>
            </GameCard>
          </motion.div>
        )}
        {overlay === "trick" && trickResult && (
          <motion.div className={overlayBackdrop} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
            <GameCard className="text-center">
              <div className="text-sm font-semibold uppercase tracking-[0.25em] text-white/60">Trick shot</div>
              <div className="mt-1 font-display text-3xl font-bold">{game.trick?.name}</div>
              <div className="mt-4 flex justify-center">
                <Stars count={trickResult.stars} size={44} animate />
              </div>
              <p className="mt-3 text-white/70">{game.attempts === 1 ? "First try. Legendary." : `Done in ${game.attempts} attempts.`}</p>
              <div className="mt-6 flex flex-col gap-2.5">
                {nextTrick && (
                  <Button size="lg" block sound="whoosh" onClick={() => onNavigate("trick", { id: nextTrick.id })}>
                    Next: {nextTrick.name} <ArrowRight size={18} />
                  </Button>
                )}
                <div className="flex gap-2.5">
                  <Button
                    variant="glass"
                    block
                    onClick={() => {
                      setOverlay("none");
                      setTrickResult(null);
                      game.attempts = 0;
                      game.retryTrick();
                    }}
                  >
                    <RotateCcw size={18} /> Again
                  </Button>
                  <Button variant="glass" block onClick={onExit} sound="back">
                    <Home size={18} /> Menu
                  </Button>
                </div>
              </div>
            </GameCard>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function StatBox({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl bg-white/[0.07] px-2 py-2.5">
      <div className="font-display text-2xl font-bold">{value}</div>
      <div className="truncate text-[11px] font-semibold uppercase tracking-wider text-white/60">{label}</div>
    </div>
  );
}
