/**
 * Billiards physics — a dedicated analytic solver (not a general rigid-body engine), because
 * pool feel lives in details general engines skip:
 *  - sliding → rolling transition with the classic 7/2 contact-velocity decay, so stun, follow
 *    and draw emerge naturally from cue-tip offset;
 *  - side spin (english) that decays and bends cushion rebounds;
 *  - jaw-accurate pockets built from cushion segments with rounded ends.
 * Fixed tiny timestep → deterministic and fast enough for AI look-ahead.
 *
 * Coordinates: table centre at origin, x along the length (±L/2), z across (±W/2), y up.
 */
import { TUNING } from "@/config/tuning";

const T = TUNING.billiards;
export const R = T.ball.radius;
export const L = T.table.length;
export const W = T.table.width;

export interface Ball {
  id: number; // 0 = cue ball
  x: number;
  z: number;
  vx: number;
  vz: number;
  /** Angular velocity (rad/s), world axes. wy = side spin (english). */
  wx: number;
  wy: number;
  wz: number;
  onTable: boolean;
  /** Pocket index once potted. */
  pocket: number;
  moving: boolean;
}

export interface Pocket {
  x: number;
  z: number;
  r: number;
  /** Where to aim (slightly inside the mouth). */
  ax: number;
  az: number;
  side: boolean;
}

interface Segment {
  ax: number;
  az: number;
  bx: number;
  bz: number;
  /** Unit inward normal (toward the playing surface). */
  nx: number;
  nz: number;
}

export type PhysEvent =
  | { type: "ball"; a: number; b: number; speed: number; x: number; z: number }
  | { type: "cushion"; ball: number; speed: number; x: number; z: number }
  | { type: "pocket"; ball: number; pocket: number; speed: number };

const CORNER_GAP = 0.088;
const SIDE_GAP = 0.064;

export const POCKETS: Pocket[] = (() => {
  const c = T.table.cornerPocketRadius;
  const s = T.table.pocketRadius;
  const out: Pocket[] = [];
  for (const sx of [-1, 1])
    for (const sz of [-1, 1]) out.push({ x: sx * (L / 2 + 0.018), z: sz * (W / 2 + 0.018), r: c, ax: sx * (L / 2 - 0.012), az: sz * (W / 2 - 0.012), side: false });
  for (const sz of [-1, 1]) out.push({ x: 0, z: sz * (W / 2 + 0.042), r: s, ax: 0, az: sz * (W / 2 + 0.006), side: true });
  return out;
})();

/** Cushion noses as segments with pocket gaps; endpoints act as rounded jaws. */
export const CUSHIONS: Segment[] = (() => {
  const segs: Segment[] = [];
  /** Add a segment whose normal faces the reference point (table centre or pocket mouth). */
  const add = (ax: number, az: number, bx: number, bz: number, refX: number, refZ: number) => {
    const ex = bx - ax, ez = bz - az;
    const len = Math.hypot(ex, ez);
    let nx = -ez / len, nz = ex / len;
    if ((refX - ax) * nx + (refZ - az) * nz < 0) {
      nx = -nx;
      nz = -nz;
    }
    segs.push({ ax, az, bx, bz, nx, nz });
  };
  const hx = L / 2, hz = W / 2;
  const J = 0.03; // jaw depth
  for (const sz of [-1, 1]) {
    // Long rails, split by the side pocket.
    add(-hx + CORNER_GAP, sz * hz, -SIDE_GAP, sz * hz, 0, 0);
    add(SIDE_GAP, sz * hz, hx - CORNER_GAP, sz * hz, 0, 0);
    // Corner jaws on the long rails.
    for (const sx of [-1, 1]) {
      const pk = POCKETS.find((p) => !p.side && Math.sign(p.x) === sx && Math.sign(p.z) === sz)!;
      add(sx * (hx - CORNER_GAP), sz * hz, sx * (hx - CORNER_GAP + J), sz * (hz + J), pk.ax, pk.az);
      add(sx * hx, sz * (hz - CORNER_GAP), sx * (hx + J), sz * (hz - CORNER_GAP + J), pk.ax, pk.az);
    }
    // Side-pocket jaws.
    const sp = POCKETS.find((p) => p.side && Math.sign(p.z) === sz)!;
    for (const sx of [-1, 1]) add(sx * SIDE_GAP, sz * hz, sx * (SIDE_GAP - 0.012), sz * (hz + 0.04), sp.ax, sp.az);
  }
  // Short rails.
  for (const sx of [-1, 1]) add(sx * hx, -hz + CORNER_GAP, sx * hx, hz - CORNER_GAP, 0, 0);
  return segs;
})();

