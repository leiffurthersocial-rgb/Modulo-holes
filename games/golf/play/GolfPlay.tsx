"use client";
/**
 * Golf play screen: owns the round (campaign / quick / daily / pass-and-play), creates a
 * GolfSim per turn, and wires the 3D scene, HUD and overlays together.
 */
import { use, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PlayProps } from "@/games/types";
import { loadRapier } from "@/engine/physics/rapier";
import { GameCanvas } from "@/engine/render/GameCanvas";
import { CameraRig } from "@/engine/camera/CameraRig";
import { CameraRigState } from "@/engine/camera/rig";
import { PopupLayer } from "@/engine/juice/PopupLayer";
import { popup, resetTime, resetShake, usePopups } from "@/engine/juice";
import { sfx } from "@/engine/audio/audio";
import { TUNING } from "@/config/tuning";
import { GolfSim } from "../sim/GolfSim";
import { CourseView } from "../view/CourseView";
import { Environment } from "../view/Environment";
import { Ball } from "../view/Ball";
import { AimView } from "../view/AimView";
import { createAim } from "../view/aimState";
import { GolfController, type HoledInfo } from "./GolfController";
import { Hud } from "./Hud";
import { DailySummary, IntroBanner, PassCard, PauseMenu, ResultsCard, Scorecard, type ResultsData } from "./Overlays";
import { useGolfHud } from "./hudStore";
import { makeRound, randomHole, type Round } from "./round";
import { useGolfSave, totalStars } from "../save";
import { scoreName, starsFor } from "../scoring";
import { getSkin } from "../skins";

type Overlay = "none" | "results" | "pass" | "scorecard" | "daily" | "pause";

