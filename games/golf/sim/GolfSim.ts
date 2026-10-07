/**
 * GolfSim — the golf rules + physics core, independent of React and rendering.
 *
 * Ball model (tuned for feel, not realism):
 *  - Rapier handles collisions (frictionless, rotation-locked sphere with CCD).
 *  - We apply our own rolling resistance *relative to the ground's surface velocity*, which
 *    makes moving platforms, tilting decks and conveyor belts carry the ball naturally.
 *  - Surface zones (sand, ice, boost, conveyor), bounce pads, teleporters, coins, the cup
 *    and hazards are resolved analytically each fixed step.
 *
 * The same class drives the in-browser game and the headless course verifier.
 */
import * as THREE from "three";
import type RAPIER_T from "@dimforge/rapier3d-compat";
import { TUNING } from "@/config/tuning";
import type { CourseTheme, V3 } from "../courses/types";
import { buildHole, pointInPoly, type BuiltHole, type KinematicDef } from "./build";

type R = typeof RAPIER_T;
const G = TUNING.golf;
const UP = new THREE.Vector3(0, 1, 0);

export type GolfPhase = "aim" | "moving" | "hazard" | "holed";

export type GolfEvent =
  | { type: "shot"; power: number }
  | { type: "impact"; surface: "floor" | "wall" | "cup"; speed: number; pos: V3 }
  | { type: "bumper"; index: number; pos: V3; speed: number }
  | { type: "boost"; pos: V3 }
  | { type: "bouncePad"; index: number; pos: V3 }
  | { type: "teleport"; from: V3; to: V3 }
  | { type: "coin"; index: number; pos: V3 }
  | { type: "hazard"; kind: "water" | "void"; pos: V3 }
  | { type: "reset"; pos: V3 }
  | { type: "gate"; index: number }
  | { type: "holed"; bounceIn: boolean; speed: number; strokes: number; pos: V3 }
  | { type: "rest"; pos: V3 }
  | { type: "kicked" };

interface KinState {
  def: KinematicDef;
  body: RAPIER_T.RigidBody;
  pos: THREE.Vector3;
  quat: THREE.Quaternion;
  prevPos: THREE.Vector3;
  prevQuat: THREE.Quaternion;
  linVel: THREE.Vector3;
  angVel: THREE.Vector3;
}

export interface SimSnapshot {
  world: Uint8Array;
  t: number;
  phase: GolfPhase;
  strokes: number;
  penalties: number;
  restPos: THREE.Vector3;
  collected: number[];
  kin: { pos: THREE.Vector3; quat: THREE.Quaternion }[];
}

export interface GroundInfo {
  normal: THREE.Vector3;
  /** Surface velocity at the contact point. */
  velocity: THREE.Vector3;
  kinematic: boolean;
}

export class GolfSim {
  readonly R: R;
  readonly built: BuiltHole;
  world: RAPIER_T.World;
  ball: RAPIER_T.RigidBody;
  private ballCol: RAPIER_T.Collider;
  private floorCol: RAPIER_T.Collider | null = null;
  private events = new Array<GolfEvent>();
  private queue: RAPIER_T.EventQueue;
  private bumperHandles = new Map<number, number>();
  private gateHandles = new Map<number, number>();
  private kinByCollider = new Map<number, KinState>();
  readonly kin: KinState[] = [];
  private hooks: RAPIER_T.PhysicsHooks;
  /** Ball velocity captured before each step for use inside physics hooks. */
  private hookVel = new THREE.Vector3();
  private belowWater: CourseTheme["below"] | null;

  phase: GolfPhase = "aim";
  /** Free-form identifier (session key) — handy for debugging. */
  tag = "";
  t = 0;
  strokes = 0;
  penalties = 0;
  readonly ballPos = new THREE.Vector3();
  readonly ballVel = new THREE.Vector3();
  readonly restPos = new THREE.Vector3();
  collected = new Set<number>();
  ground: GroundInfo | null = null;
  /** Seconds since the ball last touched anything. */
  airTime = 0;
  gateOpen: number[] = [];
  bumperPulse: number[] = [];
  padPulse: number[] = [];
  /** Per-shot trick flags for celebration text. */
  shot = { railHits: 0, bumpers: 0, teleported: false, bounced: false, boosted: false, maxAir: 0, startPos: new THREE.Vector3(), time: 0 };
  restTimer = 0;
  private hazardTimer = 0;
  private teleportCooldown = 0;
  private inBoost = new Set<number>();
  private padCooldown: number[] = [];