export const HEAD_STRING_X = -L / 4;
export const FOOT_SPOT: [number, number] = [L / 4, 0];

export function makeBall(id: number, x: number, z: number): Ball {
  return { id, x, z, vx: 0, vz: 0, wx: 0, wy: 0, wz: 0, onTable: true, pocket: -1, moving: false };
}

export function cloneBalls(balls: Ball[]): Ball[] {
  return balls.map((b) => ({ ...b }));
}

export interface ShotParams {
  /** Unit aim direction. */
  dx: number;
  dz: number;
  /** 0..1 */
  power: number;
  /** Tip offset as fraction of max: side (−1 left … +1 right), vertical (−1 draw … +1 follow). */
  spinX: number;
  spinY: number;
  /** Break shot: extra pace. */
  isBreak?: boolean;
}

export function shotSpeed(power: number) {
  const p = Math.max(0, Math.min(1, power));
  return T.shot.minSpeed + (T.shot.maxSpeed - T.shot.minSpeed) * Math.pow(p, T.shot.powerCurve);
}

/** Apply a cue strike to the cue ball. */
export function strike(cue: Ball, s: ShotParams) {
  const len = Math.hypot(s.dx, s.dz) || 1;
  const dx = s.dx / len, dz = s.dz / len;
  const V = shotSpeed(s.power) * (s.isBreak ? T.shot.breakBoost : 1);
  const off = T.shot.maxTipOffset * R;
  const hb = s.spinY * off; // vertical offset → follow/draw
  const ha = s.spinX * off; // horizontal offset → english
  cue.vx = dx * V;
  cue.vz = dz * V;
  // Rolling-direction spin axis for travel (dx,dz): (wx, wz) = (dz, -dx) / R per unit speed.
  const k = (5 * V * hb) / (2 * R * R);
  cue.wx = dz * k;
  cue.wz = -dx * k;
  cue.wy = -(5 * V * ha) / (2 * R * R);
  cue.moving = true;
}

export interface SimResult {
  /** First object ball the cue ball touched (null = none). */
  firstHit: number | null;
  pocketed: number[];
  /** Did any ball touch a cushion after the first contact? */
  railAfterContact: boolean;
  /** Cushions the cue ball hit before first contact. */
  cushionsBeforeContact: number;
  /** Balls that hit a cushion during the shot. */
  railBalls: Set<number>;
}

/**
 * Advance all balls by one fixed sub-step. Returns events (collisions, pockets).
 */
export function stepBalls(balls: Ball[], dt: number, events: PhysEvent[] | null, res?: SimResult) {
  const P = T.physics;
  const g = P.gravity;
  for (const b of balls) {
    if (!b.onTable || !b.moving) continue;
    // Contact-point velocity (sliding check): u = v + ω × r, r = (0,−R,0)
    const ux = b.vx + R * b.wz;
    const uz = b.vz - R * b.wx;
    const u = Math.hypot(ux, uz);
    const slideDecel = P.muSlide * g;
    if (u > 3.5 * slideDecel * dt) {
      const nx = ux / u, nz = uz / u;
      b.vx -= slideDecel * nx * dt;
      b.vz -= slideDecel * nz * dt;
      const k = (5 * slideDecel) / (2 * R);
      b.wx += k * nz * dt;
      b.wz -= k * nx * dt;
    } else {
      // Rolling: constant rolling resistance, spin locked to velocity.
      const v = Math.hypot(b.vx, b.vz);
      if (v > 0) {
        const nv = Math.max(0, v - P.muRoll * g * dt);
        b.vx *= nv / v;
        b.vz *= nv / v;
      }
      b.wx = b.vz / R;
      b.wz = -b.vx / R;
    }
    // Side spin decays independently.
    const spinDecel = ((5 * P.muSpin * g) / (2 * R)) * dt;
    if (Math.abs(b.wy) <= spinDecel) b.wy = 0;
    else b.wy -= Math.sign(b.wy) * spinDecel;

    b.x += b.vx * dt;
    b.z += b.vz * dt;

    const speed = Math.hypot(b.vx, b.vz);
    if (speed < P.stopSpeed && Math.hypot(b.wx, b.wz) * R < P.stopSpeed * 2 && Math.abs(b.wy) < 2) {
      b.vx = b.vz = b.wx = b.wz = b.wy = 0;
      b.moving = false;
    }
  }

  // Ball–ball collisions. Several Gauss–Seidel passes so impulses propagate through a
  // touching pack (the break) within one step instead of behaving like a Newton's cradle.
  for (let iter = 0; iter < 6; iter++) {
    if (!collidePass(balls, events, res, iter === 0)) break;
  }

  cushionsAndPockets(balls, events, res);
}

