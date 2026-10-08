"use client";
import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { TUNING } from "@/config/tuning";
import { CameraRigState } from "@/engine/camera/rig";
import { sfx } from "@/engine/audio/audio";
import { addTrauma, cameraPunch, emitParticles, haptic, popup, slowMo, tickTime, PALETTE_CONFETTI } from "@/engine/juice";
import type { DartsGame } from "./game";

const D = TUNING.darts;
const H = D.boardHeight;

interface Props {
  game: DartsGame;
  rig: CameraRigState;
  boardRef: React.RefObject<THREE.Group | null>;
  paused: boolean;
  theme: { red: string; green: string; dark: string; light: string };
  onFlickFeedback: (q: string) => void;
}

export function DartsController({ game, rig, boardRef, paused, theme, onFlickFeedback }: Props) {
  const gl = useThree((s) => s.gl);
  const get = useThree((s) => s.get);
  const local = useRef({ shake: 0, snapped: false });
  const fb = useRef(onFlickFeedback);
  useEffect(() => {
    fb.current = onFlickFeedback;
  });

  // ---------------- input: hold to aim, flick up to throw ----------------
  useEffect(() => {
    const el = gl.domElement;
    const ray = new THREE.Raycaster();
    const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
    const hit = new THREE.Vector3();
    let active: number | null = null;
    let samples: { t: number; x: number; y: number; ax: number; ay: number }[] = [];
    let locked = false;
    let startAim = { x: 0, y: 0 };
    let startWorld = { x: 0, y: 0 };
    let touchOffset = 0;

    const toBoard = (px: number, py: number) => {
      const { camera, size } = get();
      ray.setFromCamera(new THREE.Vector2((px / size.width) * 2 - 1, -(py / size.height) * 2 + 1), camera);
      const p = ray.ray.intersectPlane(plane, hit);
      return p ? { x: p.x, y: p.y - H } : null;
    };
    const rel = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    const clampAim = (a: { x: number; y: number }) => {
      const r = Math.hypot(a.x, a.y), max = 0.3;
      return r > max ? { x: (a.x / r) * max, y: (a.y / r) * max } : a;
    };

    const down = (e: PointerEvent) => {
      if (paused || game.phase !== "aim" || active !== null) return;
      active = e.pointerId;
      try {
        el.setPointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      const p = rel(e);
      // Touch: the reticle sits above the finger so you can see what you're aiming at.
      touchOffset = e.pointerType === "touch" ? 80 : 0;
      const w = toBoard(p.x, p.y - touchOffset);
      if (w) {
        game.aim = clampAim(w);
        startAim = { ...game.aim };
        startWorld = w;
      }
      samples = [{ t: performance.now(), x: p.x, y: p.y, ax: game.aim.x, ay: game.aim.y }];
      locked = false;
      game.holding = true;
      game.holdTime = 0;
      haptic("tick");
    };

    const move = (e: PointerEvent) => {
      if (e.pointerId !== active) return;
      const p = rel(e);
      const now = performance.now();
      const { size } = get();
      const prev = samples[samples.length - 1];
      // A fast upward motion means the flick has started: freeze the aim.
      const segV = (prev.y - p.y) / size.height / Math.max(0.004, (now - prev.t) / 1000);
      if (segV > 0.9) locked = true;
      if (!locked) {
        const w = toBoard(p.x, p.y - touchOffset);
        // Fine aim: the reticle follows the finger at 60% speed for precision.
        if (w) game.aim = clampAim({ x: startAim.x + (w.x - startWorld.x) * 0.6, y: startAim.y + (w.y - startWorld.y) * 0.6 });
      }
      samples.push({ t: now, x: p.x, y: p.y, ax: game.aim.x, ay: game.aim.y });
      if (samples.length > 40) samples.shift();
    };

    const up = (e: PointerEvent) => {
      if (e.pointerId !== active) return;
      active = null;
      const { size } = get();
      const now = performance.now();
      const p = rel(e);
      const last = samples[samples.length - 1];
      if (p.x !== last.x || p.y !== last.y) samples.push({ t: now, x: p.x, y: p.y, ax: last.ax, ay: last.ay });
      if (e.type === "pointercancel") {
        game.holding = false;
        return;
      }
      // Walk back to where the final upward swipe began (robust to sparse/uneven events).
      let i = samples.length - 1;
      while (i > 0) {
        const a = samples[i - 1], b = samples[i];
        const v = (a.y - b.y) / size.height / Math.max(0.004, (b.t - a.t) / 1000);
        if (a.y <= b.y || v < 0.35) break;
        i--;
      }
      const end = samples[samples.length - 1];
      // Measure over at most the last 140ms of the swipe.
      let s0 = i;
      while (s0 < samples.length - 2 && end.t - samples[s0].t > 140) s0++;
      const a = samples[s0];
      const dt = Math.max(0.008, (end.t - a.t) / 1000);
      const vy = (a.y - end.y) / size.height / dt;
      const vx = (end.x - a.x) / size.height / dt;
      // Aim where the reticle was before the flick started moving it.
      game.aim = { x: samples[i].ax, y: samples[i].ay };
      if (!game.flick(vx, vy)) fb.current("flick");
      else fb.current(game.lastQuality ?? "perfect");
    };

    el.addEventListener("pointerdown", down);
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
    return () => {
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
    };
  }, [gl, get, game, paused]);

  // ---------------- frame ----------------
  useFrame(({ size }, rawDt) => {
    const realDt = Math.min(rawDt, 1 / 20);
    const dt = tickTime(realDt);
    if (!paused) game.update(dt, realDt);

    for (const e of game.events) {
      switch (e.type) {
        case "throw":
          sfx.play("dartThrow", { intensity: 0.7 });
          haptic("light");
          if (e.deciding) slowMo(D.juice.checkoutSlowMo, D.juice.checkoutSlowMoTime);
          break;
        case "bounce":
          sfx.play("dartWire");
          popup({ text: "BOUNCE OUT!", style: "bad", y: 22 }, 1.1);
          emitParticles({ kind: "spark", position: [e.dart.x, H + e.dart.y, 0.02], count: 10, speed: 0.8, spread: 1, colors: ["#ffffff", "#cfd8e3"], size: 0.15, life: 0.4 });
          haptic("fail");
          break;
        case "hit": {
          const { hit } = e.outcome;
          const d = e.dart;
          if (d.state === "bouncing") break;
          const pos: [number, number, number] = [d.x, H + d.y, 0.01];
          if (!hit.onBoard) {
            sfx.play("dartWall");
            popup({ text: "MISS", style: "bad", y: 22 }, 0.9);
            addTrauma(0.05);
            break;
          }
          const big = hit.multiplier === 3 || hit.number === 25;
          sfx.play("dartHit", { intensity: 0.8, pitch: hit.label === "BULL" ? 12 : big ? 7 : 0 });
          local.current.shake = Math.min(1, local.current.shake + (big ? 0.9 : 0.55));
          addTrauma(big ? 0.12 : D.juice.hitShake);
          cameraPunch(big ? 0.18 : 0.06);
          haptic(big ? "medium" : "tick");
          emitParticles({ kind: "dust", position: pos, count: 8, speed: 0.35, spread: 1, colors: [theme.dark, theme.light, "#c9b38a"], size: 0.12, life: 0.5, gravity: -1 });
          if (big) emitParticles({ kind: "ring", position: pos, count: 18, speed: 0.35, colors: [hit.multiplier === 3 ? theme.green : theme.red, "#ffffff"], size: 0.12, life: 0.45 });
          if (e.outcome.bust) {
            sfx.play("foul");
            popup({ text: "BUST", sub: "score reset", style: "bad", y: 22 }, 1.3);
            haptic("fail");
            break;
          }
          if (game.mode === "clock") {
            if (e.outcome.advanced) popup({ text: "✓", sub: hit.label, style: "big", color: "#7cf29b", y: 20 }, 0.7);
            break;
          }
          if (hit.label === "BULL") {
            popup({ text: "BULLSEYE!", style: "hero", color: "#ff5d5d", y: 20 }, 1.1);
            emitParticles({ kind: "star", position: pos, count: 22, speed: 0.6, spread: 1, colors: ["#ffd166", "#ffffff", theme.red], size: 0.14, life: 0.7 });
          } else if (game.match.cfg.mode === "cricket" && e.outcome.marks > 0) {
            popup({ text: hit.label, sub: e.outcome.scored ? `+${e.outcome.scored}` : `${e.outcome.marks} mark${e.outcome.marks > 1 ? "s" : ""}`, style: big ? "big" : "small", y: 22 }, 0.8);
          } else {
            popup({ text: hit.label, style: big ? "big" : "small", color: hit.multiplier === 3 ? "#7cf29b" : hit.multiplier === 2 ? "#ff8a8a" : "#ffffff", y: 22 }, 0.8);
          }
          break;
        }
        case "turnEnd": {
          if (e.bust || game.mode === "clock" || game.challenge) break;
          const t = e.total;
          if (t === 180) {
            popup({ text: "180!", sub: "ONE HUNDRED AND EIGHTY", style: "hero", color: "#ffd166" }, 2.4);
            sfx.play("bigFanfare");
            sfx.play("crowd");
            addTrauma(D.juice.bigShake);
            cameraPunch(1);
            haptic("celebrate");
            for (const sx of [-0.5, 0.5]) emitParticles({ kind: "confetti", position: [sx, H + 0.3, 0.3], count: 110, speed: 2.4, spread: 0.5, direction: [-sx, 1, 0.3], size: 0.3 });
          } else if (t >= 140) {
            popup({ text: "TON-FORTY!", sub: `${t}`, style: "big", color: "#ffd166" }, 1.4);
            sfx.play("crowdSmall");
            sfx.play("fanfare");
            haptic("success");
          } else if (t >= 100) {
            popup({ text: "TON!", sub: `${t}`, style: "big", color: "#7cf29b" }, 1.3);
            sfx.play("crowdSmall");
          } else if (game.match.cfg.mode === "x01" || game.mode === "practice") {
            popup({ text: `${t}`, style: "small", y: 30 }, 0.9);
          }
          break;
        }
        case "legWon":
          popup({ text: "GAME SHOT!", sub: e.checkout ? `${e.checkout} checkout` : game.players[e.player].name, style: "hero", color: "#ffd166" }, 2);
          sfx.play("bigFanfare");
          sfx.play("crowd");
          cameraPunch(0.8);
          addTrauma(0.4);
          haptic("celebrate");
          emitParticles({ kind: "confetti", position: [0, H + 0.2, 0.3], count: 180, speed: 2.6, spread: 0.6, size: 0.3, colors: PALETTE_CONFETTI });
          break;
        default:
          break;
      }
    }
    game.events.length = 0;

    // Board shake (decaying wobble on impact).
    const b = boardRef.current;
    if (b) {
      local.current.shake = Math.max(0, local.current.shake - realDt * 4);
      const s = local.current.shake;
      const t = performance.now() / 1000;
      b.position.set(Math.sin(t * 61) * 0.0012 * s, H + Math.sin(t * 47) * 0.0012 * s, 0);
      b.rotation.z = Math.sin(t * 53) * 0.004 * s;
    }

    // Camera: frame the board (and its number ring) for any aspect ratio.
    const aspect = size.width / size.height;
    const fov = 40;
    const t2 = Math.tan(((fov / 2) * Math.PI) / 180);
    const needW = 0.53 / (2 * t2 * aspect);
    const needH = 0.82 / (2 * t2);
    const d = rig.desired;
    d.target.set(0, H - 0.04, 0);
    // Slightly off-axis and from above, so stuck darts read in 3D.
    d.yaw = Math.PI + 0.09;
    d.pitch = 0.07;
    d.fov = fov;
    d.distance = Math.max(needW, needH);
    if (!local.current.snapped) {
      rig.snap();
      local.current.snapped = true;
    }
  });

  return null;
}