  constructor(Rapier: R, built: BuiltHole | Parameters<typeof buildHole>[0], below: CourseTheme["below"] | null = null) {
    this.R = Rapier;
    this.built = "physicsMesh" in built ? built : buildHole(built, { skirtBottom: below ? (below.kind === "water" ? below.y - 0.3 : -2.2) : undefined });
    this.belowWater = below;
    const b = this.built;
    const world = new Rapier.World({ x: 0, y: G.gravity, z: 0 });
    world.timestep = 1 / G.physicsHz;
    world.numSolverIterations = 6;
    this.world = world;
    this.queue = new Rapier.EventQueue(true);

    // ----- static trimesh (floors, ramps, cup, tracks) -----
    if (b.physicsMesh.indices.length) {
      // Snap to a 0.1mm grid so shared seams merge exactly → no internal-edge bumps.
      const verts = new Float32Array(b.physicsMesh.positions.map((v) => Math.round(v * 1e4) / 1e4));
      const idx = new Uint32Array(b.physicsMesh.indices);
      const desc = Rapier.ColliderDesc.trimesh(verts, idx, Rapier.TriMeshFlags.FIX_INTERNAL_EDGES_TWO_SIDED)
        .setFriction(0)
        .setRestitution(G.surfaces.floorRestitution)
        .setRestitutionCombineRule(Rapier.CoefficientCombineRule.Max);
      this.floorCol = world.createCollider(desc);
    }

    // ----- boxes (rails, blocks, windmill body) -----
    for (const box of b.boxes) {
      const d = Rapier.ColliderDesc.cuboid(...box.half)
        .setTranslation(...box.center)
        .setRotation({ x: box.quat[0], y: box.quat[1], z: box.quat[2], w: box.quat[3] })
        .setFriction(0)
        .setRestitution(box.role === "rail" ? G.surfaces.railRestitution : 0.55)
        .setRestitutionCombineRule(Rapier.CoefficientCombineRule.Max);
      world.createCollider(d);
    }

    // ----- bumpers -----
    b.bumpers.forEach((bp, i) => {
      const c = world.createCollider(
        Rapier.ColliderDesc.cylinder(0.4, bp.r)
          .setTranslation(bp.at[0], bp.at[1] + 0.4, bp.at[2])
          .setRestitution(G.surfaces.bumperRestitution)
          .setRestitutionCombineRule(Rapier.CoefficientCombineRule.Max)
          .setFriction(0)
          .setActiveEvents(Rapier.ActiveEvents.COLLISION_EVENTS),
      );
      this.bumperHandles.set(c.handle, i);
      this.bumperPulse.push(0);
    });

    // ----- one-way gates -----
    b.gates.forEach((g, i) => {
      const q = new THREE.Quaternion().setFromAxisAngle(UP, -g.yaw);
      const c = world.createCollider(
        Rapier.ColliderDesc.cuboid(g.width / 2, 0.35, 0.05)
          .setTranslation(g.at[0], g.at[1] + 0.35, g.at[2])
          .setRotation(q)
          .setFriction(0)
          .setRestitution(0.4)
          .setActiveHooks(Rapier.ActiveHooks.FILTER_CONTACT_PAIRS),
      );
      this.gateHandles.set(c.handle, i);
      this.gateOpen.push(0);
    });

    // ----- kinematic movers -----
    for (const def of b.kinematics) {
      const pos = new THREE.Vector3();
      const quat = new THREE.Quaternion();
      def.pose(0, pos, quat);
      const body = world.createRigidBody(
        Rapier.RigidBodyDesc.kinematicPositionBased().setTranslation(pos.x, pos.y, pos.z).setRotation(quat),
      );
      const st: KinState = { def, body, pos, quat, prevPos: pos.clone(), prevQuat: quat.clone(), linVel: new THREE.Vector3(), angVel: new THREE.Vector3() };
      for (const s of def.shapes) {
        const cd =
          s.kind === "box" ? Rapier.ColliderDesc.cuboid(...s.half) : Rapier.ColliderDesc.cylinder(s.half[1], s.half[0]);
        cd.setTranslation(...s.offset).setFriction(0).setRestitution(def.kind === "mover" || def.kind === "tilt" ? 0.25 : 0.6);
        if (s.rot) cd.setRotation({ x: s.rot[0], y: s.rot[1], z: s.rot[2], w: s.rot[3] });
        const col = world.createCollider(cd, body);
        this.kinByCollider.set(col.handle, st);
      }
      this.kin.push(st);
    }

    b.bouncePads.forEach(() => {
      this.padPulse.push(0);
      this.padCooldown.push(0);
    });

    // ----- ball -----
    const [tx, ty, tz] = b.def.tee;
    this.ball = world.createRigidBody(
      Rapier.RigidBodyDesc.dynamic()
        .setTranslation(tx, ty + G.ball.radius + 0.01, tz)
        .lockRotations()
        .setCcdEnabled(true)
        .setCanSleep(false),
    );
    this.ballCol = world.createCollider(
      Rapier.ColliderDesc.ball(G.ball.radius)
        .setMass(G.ball.mass)
        .setFriction(0)
        .setFrictionCombineRule(Rapier.CoefficientCombineRule.Min)
        .setRestitution(G.ball.restitution)
        .setRestitutionCombineRule(Rapier.CoefficientCombineRule.Max)
        .setActiveEvents(Rapier.ActiveEvents.COLLISION_EVENTS),
      this.ball,
    );
    this.syncBall();
    this.restPos.copy(this.ballPos);

    // One-way gate filter: let the ball through when travelling with the gate direction.
    this.hooks = {
      filterContactPair: (c1, c2) => {
        const gi = this.gateHandles.get(c1) ?? this.gateHandles.get(c2);
        if (gi === undefined) return Rapier.SolverFlags.COMPUTE_IMPULSE;
        const g = this.built.gates[gi];
        // NB: never touch Rapier bodies inside hooks (the world is borrowed during step).
        const v = this.hookVel;
        const along = v.x * g.dir[0] + v.z * g.dir[1];
        // Also allow when the ball is already past the gate plane on the "forward" side.
        return along > -0.3 ? null : Rapier.SolverFlags.COMPUTE_IMPULSE;
      },
      filterIntersectionPair: () => true,
    };
  }