function collidePass(balls: Ball[], events: PhysEvent[] | null, res: SimResult | undefined, report: boolean) {
  const P = T.physics;
  let any = false;
  for (let i = 0; i < balls.length; i++) {
    const a = balls[i];
    if (!a.onTable) continue;
    for (let j = i + 1; j < balls.length; j++) {
      const b = balls[j];
      if (!b.onTable || (!a.moving && !b.moving)) continue;
      const dx = b.x - a.x, dz = b.z - a.z;
      const d2 = dx * dx + dz * dz;
      if (d2 >= 4 * R * R || d2 === 0) continue;
      const d = Math.sqrt(d2);
      let nx = dx / d, nz = dz / d;
      if (breakChaos.active && report) {
        // A real rack is never perfectly frozen: jitter impulse directions slightly while
        // the break is spreading so the pack scatters instead of acting like a Newton's cradle.
        const a0 = (breakChaos.rand() - 0.5) * 0.7;
        const c = Math.cos(a0), sn = Math.sin(a0);
        [nx, nz] = [nx * c - nz * sn, nx * sn + nz * c];
      }
      const vrel = (a.vx - b.vx) * nx + (a.vz - b.vz) * nz;
      // Separate overlap.
      const push = (2 * R - d) / 2;
      a.x -= nx * push;
      a.z -= nz * push;
      b.x += nx * push;
      b.z += nz * push;
      if (vrel <= 1e-4) continue;
      any = true;
      const jn = ((1 + P.ballRestitution) / 2) * vrel;
      a.vx -= jn * nx;
      a.vz -= jn * nz;
      b.vx += jn * nx;
      b.vz += jn * nz;
      // Collision-induced throw: small tangential transfer.
      const tx = -nz, tz = nx;
      const vt = (a.vx - b.vx) * tx + (a.vz - b.vz) * tz + R * (a.wy + b.wy);
      const jt = Math.sign(vt) * Math.min(Math.abs(vt) / 2, P.ballThrow * jn);
      a.vx -= jt * tx;
      a.vz -= jt * tz;
      b.vx += jt * tx;
      b.vz += jt * tz;
      a.moving = b.moving = true;
      if (res && res.firstHit === null) {
        if (a.id === 0) res.firstHit = b.id;
        else if (b.id === 0) res.firstHit = a.id;
      }
      if (report) events?.push({ type: "ball", a: a.id, b: b.id, speed: vrel, x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 });
    }
  }
  return any;
}

