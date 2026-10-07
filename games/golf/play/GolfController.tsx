"use client";
/**
 * In-canvas controller: steps the simulation on a fixed clock, translates pointer gestures
 * into aiming / camera orbit, drives the camera rig, and turns sim events into juice
 * (sound, particles, shake, hit-stop, slow-mo, haptics, popups).
 */
import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { TUNING } from "@/config/tuning";
import { FixedStepper } from "@/engine/physics/stepper";
import { attachGestures } from "@/engine/input/gestures";
import { CameraRigState } from "@/engine/camera/rig";
import { sfx } from "@/engine/audio/audio";
import { addTrauma, cameraPunch, emitParticles, haptic, hitStop, popup, slowMo, tickTime, PALETTE_CONFETTI } from "@/engine/juice";
import type { GolfEvent, GolfSim } from "../sim/GolfSim";
import type { AimState } from "../view/aimState";
import { useGolfHud } from "./hudStore";

const G = TUNING.golf;

export interface HoledInfo {
  strokes: number;
  bounceIn: boolean;
  railHits: number;
  teleported: boolean;
  bounced: boolean;
  longPutt: boolean;
  speed: number;
  coins: number[];
}

interface Props {
  sim: GolfSim;
  rig: CameraRigState;
  aim: AimState;
  accent: string;
  /** Freeze input (pause menu, overlays). */
  inputEnabled: boolean;
  /** Freeze the simulation (pause menu). */
  paused?: boolean;
  onHoled: (info: HoledInfo) => void;
  onRest: () => void;
  onShot?: () => void;
}