  private refs = 0;
  private disposeTimer: ReturnType<typeof setTimeout> | null = null;
  private disposed = false;

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.queue.free();
    this.world.free();
  }

  /** Ref-counted lifetime for React effects (survives StrictMode's mount→unmount→mount). */
  retain() {
    this.refs++;
    if (this.disposeTimer) clearTimeout(this.disposeTimer);
    this.disposeTimer = null;
  }

  release() {
    this.refs--;
    if (this.refs <= 0) this.disposeTimer = setTimeout(() => this.dispose(), 50);
  }

  get isDisposed() {
    return this.disposed;
  }

  drainEvents(): GolfEvent[] {
    const e = this.events;
    this.events = [];
    return e;
  }

  private emit(e: GolfEvent) {
    this.events.push(e);
  }

  private syncBall() {
    const p = this.ball.translation();
    const v = this.ball.linvel();
    this.ballPos.set(p.x, p.y, p.z);
    this.ballVel.set(v.x, v.y, v.z);
  }

  /** Shot speed for a 0..1 power value. */
  static shotSpeed(power: number) {
    const p = Math.max(0, Math.min(1, power));
    return G.shot.minSpeed + (G.shot.maxSpeed - G.shot.minSpeed) * Math.pow(p, G.shot.powerCurve);
  }

  canShoot() {
    return this.phase === "aim";
  }

  /** Strike the ball along (dx, dz) with power 0..1. */
  shoot(dx: number, dz: number, power: number) {
    if (this.phase !== "aim") return false;
    const len = Math.hypot(dx, dz) || 1;
    const speed = GolfSim.shotSpeed(power);
    const gv = this.ground?.velocity ?? new THREE.Vector3();
    this.ball.setLinvel({ x: (dx / len) * speed + gv.x, y: 0, z: (dz / len) * speed + gv.z }, true);
    this.strokes++;
    this.phase = "moving";
    this.restTimer = 0;
    this.shot = { railHits: 0, bumpers: 0, teleported: false, bounced: false, boosted: false, maxAir: 0, startPos: this.ballPos.clone(), time: 0 };
    this.restPos.copy(this.ballPos);
    this.emit({ type: "shot", power });
    return true;
  }

  /** Advance one fixed physics step. */
  step(h = 1 / G.physicsHz) {
    if (this.disposed) return;
    this.t += h;
    this.world.timestep = h;

    // ---- kinematics ----
    for (const k of this.kin) {
      k.prevPos.copy(k.pos);
      k.prevQuat.copy(k.quat);
      k.def.pose(this.t, k.pos, k.quat);
      k.linVel.subVectors(k.pos, k.prevPos).divideScalar(h);
      // Angular velocity from quaternion delta.
      const dq = k.quat.clone().multiply(k.prevQuat.clone().invert());
      if (dq.w < 0) dq.set(-dq.x, -dq.y, -dq.z, -dq.w);
      const angle = 2 * Math.acos(Math.min(1, dq.w));
      const s = Math.sqrt(Math.max(0, 1 - dq.w * dq.w));
      if (s > 1e-6) k.angVel.set(dq.x / s, dq.y / s, dq.z / s).multiplyScalar(angle / h);
      else k.angVel.set(0, 0, 0);
      k.body.setNextKinematicTranslation(k.pos);
      k.body.setNextKinematicRotation(k.quat);
    }

    // Decay visual pulses.
    for (let i = 0; i < this.bumperPulse.length; i++) this.bumperPulse[i] = Math.max(0, this.bumperPulse[i] - h * 4);
    for (let i = 0; i < this.padPulse.length; i++) {
      this.padPulse[i] = Math.max(0, this.padPulse[i] - h * 3);
      this.padCooldown[i] = Math.max(0, this.padCooldown[i] - h);
    }
    this.teleportCooldown = Math.max(0, this.teleportCooldown - h);

    if (this.phase === "holed") {
      this.physicsStep();
      this.queue.drainCollisionEvents(() => {});
      this.syncBall();
      return;
    }

    if (this.phase === "hazard") {
      this.hazardTimer -= h;
      this.physicsStep();
      this.queue.drainCollisionEvents(() => {});
      this.syncBall();
      if (this.hazardTimer <= 0) this.resetToRest();
      return;
    }

    if (this.phase === "aim") {
      this.stepAim();
      return;
    }

    this.stepMoving(h);
  }

  private stepAim() {
    // Resting ball: pinned on static ground, riding along on moving platforms.
    const onKin = this.ground?.kinematic;
    if (!onKin) {
      this.ball.setTranslation({ x: this.restPos.x, y: this.restPos.y, z: this.restPos.z }, true);
      this.ball.setLinvel({ x: 0, y: 0, z: 0 }, true);
    } else {
      // Stick to the platform: match its surface velocity.
      const gv = this.ground!.velocity;
      const v = this.ball.linvel();
      this.ball.setLinvel({ x: gv.x, y: Math.min(v.y, gv.y + 0.5), z: gv.z }, true);
    }
    this.physicsStep();
    this.queue.drainCollisionEvents(() => {});
    this.syncBall();
    this.updateContacts();
    if (onKin) this.restPos.copy(this.ballPos);

    // A sweeper/blade/platform shoved the ball → it starts moving again (no stroke).
    let shoved = false;
    this.world.contactPairsWith(this.ballCol, (other) => {
      const k = this.kinByCollider.get(other.handle);
      if (!k) return;
      this.world.contactPair(this.ballCol, other, (m, flipped) => {
        if (m.numContacts() === 0) return;
        const n = m.normal();
        const ny = flipped ? n.y : -n.y;
        if (ny < 0.5 && k.linVel.lengthSq() + k.angVel.lengthSq() > 0.01) shoved = true;
      });
    });
    if (shoved || this.ballPos.y < this.built.killY) {
      this.phase = "moving";
      this.restTimer = 0;
      this.emit({ type: "kicked" });
    }
  }

  private stepMoving(h: number) {
    const R = G.ball.radius;
    this.shot.time += h;
    const v = this.ball.linvel();
    const vel = new THREE.Vector3(v.x, v.y, v.z);
    const p = this.ballPos;

    // ---- surface model (uses contacts from the previous step) ----
    const ground = this.ground;
    let surface: "grass" | "sand" | "ice" = "grass";
    let conveyor: THREE.Vector3 | null = null;
    for (let zi = 0; zi < this.built.zones.length; zi++) {
      const z = this.built.zones[zi];
      if (Math.abs(p.y - R - z.y) > 0.35 || !pointInPoly(p.x, p.z, z.poly)) {
        if (z.kind === "boost") this.inBoost.delete(zi);
        continue;
      }
      if (z.kind === "sand" || z.kind === "ice") surface = z.kind;
      else if (z.kind === "boost" && z.dir) {
        const d = new THREE.Vector3(z.dir[0], 0, z.dir[1]);
        const along = vel.dot(d);
        const target = z.speed ?? G.surfaces.boostSpeed;
        if (along < target) vel.addScaledVector(d, Math.min(G.surfaces.boostAccel * h, target - along));
        // Bend the ball toward the pad direction.
        const lateral = vel.clone().sub(d.clone().multiplyScalar(vel.dot(d)));
        lateral.y = 0;
        vel.addScaledVector(lateral, -Math.min(1, 6 * h));
        if (!this.inBoost.has(zi)) {
          this.inBoost.add(zi);
          this.shot.boosted = true;
          this.emit({ type: "boost", pos: [p.x, p.y, p.z] });
        }
      } else if (z.kind === "conveyor" && z.dir) {
        conveyor = new THREE.Vector3(z.dir[0] * (z.speed ?? 2), 0, z.dir[1] * (z.speed ?? 2));
      }
    }

    if (ground) {
      const gv = conveyor ?? ground.velocity;
      // Rolling resistance on the velocity relative to the ground, tangent to the contact.
      const rel = vel.clone().sub(gv);
      const n = ground.normal;
      const tan = rel.clone().addScaledVector(n, -rel.dot(n));
      const s = tan.length();
      if (s > 1e-5) {
        const c = G.rolling[surface];
        const ns = Math.max(0, s - (c.constant + c.linear * s) * h);
        vel.addScaledVector(tan, ns / s - 1);
      }
      if (conveyor) {
        // Belts drag the ball toward belt speed.
        const relc = vel.clone().sub(conveyor);
        relc.y = 0;
        vel.addScaledVector(relc, -Math.min(1, G.surfaces.conveyorBlend * h));
      }
    } else {
      vel.multiplyScalar(1 - G.rolling.air.linear * h);
    }

    // ---- cup assist ----
    const [cx, cy, cz] = this.built.def.cup;
    const dxC = cx - p.x, dzC = cz - p.z;
    const dc = Math.hypot(dxC, dzC);
    const hs = Math.hypot(vel.x, vel.z);
    if (ground && dc < G.cup.magnetRadius && dc > 0.02 && hs < G.cup.magnetMaxSpeed && p.y > cy - 0.05) {
      const k = G.cup.magnetStrength * h * (1 - dc / G.cup.magnetRadius);
      vel.x += (dxC / dc) * k;
      vel.z += (dzC / dc) * k;
    }
    if (dc < G.cup.radius - R * 0.35 && hs < G.cup.captureMaxSpeed && p.y < cy + R * 1.2) {
      // Over the hole and not too fast: the back of the cup "catches" it.
      const damp = Math.exp(-10 * h);
      vel.x *= damp;
      vel.z *= damp;
      vel.y = Math.min(vel.y, -1.5);
    }

    this.ball.setLinvel(vel, true);
    const before = vel.clone();

    this.physicsStep();

    // ---- collision events: bumpers ----
    this.queue.drainCollisionEvents((h1, h2, started) => {
      if (!started) return;
      const bi = this.bumperHandles.get(h1) ?? this.bumperHandles.get(h2);
      if (bi === undefined) return;
      const bp = this.built.bumpers[bi];
      const bv = this.ball.linvel();
      const bpos = this.ball.translation();
      const n = new THREE.Vector3(bpos.x - bp.at[0], 0, bpos.z - bp.at[2]).normalize();
      const vv = new THREE.Vector3(bv.x, bv.y, bv.z);
      const vn = vv.dot(n);
      if (vn < G.surfaces.bumperKick) vv.addScaledVector(n, G.surfaces.bumperKick - vn);
      this.ball.setLinvel(vv, true);
      this.bumperPulse[bi] = 1;
      this.shot.bumpers++;
      this.emit({ type: "bumper", index: bi, pos: [bpos.x, bpos.y, bpos.z], speed: vv.length() });
    });

    this.syncBall();
    const touching = this.updateContacts();

    // ---- impact detection from velocity change ----
    const expected = before.clone().add(new THREE.Vector3(0, G.gravity * h, 0));
    const dv = this.ballVel.clone().sub(expected);
    const impact = dv.length();
    if (impact > 1.6) {
      const dir = dv.clone().normalize();
      const nearCup = Math.hypot(this.ballPos.x - cx, this.ballPos.z - cz) < G.cup.radius + 0.1 && this.ballPos.y < cy + 0.1;
      const surf = nearCup ? "cup" : dir.y > 0.6 ? "floor" : "wall";
      if (surf === "wall") this.shot.railHits++;
      this.emit({ type: "impact", surface: surf, speed: impact, pos: [this.ballPos.x, this.ballPos.y, this.ballPos.z] });
    }

    this.airTime = touching ? 0 : this.airTime + h;
    this.shot.maxAir = Math.max(this.shot.maxAir, this.airTime);

    const bp = this.ballPos;

    // ---- bounce pads ----
    this.built.bouncePads.forEach((pad, i) => {
      if (this.padCooldown[i] > 0) return;
      const d = Math.hypot(bp.x - pad.at[0], bp.z - pad.at[2]);
      if (d < pad.r && bp.y - R < pad.at[1] + 0.25 && this.ballVel.y < 2) {
        this.ball.setLinvel({ x: this.ballVel.x, y: pad.power, z: this.ballVel.z }, true);
        this.padPulse[i] = 1;
        this.padCooldown[i] = 0.3;
        this.shot.bounced = true;
        this.emit({ type: "bouncePad", index: i, pos: [...pad.at] as V3 });
      }
    });

    // ---- teleporters ----
    if (this.teleportCooldown <= 0) {
      for (const tp of this.built.teleporters) {
        const d = Math.hypot(bp.x - tp.a[0], bp.z - tp.a[2]);
        if (d < 0.55 && Math.abs(bp.y - R - tp.a[1]) < 0.5) {
          const speed = Math.max(4, Math.hypot(this.ballVel.x, this.ballVel.z));
          const dx = Math.sin(tp.exitYaw), dz = -Math.cos(tp.exitYaw);
          this.ball.setTranslation({ x: tp.b[0] + dx * 0.4, y: tp.b[1] + R + 0.08, z: tp.b[2] + dz * 0.4 }, true);
          this.ball.setLinvel({ x: dx * speed, y: 0, z: dz * speed }, true);
          this.teleportCooldown = G.surfaces.teleportCooldown;
          this.shot.teleported = true;
          this.emit({ type: "teleport", from: [tp.a[0], tp.a[1], tp.a[2]], to: [tp.b[0], tp.b[1], tp.b[2]] });
          this.syncBall();
          break;
        }
      }
    }

    // ---- coins ----
    this.built.coins.forEach((c, i) => {
      if (this.collected.has(i)) return;
      if (bp.distanceToSquared(new THREE.Vector3(c[0], c[1], c[2])) < 0.62 * 0.62) {
        this.collected.add(i);
        this.emit({ type: "coin", index: i, pos: c });
      }
    });

    // ---- gates (visual flap) ----
    this.built.gates.forEach((g, i) => {
      const dx = bp.x - g.at[0], dz = bp.z - g.at[2];
      const along = dx * g.dir[0] + dz * g.dir[1];
      const lat = Math.abs(dx * g.dir[1] - dz * g.dir[0]);
      const near = lat < g.width / 2 && along > -0.6 && along < 0.6;
      if (near && this.gateOpen[i] < 0.2) this.emit({ type: "gate", index: i });
      this.gateOpen[i] = near ? Math.min(1, this.gateOpen[i] + h * 10) : Math.max(0, this.gateOpen[i] - h * 3);
    });

    // ---- holed? ----
    const dcNow = Math.hypot(bp.x - cx, bp.z - cz);
    if (dcNow < G.cup.radius && bp.y < cy - R * 1.3) {
      this.phase = "holed";
      const speed = Math.hypot(before.x, before.z);
      this.emit({ type: "holed", bounceIn: this.shot.maxAir > 0.25 && this.airTimeAtCup(), speed, strokes: this.strokes, pos: [cx, cy, cz] });
      return;
    }

    // ---- hazards ----
    const below = this.belowWater;
    if (below?.kind === "water" && bp.y < below.y + R * 0.4) {
      this.enterHazard("water");
      return;
    }
    if (bp.y < this.built.killY) {
      this.enterHazard("void");
      return;
    }

    // ---- rest detection ----
    const g = this.ground;
    if (g && g.normal.y > 0.55) {
      const rel = this.ballVel.clone().sub(g.velocity);
      if (rel.length() < G.rolling.restSpeed) {
        this.restTimer += h;
        if (this.restTimer >= G.rolling.restTime) this.comeToRest();
      } else this.restTimer = 0;
    } else this.restTimer = 0;

    if (this.shot.time > G.rolling.maxShotTime) {
      if (g) this.comeToRest();
      else this.enterHazard("void");
    }
  }

  private physicsStep() {
    const v = this.ball.linvel();
    this.hookVel.set(v.x, v.y, v.z);
    this.world.step(this.queue, this.hooks);
  }

  /** Recent airborne approach (for "bounce-in" detection). */
  private airTimeAtCup() {
    return this.shot.maxAir > 0.25;
  }

  private comeToRest() {
    this.phase = "aim";
    this.restTimer = 0;
    this.restPos.copy(this.ballPos);
    if (this.ground && !this.ground.kinematic) this.ball.setLinvel({ x: 0, y: 0, z: 0 }, true);
    this.emit({ type: "rest", pos: [this.ballPos.x, this.ballPos.y, this.ballPos.z] });
  }

  private enterHazard(kind: "water" | "void") {
    this.phase = "hazard";
    this.hazardTimer = G.surfaces.hazardResetDelay;
    this.penalties += G.surfaces.hazardPenalty;
    this.strokes += G.surfaces.hazardPenalty;
    this.emit({ type: "hazard", kind, pos: [this.ballPos.x, this.ballPos.y, this.ballPos.z] });
    // Park the ball out of the way while the splash plays.
    this.ball.setLinvel({ x: 0, y: 0, z: 0 }, true);
    this.ball.setGravityScale(0, true);
  }

  private resetToRest() {
    this.ball.setGravityScale(1, true);
    this.ball.setTranslation({ x: this.restPos.x, y: this.restPos.y + 0.02, z: this.restPos.z }, true);
    this.ball.setLinvel({ x: 0, y: 0, z: 0 }, true);
    this.syncBall();
    this.ground = null;
    this.phase = "aim";
    this.emit({ type: "reset", pos: [this.restPos.x, this.restPos.y, this.restPos.z] });
  }

  /** Reset the whole hole (instant restart). */
  restart() {
    const [tx, ty, tz] = this.built.def.tee;
    this.ball.setGravityScale(1, true);
    this.ball.setTranslation({ x: tx, y: ty + G.ball.radius + 0.01, z: tz }, true);
    this.ball.setLinvel({ x: 0, y: 0, z: 0 }, true);
    this.syncBall();
    this.restPos.copy(this.ballPos);
    this.strokes = 0;
    this.penalties = 0;
    this.collected.clear();
    this.phase = "aim";
    this.ground = null;
    this.airTime = 0;
  }

  /** Recompute ground contact. Returns whether the ball touches anything. */
  private updateContacts() {
    let best: GroundInfo | null = null;
    let bestNy = -2;
    let touching = false;
    const R = G.ball.radius;
    this.world.contactPairsWith(this.ballCol, (other) => {
      this.world.contactPair(this.ballCol, other, (m, flipped) => {
        if (m.numContacts() === 0) return;
        touching = true;
        const n0 = m.normal();
        // Manifold normal points from collider1 to collider2; we want ground → ball.
        const s = flipped ? 1 : -1;
        const n = new THREE.Vector3(n0.x * s, n0.y * s, n0.z * s);
        if (n.y <= bestNy) return;
        bestNy = n.y;
        const k = this.kinByCollider.get(other.handle);
        const vel = new THREE.Vector3();
        if (k) {
          const cp = this.ballPos.clone().addScaledVector(n, -R);
          vel.copy(k.linVel).add(new THREE.Vector3().crossVectors(k.angVel, cp.sub(k.pos)));
        }
        best = { normal: n, velocity: vel, kinematic: !!k };
      });
    });
    this.ground = best;
    return touching;
  }

  // ------------------------------------------------------------------ snapshots

  /** Capture the full simulation state (used by the headless solver / verifier). */
  snapshot(): SimSnapshot {
    return {
      world: this.world.takeSnapshot(),
      t: this.t,
      phase: this.phase,
      strokes: this.strokes,
      penalties: this.penalties,
      restPos: this.restPos.clone(),
      collected: [...this.collected],
      kin: this.kin.map((k) => ({ pos: k.pos.clone(), quat: k.quat.clone() })),
    };
  }

  restore(s: SimSnapshot) {
    const handles = { ball: this.ball.handle, ballCol: this.ballCol.handle, floor: this.floorCol?.handle, kin: this.kin.map((k) => k.body.handle) };
    this.world.free();
    this.world = this.R.World.restoreSnapshot(s.world);
    this.ball = this.world.getRigidBody(handles.ball);
    this.ballCol = this.world.getCollider(handles.ballCol);
    this.floorCol = handles.floor !== undefined ? this.world.getCollider(handles.floor) : null;
    this.kin.forEach((k, i) => {
      k.body = this.world.getRigidBody(handles.kin[i]);
      k.pos.copy(s.kin[i].pos);
      k.quat.copy(s.kin[i].quat);
    });
    this.t = s.t;
    this.phase = s.phase;
    this.strokes = s.strokes;
    this.penalties = s.penalties;
    this.restPos.copy(s.restPos);
    this.collected = new Set(s.collected);
    this.events = [];
    this.restTimer = 0;
    this.airTime = 0;
    this.syncBall();
    this.updateContacts();
  }

  // ------------------------------------------------------------------ preview

  /**
   * Trajectory preview: sphere-cast along the aim; reflect off the first wall hit.
   * Returns polyline points (ball-centre height) and whether a bounce happened.
   */
  predict(dx: number, dz: number, power: number): { points: THREE.Vector3[]; bounce: THREE.Vector3 | null } {
    const R = this.R;
    const len = Math.hypot(dx, dz) || 1;
    let dir = new THREE.Vector3(dx / len, 0, dz / len);
    const total = G.trajectory.maxLength * (0.15 + 0.85 * Math.pow(power, 0.9));
    const shape = new R.Ball(G.ball.radius * 0.98);
    let pos = this.ballPos.clone().add(new THREE.Vector3(0, 0.05, 0));
    const points = [pos.clone()];
    let remaining = total;
    let bounce: THREE.Vector3 | null = null;
    for (let i = 0; i < 2 && remaining > 0.05; i++) {
      const hit = this.world.castShape(
        pos,
        { x: 0, y: 0, z: 0, w: 1 },
        dir,
        shape,
        0,
        remaining,
        false,
        undefined,
        undefined,
        this.floorCol ?? undefined,
        this.ball,
      );
      if (!hit || i === 1) {
        points.push(pos.clone().addScaledVector(dir, hit ? hit.time_of_impact : remaining));
        break;
      }
      const toi = Math.max(0, hit.time_of_impact - 0.01);
      pos = pos.clone().addScaledVector(dir, toi);
      points.push(pos.clone());
      bounce = pos.clone();
      const n = new THREE.Vector3(-hit.normal1.x, 0, -hit.normal1.z);
      if (n.lengthSq() < 1e-6) break;
      n.normalize();
      dir = dir.clone().addScaledVector(n, -2 * dir.dot(n)).setY(0).normalize();
      remaining = (remaining - toi) * G.trajectory.bounceLengthFactor;
    }
    return { points, bounce };
  }

  /** Is the ball within the "dramatic zoom" range of the cup? */
  distanceToCup() {
    const [cx, , cz] = this.built.def.cup;
    return Math.hypot(this.ballPos.x - cx, this.ballPos.z - cz);
  }
}
