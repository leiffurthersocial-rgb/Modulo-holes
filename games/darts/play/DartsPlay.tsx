"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Home, RotateCcw, Trophy } from "lucide-react";
import type * as THREE from "three";
import type { PlayProps } from "@/games/types";
import { GameCanvas } from "@/engine/render/GameCanvas";
import { CameraRig } from "@/engine/camera/CameraRig";
import { CameraRigState } from "@/engine/camera/rig";
import { PopupLayer } from "@/engine/juice/PopupLayer";
import { popup, resetShake, resetTime, usePopups } from "@/engine/juice";
import { sfx } from "@/engine/audio/audio";
import { Button, Stars } from "@/components/ui";
import { PauseMenu } from "@/components/ui/PauseMenu";
import { GameCard, overlayBackdrop } from "@/components/ui/GameCard";
import { DartsGame, type DMode, type DPlayer, type DartsEvent } from "./game";
import { DartsRoom, Darts, Reticle } from "./BoardView";
import { DartsController } from "./DartsController";
import { DartsHud } from "./Hud";
import { getBoardTheme, getFlight } from "../themes";
import { useDartsSave, unlockedNames } from "../save";
import { CHALLENGES, challengeStars } from "../sim/challenges";
import type { AiLevel } from "../sim/ai";
import type { DartsMode } from "../sim/rules";

type Overlay = "none" | "pause" | "over" | "challenge";
const LEVEL_NAMES: Record<AiLevel, string> = { easy: "Rookie", medium: "Shark", hard: "Pro" };
const COLORS = ["#ff5d5d", "#4cc9f0"];