export function GolfController({ sim, rig, aim, accent, inputEnabled, paused = false, onHoled, onRest, onShot }: Props) {
  const gl = useThree((s) => s.gl);
  const get = useThree((s) => s.get);
  const stepper = useMemo(() => new FixedStepper(1 / G.physicsHz, G.maxSubSteps), []);
  const view = useRef<{ yaw: number; pitch: number; distance: number; holedSpin: number; slowMoShot: number; lastPowerStep: number }>({ yaw: 0, pitch: G.camera.pitch, distance: G.camera.distance, holedSpin: 0, slowMoShot: -1, lastPowerStep: -1 });
  const enabled = useRef(inputEnabled);
  const cbs = useRef({ onHoled, onRest, onShot });

  useEffect(() => {
    enabled.current = inputEnabled;
    cbs.current = { onHoled, onRest, onShot };
  });

  // Initial camera: behind the ball looking at the cup.
  useEffect(() => {
    const [cx, , cz] = sim.built.def.cup;
    const yaw = Math.atan2(cx - sim.ballPos.x, cz - sim.ballPos.z);
    view.current.yaw = yaw;
    view.current.distance = G.camera.distance;
    view.current.pitch = G.camera.pitch;
    // Start with a sweeping fly-in from above the cup.
    rig.desired.target.copy(sim.ballPos);
    rig.desired.yaw = yaw;
    rig.desired.pitch = G.camera.pitch;
    rig.desired.distance = G.camera.distance;
    rig.desired.fov = G.camera.fov;
    rig.current.target.set(cx, sim.ballPos.y, cz);
    rig.current.yaw = yaw + 0.6;
    rig.current.pitch = 1.1;
    rig.current.distance = 18;
    rig.current.fov = G.camera.fov;
    rig.rates = { target: 3, yaw: 3, pitch: 3, distance: 2.6, fov: 5 };
    const id = window.setTimeout(() => (rig.rates = { target: 7, yaw: 5, pitch: 4, distance: 4, fov: 6 }), 1200);
    return () => window.clearTimeout(id);
  }, [sim, rig]);

  // ---------------- input ----------------
  useEffect(() => {
    const el = gl.domElement;
    const ray = new THREE.Raycaster();
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const hit = new THREE.Vector3();
    const startW = new THREE.Vector3();
    let mode: "none" | "aim" | "orbit" = "none";

    const toWorld = (x: number, y: number, out: THREE.Vector3) => {
      const { camera, size } = get();
      ray.setFromCamera(new THREE.Vector2((x / size.width) * 2 - 1, -(y / size.height) * 2 + 1), camera);
      plane.constant = -sim.ballPos.y;
      return ray.ray.intersectPlane(plane, out);
    };
    const ballScreen = () => {
      const { camera, size } = get();
      const v = sim.ballPos.clone().project(camera);
      return { x: ((v.x + 1) / 2) * size.width, y: ((1 - v.y) / 2) * size.height };
    };
    const maxDrag = () => {
      const { size } = get();
      return Math.max(130, Math.min(G.shot.maxDragPx, Math.min(size.width, size.height) * 0.36));
    };

    return attachGestures(el, {
      onDragStart: (d) => {
        if (!enabled.current) return;
        const b = ballScreen();
        const near = Math.hypot(d.x - b.x, d.y - b.y) < G.shot.grabRadiusPx;
        if (near && sim.canShoot() && d.button === 0 && !useGolfHud.getState().overview) {
          mode = "aim";
          if (!toWorld(d.x, d.y, startW)) startW.copy(sim.ballPos);
          aim.active = true;
          aim.cancelled = false;
          aim.power = 0;
          aim.dragX = sim.ballPos.x;
          aim.dragZ = sim.ballPos.z;
          view.current.lastPowerStep = -1;
          useGolfHud.getState().set({ aiming: true, power: 0 });
          haptic("tick");
        } else {
          mode = "orbit";
        }
      },
      onDragMove: (d) => {
        if (mode === "orbit") {
          const v = view.current;
          v.yaw -= d.dx * G.camera.orbitSensitivity;
          v.pitch = THREE.MathUtils.clamp(v.pitch + d.dy * G.camera.orbitSensitivity * 0.8, 0.2, 1.38);
          return;
        }
        if (mode !== "aim") return;
        const dragPx = Math.hypot(d.x - d.startX, d.y - d.startY);
        const cur = toWorld(d.x, d.y, hit);
        if (cur) {
          const dx = startW.x - cur.x, dz = startW.z - cur.z;
          if (Math.hypot(dx, dz) > 0.01) {
            aim.dirX = dx;
            aim.dirZ = dz;
          }
          // Band end: behind the ball by drag amount.
          const l = Math.hypot(aim.dirX, aim.dirZ) || 1;
          const back = Math.min(2.4, (dragPx / maxDrag()) * 2.4);
          aim.dragX = sim.ballPos.x - (aim.dirX / l) * back;
          aim.dragZ = sim.ballPos.z - (aim.dirZ / l) * back;
        }
        aim.power = Math.min(1, dragPx / maxDrag());
        aim.cancelled = dragPx < G.shot.cancelDragPx;
        const step = Math.floor(aim.power * 10);
        if (step !== view.current.lastPowerStep) {
          view.current.lastPowerStep = step;
          sfx.play("aim", { intensity: aim.power });
          if (step === 10) haptic("light");
          else haptic("tick");
        }
        useGolfHud.getState().set({ power: aim.power });
      },
      onDragEnd: (_d, cancelled) => {
        if (mode === "aim") {
          const fire = !cancelled && !aim.cancelled && aim.power > 0.02 && enabled.current;
          aim.active = false;
          useGolfHud.getState().set({ aiming: false, power: 0 });
          if (fire && sim.shoot(aim.dirX, aim.dirZ, aim.power)) {
            cbs.current.onShot?.();
          }
        }
        mode = "none";
      },
      onPinch: (s) => {
        view.current.distance = THREE.MathUtils.clamp(view.current.distance / s, G.camera.minDistance, G.camera.maxDistance);
      },
      onWheel: (dy) => {
        view.current.distance = THREE.MathUtils.clamp(view.current.distance * (1 + dy * 0.0012), G.camera.minDistance, G.camera.maxDistance);
      },
    });
  }, [gl, get, sim, aim]);

  // ---------------- events → juice ----------------
  const handle = (e: GolfEvent) => {
    const p = sim.ballPos;
    switch (e.type) {
      case "shot":
        sfx.play("putt", { intensity: 0.3 + e.power * 0.7 });
        haptic(e.power > 0.75 ? "medium" : "light");
        emitParticles({ kind: "dust", position: [p.x, p.y - 0.15, p.z], count: 6 + Math.round(e.power * 10), speed: 1.5, spread: 1, colors: ["#ffffff"] });
        if (e.power > 0.8) {
          addTrauma(0.12 * e.power);
          cameraPunch(0.25);
        }
        break;
      case "impact":
        if (e.surface === "floor") {
          sfx.play("bounce", { intensity: Math.min(1, e.speed / 12) });
          if (e.speed > 4) emitParticles({ kind: "dust", position: e.pos, count: 8, speed: 1.6, spread: 1, colors: ["#ffffff"] });
          if (e.speed > 8) addTrauma(0.08);
        } else if (e.surface === "cup") {
          sfx.play("cupRattle");
        } else {
          sfx.play("rail", { intensity: Math.min(1, e.speed / 14) });
          if (e.speed > 6) emitParticles({ kind: "spark", position: e.pos, count: 10, speed: 4, spread: 1, colors: ["#ffffff", accent] });
          if (e.speed > 10) {
            addTrauma(0.12);
            haptic("light");
          } else haptic("tick");
        }
        break;
      case "bumper":
        sfx.play("bumper", { intensity: Math.min(1, e.speed / 15) });
        emitParticles({ kind: "spark", position: e.pos, count: 22, speed: 6, spread: 1, colors: [accent, "#ffffff", "#ffd166"] });
        addTrauma(0.22);
        hitStop(0.045);
        haptic("medium");
        break;
      case "boost":
        sfx.play("boost");
        emitParticles({ kind: "spark", position: e.pos, count: 26, speed: 5, spread: 0.5, direction: [-sim.ballVel.x, 0.5, -sim.ballVel.z], colors: [accent, "#ffffff"] });
        cameraPunch(0.35);
        addTrauma(0.1);
        haptic("light");
        break;
      case "bouncePad":
        sfx.play("boing");
        emitParticles({ kind: "ring", position: e.pos, count: 24, speed: 4, colors: [accent, "#ffffff"] });
        addTrauma(0.15);
        haptic("medium");
        break;
      case "teleport":
        sfx.play("teleport");
        emitParticles({ kind: "star", position: [e.from[0], e.from[1] + 0.3, e.from[2]], count: 20, speed: 3, spread: 1, colors: ["#b388ff", accent, "#ffffff"] });
        emitParticles({ kind: "star", position: [e.to[0], e.to[1] + 0.3, e.to[2]], count: 26, speed: 3.5, spread: 1, colors: ["#b388ff", accent, "#ffffff"] });
        cameraPunch(0.4);
        haptic("light");
        break;
      case "coin":
        sfx.play("coin");
        emitParticles({ kind: "star", position: e.pos, count: 22, speed: 3.5, spread: 1, colors: ["#ffd166", "#ffffff", "#ffb300"] });
        popup({ text: "+1", sub: "coin", style: "coin", color: "#ffd166", y: 18 }, 0.9);
        haptic("success");
        useGolfHud.getState().set({ coins: sim.collected.size });
        break;
      case "hazard":
        if (e.kind === "water") {
          sfx.play("splash");
          emitParticles({ kind: "splash", position: [e.pos[0], e.pos[1] + 0.1, e.pos[2]], count: 40, speed: 6, spread: 0.45, colors: ["#ffffff", "#bfe9ff", "#7fd0ff"] });
          emitParticles({ kind: "ring", position: [e.pos[0], e.pos[1] + 0.05, e.pos[2]], count: 18, speed: 2.5, colors: ["#ffffff"] });
          popup({ text: "SPLASH!", sub: `+${G.surfaces.hazardPenalty} stroke`, style: "bad", color: "#7fd0ff" });
        } else {
          sfx.play("whoosh");
          popup({ text: "OUT!", sub: `+${G.surfaces.hazardPenalty} stroke`, style: "bad" });
        }
        addTrauma(0.3);
        haptic("fail");
        break;
      case "reset":
        emitParticles({ kind: "star", position: [e.pos[0], e.pos[1] + 0.2, e.pos[2]], count: 14, speed: 2, spread: 1, colors: ["#ffffff", accent] });
        sfx.play("tick");
        break;
      case "gate":
        sfx.play("gate");
        break;
      case "holed": {
        const info: HoledInfo = {
          strokes: e.strokes,
          bounceIn: e.bounceIn,
          railHits: sim.shot.railHits,
          teleported: sim.shot.teleported,
          bounced: sim.shot.bounced,
          longPutt: sim.shot.startPos.distanceTo(new THREE.Vector3(...e.pos)) > 8,
          speed: e.speed,
          coins: [...sim.collected],
        };
        sfx.play("cupDrop");
        hitStop(0.07);
        addTrauma(e.strokes === 1 ? G.celebration.holeInOneShake : G.celebration.shake);
        cameraPunch(1);
        haptic("celebrate");
        const [cx, cy, cz] = e.pos;
        emitParticles({ kind: "confetti", position: [cx, cy + 0.2, cz], count: e.strokes === 1 ? G.celebration.confetti * 1.5 : G.celebration.confetti, speed: 9, spread: 0.35 });
        emitParticles({ kind: "ring", position: [cx, cy + 0.1, cz], count: 32, speed: 5, colors: ["#ffffff", accent] });
        emitParticles({ kind: "star", position: [cx, cy + 0.3, cz], count: 30, speed: 5, spread: 0.7, colors: PALETTE_CONFETTI });
        window.setTimeout(() => sfx.play(e.strokes === 1 ? "bigFanfare" : "fanfare"), 180);
        cbs.current.onHoled(info);
        break;
      }
      case "rest":
        cbs.current.onRest();
        break;
      case "kicked":
        break;
    }
  };

  // ---------------- per-frame ----------------
  const tmpV = useMemo(() => new THREE.Vector3(), []);
  useFrame((_, rawDt) => {
    const realDt = Math.min(rawDt, 1 / 20);
    const dt = tickTime(realDt);
    if (!paused) stepper.advance(dt, (h) => sim.step(h));
    for (const e of sim.drainEvents()) handle(e);

    const hud = useGolfHud.getState();
    if (hud.phase !== sim.phase || hud.strokes !== sim.strokes) hud.set({ phase: sim.phase, strokes: sim.strokes });

    // Slow-mo when the ball is about to drop (once per shot).
    const dCup = sim.distanceToCup();
    const hs = Math.hypot(sim.ballVel.x, sim.ballVel.z);
    if (sim.phase === "moving" && dCup < 1.1 && hs > 0.6 && hs < G.cup.captureMaxSpeed && view.current.slowMoShot !== sim.strokes) {
      const [cx, , cz] = sim.built.def.cup;
      const heading = ((cx - sim.ballPos.x) * sim.ballVel.x + (cz - sim.ballPos.z) * sim.ballVel.z) / (dCup * hs + 1e-6);
      if (heading > 0.8) {
        view.current.slowMoShot = sim.strokes;
        slowMo(sim.strokes === 1 ? 0.22 : 0.4, sim.strokes === 1 ? 0.9 : 0.5);
      }
    }

    // Camera.
    const v = view.current;
    const d = rig.desired;
    const [cx, cy, cz] = sim.built.def.cup;
    if (hud.overview) {
      const { min, max } = sim.built.bounds;
      d.target.set((min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2);
      d.distance = Math.max(max[0] - min[0], max[2] - min[2]) * 1.05 + 6;
      d.pitch = 1.2;
      d.yaw = v.yaw;
    } else if (sim.phase === "holed") {
      v.holedSpin += realDt * 0.35;
      d.target.set(cx, cy + 0.2, cz);
      d.distance = 4.6;
      d.pitch = 0.55;
      d.yaw = v.yaw + v.holedSpin;
    } else {
      v.holedSpin = 0;
      tmpV.copy(sim.ballPos);
      let dist = v.distance;
      let pitch = v.pitch;
      if (sim.phase === "moving" && dCup < G.camera.zoomNearCupDistance) {
        // Dramatic zoom: frame ball and cup together, pull in tight.
        const k = 1 - dCup / G.camera.zoomNearCupDistance;
        tmpV.lerp(new THREE.Vector3(cx, cy, cz), 0.45 * k);
        dist = v.distance * (1 - (1 - G.camera.zoomNearCupScale) * k);
        pitch = v.pitch + 0.1 * k;
      }
      if (sim.phase !== "hazard") d.target.copy(tmpV).add(new THREE.Vector3(0, 0.25, 0));
      d.distance = dist;
      d.pitch = pitch;
      d.yaw = v.yaw;
    }
  });

  return null;
}