function cushionsAndPockets(balls: Ball[], events: PhysEvent[] | null, res: SimResult | undefined) {
  const P = T.physics;
  for (const b of balls) {
    if (!b.onTable || !b.moving) continue;
    for (const s of CUSHIONS) {
      const ex = s.bx - s.ax, ez = s.bz - s.az;
      const len2 = ex * ex + ez * ez;
      let t = ((b.x - s.ax) * ex + (b.z - s.az) * ez) / len2;
      t = Math.max(0, Math.min(1, t));
      const cx = s.ax + ex * t, cz = s.az + ez * t;
      const dx = b.x - cx, dz = b.z - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 >= R * R) continue;
      const d = Math.sqrt(d2) || 1e-6;
      let nx = dx / d, nz = dz / d;
      // On the segment face use its normal (robust if the centre crossed the line).
      if (t > 0 && t < 1) {
        nx = s.nx;
        nz = s.nz;
      }
      const vn = b.vx * nx + b.vz * nz;
      // Push out.
      const pen = t > 0 && t < 1 ? R - ((b.x - cx) * nx + (b.z - cz) * nz) : R - d;
      b.x += nx * pen;
      b.z += nz * pen;
      if (vn >= 0) continue;
      const tx = -nz, tz = nx;
      let vt = b.vx * tx + b.vz * tz;
      // English: side spin adds/subtracts rebound speed along the cushion.
      vt += P.cushionEnglish * R * b.wy * 1.0;
      b.wy *= 0.6;
      const vnOut = -vn * P.cushionRestitution;
      b.vx = nx * vnOut + tx * vt * 0.94;
      b.vz = nz * vnOut + tz * vt * 0.94;
      // Cushion contact kills most of the rolling spin component along the normal.
      b.wx *= 0.5;
      b.wz *= 0.5;
      if (res) {
        res.railBalls.add(b.id);
        if (res.firstHit !== null) res.railAfterContact = true;
        else if (b.id === 0) res.cushionsBeforeContact++;
      }
      events?.push({ type: "cushion", ball: b.id, speed: -vn, x: b.x, z: b.z });
    }
    // Pockets.
    for (let pi = 0; pi < POCKETS.length; pi++) {
      const p = POCKETS[pi];
      const dx = b.x - p.x, dz = b.z - p.z;
      if (dx * dx + dz * dz < p.r * p.r || Math.abs(b.x) > L / 2 + 0.07 || Math.abs(b.z) > W / 2 + 0.07) {
        const pocket = dx * dx + dz * dz < p.r * p.r ? pi : nearestPocket(b.x, b.z);
        b.onTable = false;
        b.pocket = pocket;
        const speed = Math.hypot(b.vx, b.vz);
        b.moving = false;
        res?.pocketed.push(b.id);
        events?.push({ type: "pocket", ball: b.id, pocket, speed });
        break;
      }
    }
  }
}

/** Break-scatter helper (see collidePass). Enabled for the first moments of a break. */
export const breakChaos = { active: false, rand: Math.random as () => number };

export function nearestPocket(x: number, z: number) {
  let best = 0, bd = Infinity;
  POCKETS.forEach((p, i) => {
    const d = Math.hypot(x - p.x, z - p.z);
    if (d < bd) {
      bd = d;
      best = i;
    }
  });
  return best;
}

export function anyMoving(balls: Ball[]) {
  return balls.some((b) => b.onTable && b.moving);
}

export function newResult(): SimResult {
  return { firstHit: null, pocketed: [], railAfterContact: false, cushionsBeforeContact: 0, railBalls: new Set() };
}

/** Simulate a whole shot to rest (for AI and trick-shot verification). */
export function simulateShot(balls: Ball[], shot: ShotParams, maxTime = 25): SimResult {
  const res = newResult();
  strike(balls[0], shot);
  const dt = T.physics.dt * 2; // coarser step is fine for look-ahead
  let t = 0;
  while (anyMoving(balls) && t < maxTime) {
    breakChaos.active = !!shot.isBreak && t < 0.5;
    stepBalls(balls, dt, null, res);
    t += dt;
  }
  breakChaos.active = false;
  return res;
}

/** Is a cue-ball placement valid (on the cloth, not overlapping other balls)? */
export function validPlacement(balls: Ball[], x: number, z: number, kitchen: boolean) {
  if (Math.abs(x) > L / 2 - R - 0.004 || Math.abs(z) > W / 2 - R - 0.004) return false;
  if (kitchen && x > HEAD_STRING_X) return false;
  return balls.every((b) => b.id === 0 || !b.onTable || Math.hypot(b.x - x, b.z - z) > 2 * R + 0.002);
}

/** Respot a ball on the foot spot (sliding back along the long axis if occupied). */
export function respot(balls: Ball[], ball: Ball) {
  let x = FOOT_SPOT[0];
  while (!validPlacement(balls.filter((b) => b !== ball), x, 0, false) && x < L / 2 - R) x += 0.01;
  Object.assign(ball, makeBall(ball.id, x, 0));
}