export default function GolfPlay({ entryId, params, onExit }: PlayProps) {
  const R = use(loadRapier());
  const [round, setRound] = useState<Round>(() => makeRound(entryId, params, totalStars(useGolfSave.getState().holes)));
  const [holeIdx, setHoleIdx] = useState(0);
  const [player, setPlayer] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const [scores, setScores] = useState<(number | null)[][]>(() => round.players.map(() => round.holes.map(() => null)));
  const [overlay, setOverlay] = useState<Overlay>(round.mode === "party" ? "pass" : "none");
  const [results, setResults] = useState<ResultsData | null>(null);
  const [streak, setStreak] = useState(0);
  const [daily, setDaily] = useState<{ strokes: number[]; stars: number[]; newBest: boolean; best: number | null }>({ strokes: [], stars: [], newBest: false, best: null });
  const skinId = useGolfSave((s) => s.skin);
  const tutorialDone = useGolfSave((s) => s.tutorialDone);
  const pendingTimer = useRef<number | null>(null);

  const ref = round.holes[holeIdx];
  const { world, hole } = ref;
  const sessionKey = `${holeIdx}:${player}:${attempt}:${hole.id}`;

  const sim = useMemo(() => {
    const s = new GolfSim(R, hole, world.theme.below);
    s.tag = sessionKey;
    return s;
  }, [R, hole, world, sessionKey]);
  const rig = useMemo(() => new CameraRigState({ fov: TUNING.golf.camera.fov }), []);
  const aim = useMemo(() => createAim(), []);

  useEffect(() => {
    sim.retain();
    useGolfHud.getState().set({ strokes: 0, phase: "aim", coins: 0, overview: false, aiming: false, power: 0 });
    resetTime();
    resetShake();
    usePopups.getState().clear();
    return () => sim.release();
  }, [sim]);

  useEffect(() => sfx.setMood(world.mood), [world.mood]);
  useEffect(() => () => {
    if (pendingTimer.current) window.clearTimeout(pendingTimer.current);
  }, []);

  const later = (fn: () => void, ms: number) => {
    if (pendingTimer.current) window.clearTimeout(pendingTimer.current);
    pendingTimer.current = window.setTimeout(fn, ms);
  };

  // ---------------------------------------------------------------- hole finished
  const finishHole = useCallback(
    (strokes: number, info: HoledInfo | null, pickedUp: boolean) => {
      const par = hole.par;
      const stars = starsFor(strokes, par, pickedUp);
      const coins = info?.coins ?? [...sim.collected];

      // Celebration text.
      const combo: string[] = [];
      if (info) {
        if (info.bounceIn) combo.push("Bounce-in");
        if (info.railHits >= 3) combo.push("Pinball wizard");
        else if (info.railHits >= 1) combo.push("Bank shot");
        if (info.teleported) combo.push("Warp speed");
        if (info.bounced) combo.push("Sky hook");
        if (info.longPutt) combo.push("Long bomb");
        if (info.speed > 9) combo.push("Slam dunk");
        if (coins.length === hole.coins?.length && coins.length > 0) combo.push("Coin sweep");
        const sn = scoreName(strokes, par);
        const hype = strokes === 1 ? "UNREAL!" : sn.tone === "great" ? "NICE!" : combo.length ? "SWEET!" : undefined;
        popup({ text: sn.label, sub: [hype, ...combo.slice(0, 2)].filter(Boolean).join(" · "), style: sn.tone === "legend" || sn.tone === "great" ? "hero" : "big", color: sn.tone === "legend" ? "#ffd166" : sn.tone === "great" ? "#7cf29b" : "#ffffff" }, 1.6);
      } else {
        popup({ text: "Picked up", sub: `Stroke cap ${TUNING.golf.strokeCap}`, style: "bad" }, 1.4);
      }

      const newStreak = strokes < par && !pickedUp ? streak + 1 : 0;
      setStreak(newStreak);

      if (round.mode === "party") {
        setScores((sc) => sc.map((row, p) => (p === player ? row.map((v, h) => (h === holeIdx ? strokes : v)) : row)));
        later(() => {
          if (player + 1 < round.players.length) {
            setPlayer(player + 1);
            setAttempt(0);
            setOverlay("pass");
          } else setOverlay("scorecard");
        }, 1800);
        return;
      }

      const save = useGolfSave.getState();
      const rec = save.recordHole(hole.id, strokes, stars, coins);
      if (strokes === 1) save.addHoleInOne();
      if (round.mode === "campaign") {
        const next = ref.index + 1 < world.holes.length ? ref.index + 1 : ref.index;
        save.setLast(world.id, next);
      }
      if (!save.tutorialDone) save.markTutorialDone();
      if (rec.newStars > 0) window.setTimeout(() => sfx.play("unlock"), 1900);

      if (round.mode === "daily") {
        const strokesArr = [...daily.strokes];
        strokesArr[holeIdx] = strokes;
        const starsArr = [...daily.stars];
        starsArr[holeIdx] = stars;
        const last = holeIdx === round.holes.length - 1;
        let newBest = false;
        let best: number | null = null;
        if (last) {
          const toPar = strokesArr.reduce((a, s) => a + s, 0) - round.holes.reduce((a, h) => a + h.hole.par, 0);
          best = save.daily[round.date!] ?? null;
          newBest = save.recordDaily(round.date!, toPar);
        }
        setDaily({ strokes: strokesArr, stars: starsArr, newBest, best });
      }

      setResults({ strokes, par, stars, coins: coins.length, coinsTotal: hole.coins?.length ?? 0, combo, newBest: rec.newBest && attempt + holeIdx >= 0, pickedUp, streak: newStreak });
      later(() => setOverlay("results"), pickedUp ? 900 : 1900);
    },
    [hole, sim, round, player, holeIdx, streak, daily, ref, world, attempt],
  );

  const onHoled = useCallback((info: HoledInfo) => finishHole(info.strokes, info, false), [finishHole]);
  const onRest = useCallback(() => {
    if (sim.strokes >= TUNING.golf.strokeCap && sim.phase === "aim") {
      sim.phase = "holed";
      finishHole(TUNING.golf.strokeCap, null, true);
    }
  }, [sim, finishHole]);

  // ---------------------------------------------------------------- navigation
  const restart = () => {
    if (pendingTimer.current) window.clearTimeout(pendingTimer.current);
    setOverlay("none");
    setResults(null);
    setAttempt((a) => a + 1);
  };

  const nextHole = () => {
    if (pendingTimer.current) window.clearTimeout(pendingTimer.current);
    setResults(null);
    if (round.mode === "quick") {
      const nh = randomHole(totalStars(useGolfSave.getState().holes), hole.id);
      setRound((r) => ({ ...r, holes: [...r.holes, nh] }));
      setHoleIdx((i) => i + 1);
      setOverlay("none");
      return;
    }
    if (round.mode === "daily" && holeIdx === round.holes.length - 1) {
      setOverlay("daily");
      return;
    }
    if (holeIdx + 1 >= round.holes.length) {
      onExit();
      return;
    }
    setHoleIdx((i) => i + 1);
    setAttempt(0);
    setPlayer(0);
    setOverlay(round.mode === "party" ? "pass" : "none");
  };

  const nextLabel = (() => {
    if (round.mode === "quick") return "Another hole";
    if (round.mode === "daily") return holeIdx === round.holes.length - 1 ? "See results" : `Hole ${holeIdx + 2} of ${round.holes.length}`;
    if (holeIdx + 1 >= round.holes.length) return "Finish world";
    return "Next hole";
  })();

  const partyContinue = () => {
    const lastHole = holeIdx === round.holes.length - 1;
    if (lastHole) {
      // Rematch.
      setScores(round.players.map(() => round.holes.map(() => null)));
      setHoleIdx(0);
      setPlayer(0);
      setAttempt((a) => a + 1);
      setOverlay("pass");
    } else nextHole();
  };

  const passGo = () => setOverlay("none");

  const theme = world.theme;
  const skin = getSkin(skinId);
  const holeNumber = ref.index + 1;
  const inputEnabled = overlay === "none";

  return (
    <div className="absolute inset-0">
      <GameCanvas bloom={{ intensity: theme.bloom }} vignette={0.38}>
        <CameraRig rig={rig} />
        <Environment built={sim.built} theme={theme} world={world.id} />
        <CourseView key={sessionKey} built={sim.built} theme={theme} sim={sim} isCandy={world.id === "candy"} />
        <Ball sim={sim} skin={skin} trailColor={theme.glowEdges ? theme.accent : "#ffffff"} />
        <AimView sim={sim} aim={aim} />
        <GolfController
          key={sessionKey}
          sim={sim}
          rig={rig}
          aim={aim}
          accent={theme.accent}
          inputEnabled={inputEnabled}
          paused={overlay === "pause"}
          onHoled={onHoled}
          onRest={onRest}
        />
      </GameCanvas>

      <Hud
        holeNumber={holeNumber}
        holeName={hole.name}
        par={hole.par}
        coinsTotal={hole.coins?.length ?? 0}
        player={round.mode === "party" ? round.players[player] : undefined}
        showHint={!tutorialDone && overlay === "none"}
        onPause={() => setOverlay("pause")}
        onRestart={restart}
      />
      <PopupLayer />
      <IntroBannerTimed key={`intro-${holeIdx}-${player}`} number={holeNumber} name={hole.name} par={hole.par} tip={hole.tip} worldName={world.name} active={overlay === "none"} />

      <ResultsCard open={overlay === "results"} data={results} nextLabel={nextLabel} onNext={nextHole} onRetry={restart} onMenu={onExit} />
      <PassCard open={overlay === "pass"} player={round.players[player] ?? null} holeNumber={holeNumber} onGo={passGo} />
      <Scorecard
        open={overlay === "scorecard"}
        title={`After hole ${holeIdx + 1}`}
        players={round.players}
        scores={scores}
        pars={round.holes.map((h) => h.hole.par)}
        final={holeIdx === round.holes.length - 1}
        onContinue={partyContinue}
        onMenu={onExit}
      />
      <DailySummary
        open={overlay === "daily"}
        toPar={daily.strokes.reduce((a, s) => a + s, 0) - round.holes.reduce((a, h) => a + h.hole.par, 0)}
        best={daily.best}
        isNewBest={daily.newBest}
        stars={Math.round(daily.stars.reduce((a, s) => a + s, 0) / Math.max(1, daily.stars.length))}
        onMenu={onExit}
        onRetry={() => {
          setDaily({ strokes: [], stars: [], newBest: false, best: null });
          setHoleIdx(0);
          setAttempt((a) => a + 1);
          setOverlay("none");
        }}
      />
      <PauseMenu
        open={overlay === "pause"}
        onResume={() => setOverlay("none")}
        onRestart={restart}
        onQuit={onExit}
      />
    </div>
  );
}

/** Hole intro card that shows itself for a moment whenever it (re)mounts. */
function IntroBannerTimed(props: { number: number; name: string; par: number; tip?: string; worldName: string; active: boolean }) {
  const [show, setShow] = useState(true);
  useEffect(() => {
    const id = window.setTimeout(() => setShow(false), 2300);
    return () => window.clearTimeout(id);
  }, []);
  return <IntroBanner show={show && props.active} number={props.number} name={props.name} par={props.par} tip={props.tip} worldName={props.worldName} />;
}