export default function DartsPlay({ entryId, params, onExit, onNavigate }: PlayProps) {
  const mode = (["ai", "local", "clock", "challenge", "practice"].includes(entryId) ? entryId : "ai") as DMode;
  const gameType: DartsMode = params.game === "cricket" ? "cricket" : "x01";
  const start = params.game === "301" ? 301 : 501;
  const level: AiLevel = params.level === "easy" || params.level === "hard" ? params.level : "medium";
  const legs = params.legs === "3" ? 2 : 1;
  const themeId = useDartsSave((s) => s.theme);
  const flightId = useDartsSave((s) => s.flight);
  const theme = getBoardTheme(themeId);
  const flight = getFlight(flightId);
  const [round, setRound] = useState(0);
  const [overlay, setOverlay] = useState<Overlay>("none");
  const [result, setResult] = useState<{ title: string; won: boolean } | null>(null);
  const [feedback, setFeedback] = useState<{ text: string; key: number } | null>(null);
  const [throws, setThrows] = useState(0);
  const boardRef = useRef<THREE.Group>(null);

  const game = useMemo(() => {
    const players: DPlayer[] =
      mode === "ai"
        ? [{ name: "You", ai: null, color: COLORS[0] }, { name: `${LEVEL_NAMES[level]} AI`, ai: level, color: COLORS[1] }]
        : mode === "local"
          ? [{ name: params.p1 || "Player 1", ai: null, color: COLORS[0] }, { name: params.p2 || "Player 2", ai: null, color: COLORS[1] }]
          : [{ name: "You", ai: null, color: COLORS[0] }];
    void round;
    return new DartsGame({
      mode,
      game: mode === "clock" ? "clock" : mode === "practice" ? "practice" : gameType,
      start,
      doubleOut: true,
      legsToWin: mode === "ai" || mode === "local" ? legs : 1,
      players,
      challengeId: params.id,
    });
  }, [mode, level, gameType, start, legs, params.p1, params.p2, params.id, round]);
  const rig = useMemo(() => new CameraRigState({ pitch: 0, yaw: Math.PI, distance: 1.4, fov: 40 }), []);

  useEffect(() => {
    sfx.setMood("pub");
    resetTime();
    resetShake();
    usePopups.getState().clear();
    if (game.challenge) popup({ text: game.challenge.name, sub: game.challenge.hint, style: "small" }, 2.6);
    else if (mode === "clock") popup({ text: "Around the Clock", sub: "1 → 20, then the bull", style: "big" }, 2);
    else if (mode !== "practice") popup({ text: gameType === "cricket" ? "Cricket" : `${start}`, sub: `${game.current.name} to throw first${gameType === "x01" ? " · double out" : ""}`, style: "big" }, 2);
  }, [game, mode, gameType, start]);

  const onEvent = useCallback(
    (e: DartsEvent) => {
      const save = useDartsSave.getState();
      const humans = game.players.map((p, i) => (p.ai ? -1 : i)).filter((i) => i >= 0);
      if (e.type === "throw" && e.quality !== "ai") setThrows((t) => t + 1);
      if (e.type === "hit" && humans.includes(game.match.turn) && e.outcome.hit.number === 25) save.addStats({ bulls: 1 });
      if (e.type === "turnEnd" && humans.includes(e.player) && e.total === 180) save.addStats({ oneEighties: 1 });
      if (e.type === "legWon" && humans.includes(e.player) && e.checkout) save.addStats({ checkout: e.checkout });
      if (e.type === "challenge" && e.ok) {
        const stars = challengeStars(game.attempts);
        const before = unlockedNames(save);
        save.recordChallenge(game.challenge!.id, stars);
        announce(before);
        sfx.play("bigFanfare");
        popup({ text: "NAILED IT!", sub: game.attempts === 1 ? "First try!" : `${game.attempts} attempts`, style: "hero", color: "#ffd166" }, 1.8);
        window.setTimeout(() => setOverlay("challenge"), 1700);
      } else if (e.type === "challenge") {
        popup({ text: "So close!", sub: "Try again", style: "bad" }, 1.1);
      }
      if (e.type === "matchWon") {
        const winner = e.player;
        const before = unlockedNames(save);
        let title: string;
        let won = true;
        if (mode === "clock") {
          const darts = game.match.stats[0].darts;
          const best = save.recordClock(darts);
          title = best ? `New best: ${darts} darts!` : `${darts} darts`;
        } else if (mode === "ai") {
          won = winner === 0;
          save.recordMatch(won, level, game.match.average(0));
          title = won ? "You win!" : `${game.players[1].name} wins`;
        } else {
          title = `${game.players[winner].name} wins!`;
          save.recordMatch(true, null, Math.max(...game.players.map((_, i) => game.match.average(i))));
        }
        if (!won) sfx.play("foul");
        announce(before);
        setResult({ title, won });
        window.setTimeout(() => setOverlay("over"), 2300);
      }
    },
    [game, mode, level],
  );

  useEffect(() => {
    game.listeners.add(onEvent);
    return () => {
      game.listeners.delete(onEvent);
    };
  }, [game, onEvent]);

  const onFlickFeedback = useCallback((q: string) => {
    const text = q === "flick" ? "Flick up to throw!" : q === "soft" ? "Too soft — it dropped" : q === "hard" ? "Too hard — it flew high" : "Perfect release!";
    setFeedback({ text, key: Date.now() });
    window.setTimeout(() => setFeedback((f) => (f && f.text === text ? null : f)), 1200);
  }, []);

  const challengeIdx = CHALLENGES.findIndex((c) => c.id === game.challenge?.id);
  const nextChallenge = CHALLENGES[challengeIdx + 1];
  const stats = game.match.stats;

  return (
    <div className="absolute inset-0" style={{ background: theme.wallColor }}>
      <GameCanvas bloom={{ intensity: theme.wall === "neon" ? 1 : 0.35, threshold: 0.85 }} vignette={0.5}>
        <CameraRig rig={rig} />
        <DartsRoom theme={theme} boardRef={boardRef} />
        <Darts game={game} flight={flight} />
        <Reticle game={game} color={theme.wall === "candy" ? "#7c4dff" : "#ffffff"} />
        <DartsController game={game} rig={rig} boardRef={boardRef} paused={overlay !== "none"} theme={theme} onFlickFeedback={onFlickFeedback} />
      </GameCanvas>

      <DartsHud game={game} onPause={() => setOverlay("pause")} feedback={feedback} showHint={throws < 2} />
      <PopupLayer />

      <PauseMenu
        open={overlay === "pause"}
        restartLabel={mode === "challenge" ? "Restart challenge" : "Restart match"}
        onResume={() => setOverlay("none")}
        onRestart={() => {
          setOverlay("none");
          setRound((r) => r + 1);
        }}
        onQuit={onExit}
      />

      <AnimatePresence>
        {overlay === "over" && result && (
          <motion.div className={overlayBackdrop} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="absolute inset-0 bg-black/45 backdrop-blur-sm" />
            <GameCard className="text-center">
              <Trophy className={`mx-auto ${result.won ? "text-[#ffd166]" : "text-white/40"}`} size={44} />
              <div className="mt-1 font-display text-3xl font-bold">{result.title}</div>
              {mode === "clock" ? (
                <div className="mt-3 flex justify-center">
                  <Stars count={stats[0].darts <= 30 ? 3 : stats[0].darts <= 45 ? 2 : 1} size={40} animate />
                </div>
              ) : (
                <div className="mt-5 grid grid-cols-3 gap-2">
                  <StatBox label="3-dart avg" value={game.match.average(0).toFixed(1)} />
                  <StatBox label="Best turn" value={String(stats[0].bestTurn)} />
                  <StatBox label={gameType === "cricket" ? "Darts" : "180s"} value={String(gameType === "cricket" ? stats[0].darts : stats[0].oneEighties)} />
                </div>
              )}
              <div className="mt-6 flex gap-2.5">
                <Button variant="glass" block onClick={onExit} sound="back">
                  <Home size={18} /> Menu
                </Button>
                <Button
                  block
                  onClick={() => {
                    setOverlay("none");
                    setResult(null);
                    setRound((r) => r + 1);
                  }}
                >
                  <RotateCcw size={18} /> {mode === "clock" ? "Again" : "Rematch"}
                </Button>
              </div>
            </GameCard>
          </motion.div>
        )}
        {overlay === "challenge" && game.challenge && (
          <motion.div className={overlayBackdrop} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
            <GameCard className="text-center">
              <div className="text-sm font-semibold uppercase tracking-[0.25em] text-white/60">Challenge</div>
              <div className="mt-1 font-display text-3xl font-bold">{game.challenge.name}</div>
              <div className="mt-4 flex justify-center">
                <Stars count={challengeStars(game.attempts)} size={44} animate />
              </div>
              <p className="mt-3 text-white/70">{game.attempts === 1 ? "First try. Ice cold." : `Done in ${game.attempts} attempts.`}</p>
              <div className="mt-6 flex flex-col gap-2.5">
                {nextChallenge && (
                  <Button size="lg" block sound="whoosh" onClick={() => onNavigate("challenge", { id: nextChallenge.id })}>
                    Next: {nextChallenge.name} <ArrowRight size={18} />
                  </Button>
                )}
                <div className="flex gap-2.5">
                  <Button
                    variant="glass"
                    block
                    onClick={() => {
                      setOverlay("none");
                      setRound((r) => r + 1);
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

/** Pop a notice for boards / flights that just unlocked. */
function announce(before: string[]) {
  const after = unlockedNames(useDartsSave.getState());
  after
    .filter((n) => !before.includes(n))
    .forEach((n, i) =>
      window.setTimeout(() => {
        sfx.play("unlock");
        popup({ text: "Unlocked!", sub: n, style: "big", color: "#ffd166", y: 14 }, 2.2);
      }, 2500 + i * 1400),
    );
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white/[0.07] px-2 py-2.5">
      <div className="font-display text-2xl font-bold">{value}</div>
      <div className="truncate text-[11px] font-semibold uppercase tracking-wider text-white/60">{label}</div>
    </div>
  );
}
