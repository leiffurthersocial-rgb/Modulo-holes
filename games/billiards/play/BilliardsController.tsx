"use client";
import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { TUNING } from "@/config/tuning";
import { attachGestures } from "@/engine/input/gestures";
import { CameraRigState } from "@/engine/camera/rig";
import { sfx } from "@/engine/audio/audio";
import { addTrauma, cameraPunch, emitParticles, haptic, hitStop, slowMo, tickTime } from "@/engine/juice";
import { L, POCKETS, R, W } from "../sim/physics";
import { ballColor } from "../sim/racks";
import type { BilliardsGame } from "./game";
import { useBilliardsHud } from "./hudStore";

const J = TUNING.billiards.juice;

export function BilliardsController({ game, rig, accent, placeValid, paused }: { game: BilliardsGame; rig: CameraRigState; accent: string; placeValid: React.RefObject<boolean>; paused: boolean }) {
  const gl = useThree((s) => s.gl);
  const get = useThree((s) => s.get);
  const size = useThree((s) => s.size);
  const local = useRef({ slowMoDone: false, cueCamTimer: 0, zoom: 1, flash: [] as number[], hudKey: "", snapped: false });
  const flashRefs = useRef<(THREE.PointLight | null)[]>([]);

  // ---- input ----
  useEffect(() => {
    const ray = new THREE.Raycaster();
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -R);
    const hit = new THREE.Vector3();
    let mode: "none" | "aim" | "place" | "rotate" = "none";
    const toTable = (x: number, y: number) => {
      const { camera, size: sz } = get();
      ray.setFromCamera(new THREE.Vector2((x / sz.width) * 2 - 1, -(y / sz.height) * 2 + 1), camera);
      return ray.ray.intersectPlane(plane, hit);
    };
    const human = () => !game.isAiTurn() && game.phase === "aim";
    return attachGestures(gl.domElement, {
      onDragStart: (d) => {
        if (!human() || paused) return;
        const p = toTable(d.x, d.y);
        const cueCam = useBilliardsHud.getState().cueCam;
        if (p && game.canPlaceCue() && Math.hypot(p.x - game.cue.x, p.z - game.cue.z) < 0.09) {
          mode = "place";
          haptic("tick");
          return;
        }
        if (cueCam) {
          mode = "rotate";
          return;
        }
        mode = "aim";
        if (p) aimAt(p.x, p.z);
      },
      onDragMove: (d) => {
        if (mode === "none") return;
        if (mode === "rotate") {
          const a = Math.atan2(game.aim.dz, game.aim.dx) + d.dx * 0.0022;
          game.aim = { dx: Math.cos(a), dz: Math.sin(a) };
          return;
        }
        const p = toTable(d.x, d.y);
        if (!p) return;
        if (mode === "place") {
          const ok = game.placeCue(p.x, p.z);
          placeValid.current = ok;
        } else aimAt(p.x, p.z);
      },
      onDragEnd: () => {
        if (mode === "place") {
          placeValid.current = true;
          sfx.play("tick");
          game.aimAtNearest();
        }
        mode = "none";
      },
      onPinch: (s) => (local.current.zoom = THREE.MathUtils.clamp(local.current.zoom / s, 0.5, 1.4)),
      onWheel: (dy) => (local.current.zoom = THREE.MathUtils.clamp(local.current.zoom * (1 + dy * 0.001), 0.5, 1.4)),
    });

    function aimAt(x: number, z: number) {
      const dx = x - game.cue.x, dz = z - game.cue.z;
      const l = Math.hypot(dx, dz);
      if (l < 0.01) return;
      const prev = Math.atan2(game.aim.dz, game.aim.dx);
      game.aim = { dx: dx / l, dz: dz / l };
      if (Math.abs(Math.atan2(dz, dx) - prev) > 0.03) sfx.play("tick");
    }
  }, [gl, get, game, placeValid, paused]);

  // ---- per frame ----
  useFrame((_, rawDt) => {
    const realDt = Math.min(rawDt, 1 / 20);
    const dt = tickTime(realDt);
    if (!paused) game.update(dt);

    // Juice from physics events.
    if (game.strikes.length) {
      for (const p of game.strikes) {
        sfx.play("cueStrike", { intensity: p });
        haptic(p > 0.8 ? "medium" : "light");
        if (game.state.breakShot || p > 0.85) cameraPunch(0.2);
      }
      game.strikes.length = 0;
      local.current.slowMoDone = false;
      local.current.cueCamTimer = 0;
    }
    const deciding = game.decidingBall();
    for (const e of game.events) {
      if (e.type === "ball") {
        const k = Math.min(1, e.speed / 3);
        sfx.play("ballClick", { intensity: 0.15 + k * 0.85, pan: (e.x / (L / 2)) * 0.6 });
        if (e.speed > 2.2) emitParticles({ kind: "spark", position: [e.x, R, e.z], count: 6, speed: 0.8, spread: 1, colors: ["#ffffff"], size: 0.18, life: 0.35 });
        if (e.speed > 4 && game.shotTime < 0.25) {
          // The break!
          addTrauma(J.breakShake);
          cameraPunch(0.45);
          hitStop(0.05);
          haptic("heavy");
        } else if (e.speed > 1.5) haptic("tick");
      } else if (e.type === "cushion") {
        sfx.play("cushion", { intensity: Math.min(1, e.speed / 2.5), pan: (e.x / (L / 2)) * 0.6 });
      } else if (e.type === "pocket") {
        const p = POCKETS[e.pocket];
        sfx.play("pocket");
        emitParticles({ kind: "ring", position: [p.x, 0.02, p.z], count: 18, speed: 0.5, colors: [e.ball === 0 ? "#ffffff" : ballColor(e.ball), "#ffffff"], size: 0.2, life: 0.6 });
        emitParticles({ kind: "star", position: [p.x, 0.05, p.z], count: 14, speed: 0.6, spread: 0.6, colors: [accent, "#ffffff"], size: 0.2, life: 0.7 });
        addTrauma(J.potShake);
        haptic(e.ball === 0 ? "fail" : "medium");
        local.current.flash[e.pocket] = 1;
        if (e.ball !== 0 && (e.ball === 8 || e.ball === 9) && e.ball === deciding) {
          emitParticles({ kind: "confetti", position: [p.x, 0.05, p.z], count: 120, speed: 2.2, spread: 0.4, size: 0.25 });
        }
      }
    }
    game.events.length = 0;

    // Slow-mo on the game-deciding ball nearing a pocket.
    if (game.phase === "rolling" && deciding !== null && !local.current.slowMoDone) {
      const b = game.balls.find((x) => x.id === deciding && x.onTable && x.moving);
      if (b) {
        for (const p of POCKETS) {
          const dx = p.x - b.x, dz = p.z - b.z;
          const d = Math.hypot(dx, dz);
          const sp = Math.hypot(b.vx, b.vz);
          if (d < 0.3 && sp > 0.15 && (dx * b.vx + dz * b.vz) / (d * sp) > 0.9) {
            slowMo(J.finalSlowMo, J.finalSlowMoDuration);
            local.current.slowMoDone = true;
            break;
          }
        }
      }
    }

    // Pocket flashes.
    flashRefs.current.forEach((l, i) => {
      if (!l) return;
      const f = (local.current.flash[i] ?? 0) * 0.9;
      local.current.flash[i] = Math.max(0, f - realDt * 1.5);
      l.intensity = f * 0.9;
    });

    // Camera.
    const hud = useBilliardsHud.getState();
    const d = rig.desired;
    const aspect = size.width / size.height;
    const portrait = aspect < 1;
    const cueCam = hud.cueCam && (game.phase === "aim" || game.phase === "ai" || (game.phase === "rolling" && local.current.cueCamTimer < 0.6));
    if (game.phase === "rolling") local.current.cueCamTimer += realDt;
    if (cueCam && game.cue.onTable) {
      d.target.set(game.cue.x + game.aim.dx * 0.25, R, game.cue.z + game.aim.dz * 0.25);
      d.yaw = Math.atan2(game.aim.dx, game.aim.dz);
      d.pitch = 0.3;
      d.distance = 0.85 * local.current.zoom;
      d.fov = 50;
    } else {
      // Overhead framing: long axis along the screen's long axis.
      const fovV = (46 * Math.PI) / 180;
      const extentLong = L + 0.42, extentShort = W + 0.42;
      const vis = portrait ? [extentShort, extentLong] : [extentLong, extentShort];
      const needV = vis[1] / (2 * Math.tan(fovV / 2));
      const needH = vis[0] / (2 * Math.tan(fovV / 2) * aspect);
      d.target.set(0, 0, portrait ? 0.03 : 0.05);
      d.yaw = portrait ? Math.PI / 2 : Math.PI;
      d.pitch = 1.32;
      d.distance = Math.max(needV, needH) * (portrait ? 1.08 : 1.16) * local.current.zoom;
      d.fov = 46;
    }
    if (!local.current.snapped) {
      rig.snap();
      local.current.snapped = true;
    }

    // Mirror the bits the HUD needs (cheap equality check first).
    const st = game.state;
    const key = `${game.phase}|${st.turn}|${st.groups}|${st.onTable.length}|${st.ballInHand}|${game.aiStage === "think"}|${game.streak}`;
    if (key !== local.current.hudKey) {
      local.current.hudKey = key;
      hud.set({ phase: game.phase, turn: st.turn, groups: [...st.groups] as typeof st.groups, onTable: [...st.onTable], ballInHand: st.ballInHand, kitchen: st.kitchen, aiThinking: game.phase === "ai" && game.aiStage === "think", streak: game.streak });
    }
  });

  return (
    <group>
      {POCKETS.map((p, i) => (
        <pointLight key={i} ref={(el) => void (flashRefs.current[i] = el)} position={[p.x, 0.15, p.z]} color={accent} intensity={0} distance={0.45} decay={2} />
      ))}
    </group>
  );
}
