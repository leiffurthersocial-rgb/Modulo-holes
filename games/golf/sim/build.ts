/**
 * Course builder: HoleDef → plain geometry data for physics and rendering.
 * Pure TypeScript (only three's math utils) so it runs both in the browser and in Node
 * for headless verification.
 *
 * All walkable static geometry (floors, ramps, cup, half-pipes, loops) is merged into ONE
 * trimesh with shared vertices so Rapier's internal-edge fixing removes seam bumps.
 */
import * as THREE from "three";
import { TUNING } from "@/config/tuning";
import type {
  HoleDef,
  PolyPt,
  V2,
  V3,
  FloorPiece,
  HalfpipePiece,
  LoopPiece,
  TeleporterPiece,
  DecorPiece,
  BlockPiece,
} from "../courses/types";

const G = TUNING.golf;
/** Moving decks sit a hair below the floor so the ball rolls onto them instead of clipping their edge. */
const PLATFORM_DROP = 0.015;

export interface MeshData {
  positions: number[];
  indices: number[];
  uvs: number[];
}

export interface BoxData {
  center: V3;
  half: V3;
  quat: [number, number, number, number];
  role: "rail" | "block" | "windmill" | "gatePost";
  style?: BlockPiece["style"];
}

export interface KinShape {
  half: V3;
  offset: V3;
  /** Local yaw of the shape around the body's y axis (for multi-arm spinners). */
  rot?: [number, number, number, number];
  kind: "box" | "cylinder";
}

export interface KinematicDef {
  id: number;
  kind: "mover" | "tilt" | "spinner" | "windmill";
  shapes: KinShape[];
  /** Pose at time t (seconds). */
  pose: (t: number, outPos: THREE.Vector3, outQuat: THREE.Quaternion) => void;
  /** Visual size hints. */
  size?: V3;
  length?: number;
  arms?: number;
}

export interface Zone2D {
  kind: "sand" | "ice" | "boost" | "conveyor";
  /** Polygon (x,z) */
  poly: V2[];
  y: number;
  /** Direction for boost/conveyor. */
  dir?: V2;
  speed?: number;
  /** Rect params for rendering boost/conveyor. */
  center?: V2;
  length?: number;
  width?: number;
  yaw?: number;
}

export interface BuiltHole {
  def: HoleDef;
  physicsMesh: MeshData;
  floors: { tone: FloorPiece["tone"]; top: MeshData; side: MeshData }[];
  cup: MeshData;
  cupRimY: number;
  tracks: MeshData[];
  boxes: BoxData[];
  bumpers: { at: V3; r: number }[];
  zones: Zone2D[];
  bouncePads: { at: V3; r: number; power: number }[];
  teleporters: TeleporterPiece[];
  kinematics: KinematicDef[];
  gates: { at: V3; yaw: number; width: number; dir: V2 }[];
  windmills: { at: V3; yaw: number; laneWidth: number }[];
  coins: V3[];
  decor: DecorPiece[];
  bounds: { min: V3; max: V3 };
  killY: number;
}

/** Course yaw convention: yaw 0 points toward −z, positive yaw turns toward +x. */
export const dirFromYaw = (yaw: number): V2 => [Math.sin(yaw), -Math.cos(yaw)];
/** Right-hand perpendicular of the travel direction. */
export const rightFromYaw = (yaw: number): V2 => [Math.cos(yaw), Math.sin(yaw)];

const newMesh = (): MeshData => ({ positions: [], indices: [], uvs: [] });

/** Append mesh b into a, offsetting indices. */
function appendMesh(a: MeshData, b: MeshData) {
  const off = a.positions.length / 3;
  a.positions.push(...b.positions);
  a.uvs.push(...b.uvs);
  for (const i of b.indices) a.indices.push(i + off);
}

function pushTri(m: MeshData, a: number, b: number, c: number) {
  // Ensure upward-ish facing for floor triangles (computed by caller when needed).
  m.indices.push(a, b, c);
}

function ptY(p: PolyPt, y: number) {
  return p.length === 3 ? p[2] : y;
}

export function pointInPoly(x: number, z: number, poly: V2[] | PolyPt[]) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0], zi = poly[i][1], xj = poly[j][0], zj = poly[j][1];
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi + 1e-12) + xi) inside = !inside;
  }
  return inside;
}

function signedArea(poly: PolyPt[]) {
  let a = 0;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i], q = poly[(i + 1) % poly.length];
    a += p[0] * q[1] - q[0] * p[1];
  }
  return a / 2;
}

const quatArr = (q: THREE.Quaternion): [number, number, number, number] => [q.x, q.y, q.z, q.w];

/** Oriented box spanning segment a→b (3D), with given cross-section; offset sideways by `side`. */
function boxAlong(a: THREE.Vector3, b: THREE.Vector3, width: number, height: number, sideOffset: THREE.Vector3, extend = 0) {
  const dir = new THREE.Vector3().subVectors(b, a);
  const len = dir.length();
  dir.normalize();
  const up = new THREE.Vector3(0, 1, 0);
  // Right-handed basis: x = dir, y = realUp, z = side.
  const side = new THREE.Vector3().crossVectors(dir, up).normalize();
  const realUp = new THREE.Vector3().crossVectors(side, dir).normalize();
  const m = new THREE.Matrix4().makeBasis(dir, realUp, side);
  const q = new THREE.Quaternion().setFromRotationMatrix(m);
  const center = new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5).add(sideOffset).addScaledVector(realUp, height / 2 - 0.02);
  return { center: [center.x, center.y, center.z] as V3, half: [len / 2 + extend, height / 2, width / 2] as V3, quat: quatArr(q) };
}

// ---------------------------------------------------------------------------------------

export interface BuildOptions {
  /** Lowest point cliff faces reach (water level / void depth). */
  skirtBottom?: number;
}

export function buildHole(def: HoleDef, opts: BuildOptions = {}): BuiltHole {
  const skirtBottom = opts.skirtBottom ?? -1.6;
  const physicsMesh = newMesh();
  const floors: BuiltHole["floors"] = [];
  const tracks: MeshData[] = [];
  const boxes: BoxData[] = [];
  const bumpers: BuiltHole["bumpers"] = [];
  const zones: Zone2D[] = [];
  const bouncePads: BuiltHole["bouncePads"] = [];
  const teleporters: TeleporterPiece[] = [];
  const kinematics: KinematicDef[] = [];
  const gates: BuiltHole["gates"] = [];
  const windmills: BuiltHole["windmills"] = [];
  const decor: DecorPiece[] = [];
  const min = new THREE.Vector3(Infinity, Infinity, Infinity);
  const max = new THREE.Vector3(-Infinity, -Infinity, -Infinity);
  const grow = (x: number, y: number, z: number) => {
    min.min(new THREE.Vector3(x, y, z));
    max.max(new THREE.Vector3(x, y, z));
  };
  let kinId = 1;
  const cupR = G.cup.radius;
  const [cx, cy, cz] = def.cup;
  let cupPlaced = false;

  for (const piece of def.pieces) {
    switch (piece.kind) {
      case "floor": {
        const y0 = piece.y ?? 0;
        const pts = piece.pts;
        const contour = pts.map((p) => new THREE.Vector2(p[0], p[1]));
        const holes: THREE.Vector2[][] = [];
        // Cut the cup into whichever flat floor contains it.
        const hasCup =
          !cupPlaced && pointInPoly(cx, cz, pts) && pts.every((p) => Math.abs(ptY(p, y0) - cy) < 1e-4);
        const CUP_SEG = 28;
        if (hasCup) {
          cupPlaced = true;
          const hole: THREE.Vector2[] = [];
          for (let i = 0; i < CUP_SEG; i++) {
            const a = (i / CUP_SEG) * Math.PI * 2;
            hole.push(new THREE.Vector2(cx + Math.cos(a) * cupR, cz + Math.sin(a) * cupR));
          }
          holes.push(hole);
        }
        const tris = THREE.ShapeUtils.triangulateShape(contour, holes);
        const all = [...contour, ...holes.flat()];
        const ys = [...pts.map((p) => ptY(p, y0)), ...holes.flat().map(() => cy)];
        const top = newMesh();
        all.forEach((v, i) => {
          top.positions.push(v.x, ys[i], v.y);
          top.uvs.push(v.x / 2, v.y / 2);
          grow(v.x, ys[i], v.y);
        });
        for (const [a, b, c] of tris) {
          // Normal y = (b-a)×(c-a) .y = (bz-az)(cx-ax) - (bx-ax)(cz-az); we want +y.
          const A = all[a], B = all[b], C = all[c];
          const ny = (B.y - A.y) * (C.x - A.x) - (B.x - A.x) * (C.y - A.y);
          if (ny >= 0) pushTri(top, a, b, c);
          else pushTri(top, a, c, b);
        }
        appendMesh(physicsMesh, top);

        // Cliff faces down every outer edge. They are solid (part of the physics mesh) so a
        // raised green has a real wall, and they share vertices with the top surface so the
        // internal-edge fix smooths the lip.
        const side = newMesh();
        const n = pts.length;
        const area0 = signedArea(pts);
        for (let i = 0; i < n; i++) {
          const p = pts[i], q = pts[(i + 1) % n];
          const ya = ptY(p, y0), yb = ptY(q, y0);
          const bottom = Math.min(skirtBottom, Math.min(ya, yb) - 0.9);
          const base = side.positions.length / 3;
          side.positions.push(p[0], ya, p[1], q[0], yb, q[1], q[0], bottom, q[1], p[0], bottom, p[1]);
          const len = Math.hypot(q[0] - p[0], q[1] - p[1]);
          side.uvs.push(0, ya, len, yb, len, bottom, 0, bottom);
          // Outward-facing winding (consistent with the up-facing top).
          if (area0 > 0) side.indices.push(base, base + 2, base + 3, base, base + 1, base + 2);
          else side.indices.push(base, base + 3, base + 2, base, base + 2, base + 1);
        }
        appendMesh(physicsMesh, side);
        floors.push({ tone: piece.tone ?? "fairway", top, side });

        // Rails along edges.
        const area = signedArea(pts);
        const railH = piece.railHeight ?? 0.42;
        const railT = 0.24;
        const open = new Set(piece.open ?? []);
        const railEdges =
          piece.rails === "none"
            ? []
            : Array.isArray(piece.rails)
              ? piece.rails
              : pts.map((_, i) => i).filter((i) => !open.has(i));
        for (const i of railEdges) {
          const p = pts[i], q = pts[(i + 1) % n];
          const a = new THREE.Vector3(p[0], ptY(p, y0), p[1]);
          const b = new THREE.Vector3(q[0], ptY(q, y0), q[1]);
          // Outward normal (2D): for CCW polygons (positive area in x,z), outward = (dz, -dx).
          const dx = q[0] - p[0], dz = q[1] - p[1];
          const len = Math.hypot(dx, dz) || 1;
          const sgn = area > 0 ? 1 : -1;
          const out = new THREE.Vector3((dz / len) * sgn, 0, (-dx / len) * sgn);
          const bx = boxAlong(a, b, railT, railH, out.multiplyScalar(railT / 2), railT / 2);
          boxes.push({ ...bx, role: "rail" });
        }
        break;
      }

      case "block": {
        const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -(piece.yaw ?? 0));
        boxes.push({
          center: [piece.at[0], piece.at[1] + piece.size[1] / 2, piece.at[2]],
          half: [piece.size[0] / 2, piece.size[1] / 2, piece.size[2] / 2],
          quat: quatArr(q),
          role: "block",
          style: piece.style ?? "stone",
        });
        grow(piece.at[0], piece.at[1] + piece.size[1], piece.at[2]);
        break;
      }

      case "halfpipe": {
        const m = buildHalfpipe(piece);
        appendMesh(physicsMesh, m);
        tracks.push(m);
        break;
      }

      case "loop": {
        const m = buildLoop(piece);
        appendMesh(physicsMesh, m);
        tracks.push(m);
        for (let i = 0; i < m.positions.length; i += 3) grow(m.positions[i], m.positions[i + 1], m.positions[i + 2]);
        break;
      }

      case "bumper":
        bumpers.push({ at: [piece.at[0], piece.y, piece.at[1]], r: piece.r });
        break;

      case "sand":
      case "ice":
        zones.push({ kind: piece.kind, poly: piece.pts, y: piece.y });
        break;

      case "boost":
      case "conveyor": {
        const len = piece.kind === "boost" ? piece.length ?? 1.6 : piece.length;
        const wid = piece.kind === "boost" ? piece.width ?? 1.0 : piece.width;
        const d = dirFromYaw(piece.yaw);
        const r = rightFromYaw(piece.yaw);
        const [x, z] = piece.at;
        const poly: V2[] = [
          [x - d[0] * len / 2 - r[0] * wid / 2, z - d[1] * len / 2 - r[1] * wid / 2],
          [x + d[0] * len / 2 - r[0] * wid / 2, z + d[1] * len / 2 - r[1] * wid / 2],
          [x + d[0] * len / 2 + r[0] * wid / 2, z + d[1] * len / 2 + r[1] * wid / 2],
          [x - d[0] * len / 2 + r[0] * wid / 2, z - d[1] * len / 2 + r[1] * wid / 2],
        ];
        zones.push({
          kind: piece.kind,
          poly,
          y: piece.y,
          dir: d,
          speed: piece.kind === "boost" ? piece.speed ?? G.surfaces.boostSpeed : piece.speed,
          center: piece.at,
          length: len,
          width: wid,
          yaw: piece.yaw,
        });
        break;
      }

      case "bounce":
        bouncePads.push({ at: [piece.at[0], piece.y, piece.at[1]], r: piece.r ?? 0.6, power: piece.power ?? G.surfaces.bouncePadSpeed });
        break;

      case "teleport":
        teleporters.push(piece);
        break;

      case "mover": {
        const { from, to, period, phase = 0, hold = 0.15 } = piece;
        kinematics.push({
          id: kinId++,
          kind: "mover",
          size: piece.size,
          shapes: [{ kind: "box", half: [piece.size[0] / 2, piece.size[1] / 2, piece.size[2] / 2], offset: [0, -piece.size[1] / 2 - PLATFORM_DROP, 0] }],
          pose: (t, p, q) => {
            // Ping-pong with eased ends and a hold at each end.
            let u = (((t / period + phase) % 1) + 1) % 1;
            const travel = 0.5 - hold;
            let k: number;
            if (u < travel) k = u / travel;
            else if (u < 0.5) k = 1;
            else if ((u -= 0.5) < travel) k = 1 - u / travel;
            else k = 0;
            const e = k * k * (3 - 2 * k);
            p.set(from[0] + (to[0] - from[0]) * e, from[1] + (to[1] - from[1]) * e, from[2] + (to[2] - from[2]) * e);
            q.identity();
          },
        });
        grow(from[0], from[1], from[2]);
        grow(to[0], to[1], to[2]);
        break;
      }

      case "tilt": {
        const { at, axis, amp, period, phase = 0 } = piece;
        const ax = axis === "x" ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 0, 1);
        kinematics.push({
          id: kinId++,
          kind: "tilt",
          size: piece.size,
          shapes: [{ kind: "box", half: [piece.size[0] / 2, piece.size[1] / 2, piece.size[2] / 2], offset: [0, -piece.size[1] / 2 - PLATFORM_DROP, 0] }],
          pose: (t, p, q) => {
            p.set(at[0], at[1], at[2]);
            q.setFromAxisAngle(ax, Math.sin((t / period + phase) * Math.PI * 2) * amp);
          },
        });
        grow(at[0], at[1], at[2]);
        break;
      }

      case "spinner": {
        const arms = piece.arms ?? 2;
        const L = piece.length;
        const shapes: KinShape[] = [{ kind: "cylinder", half: [0.22, 0.3, 0.22], offset: [0, 0.3, 0] }];
        for (let i = 0; i < arms; i++) {
          const a = (i / arms) * Math.PI * 2;
          const rq = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), a);
          const off = new THREE.Vector3(L / 2, 0.24, 0).applyQuaternion(rq);
          shapes.push({ kind: "box", half: [L / 2, 0.14, 0.09], offset: [off.x, off.y, off.z], rot: quatArr(rq) });
        }
        const { at, speed } = piece;
        kinematics.push({
          id: kinId++,
          kind: "spinner",
          shapes,
          length: L,
          arms,
          pose: (t, p, q) => {
            p.set(at[0], at[1], at[2]);
            q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), speed * t);
          },
        });
        break;
      }

      case "windmill": {
        const { at, y, yaw, laneWidth, speed } = piece;
        const d = dirFromYaw(yaw);
        const r = rightFromYaw(yaw);
        const pillarW = 0.7;
        const depth = 1.4;
        const tunnelH = 0.95;
        const towerH = 3.1;
        const qYaw = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -yaw);
        const pushBox = (lat: number, along: number, y0: number, w: number, h: number, dep: number) => {
          boxes.push({
            center: [at[0] + r[0] * lat + d[0] * along, y0 + h / 2, at[1] + r[1] * lat + d[1] * along],
            half: [w / 2, h / 2, dep / 2],
            quat: quatArr(qYaw),
            role: "windmill",
          });
        };
        const sideOff = laneWidth / 2 + pillarW / 2;
        pushBox(-sideOff, 0, y, pillarW, towerH, depth);
        pushBox(sideOff, 0, y, pillarW, towerH, depth);
        pushBox(0, 0, y + tunnelH, laneWidth + 0.02, towerH - tunnelH, depth);
        windmills.push({ at: [at[0], y, at[1]], yaw, laneWidth });
        // Blades: hub on the entry face (−d side), spinning around the travel axis.
        const hubH = y + 1.95;
        const hub = new THREE.Vector3(at[0] - d[0] * (depth / 2 + 0.22), hubH, at[1] - d[1] * (depth / 2 + 0.22));
        const axis = new THREE.Vector3(d[0], 0, d[1]).normalize();
        const bladeLen = 1.8;
        const shapes: KinShape[] = [];
        for (let i = 0; i < 4; i++) {
          // Blades in the body's local frame: arms along local x rotated around local z (= travel axis).
          const rq = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), (i * Math.PI) / 2);
          const off = new THREE.Vector3(bladeLen / 2 + 0.1, 0, 0).applyQuaternion(rq);
          shapes.push({ kind: "box", half: [bladeLen / 2, 0.2, 0.06], offset: [off.x, off.y, off.z], rot: quatArr(rq) });
        }
        // Base orientation: local z → travel axis.
        const base = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), axis);
        kinematics.push({
          id: kinId++,
          kind: "windmill",
          shapes,
          length: bladeLen,
          arms: 4,
          pose: (t, p, q) => {
            p.copy(hub);
            q.copy(base).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), speed * t));
          },
        });
        break;
      }

      case "gate": {
        const d = dirFromYaw(piece.yaw);
        gates.push({ at: [piece.at[0], piece.y, piece.at[1]], yaw: piece.yaw, width: piece.width, dir: d });
        break;
      }

      case "decor":
        decor.push(piece);
        break;
    }
  }

  // Cup: open cylinder + bottom, sharing rim vertices with the hole cut into the floor.
  const cup = newMesh();
  if (cupPlaced) {
    const SEG = 28;
    const depth = G.cup.depth;
    for (let i = 0; i < SEG; i++) {
      const a = (i / SEG) * Math.PI * 2;
      const x = cx + Math.cos(a) * cupR, z = cz + Math.sin(a) * cupR;
      cup.positions.push(x, cy, z, x, cy - depth, z);
      cup.uvs.push(i / SEG, 0, i / SEG, 1);
    }
    for (let i = 0; i < SEG; i++) {
      const j = (i + 1) % SEG;
      const a = i * 2, b = i * 2 + 1, c = j * 2, d2 = j * 2 + 1;
      // Inward-facing walls (consistent winding with the up-facing floor around the rim).
      cup.indices.push(a, b, c, b, d2, c);
    }
    const centre = cup.positions.length / 3;
    cup.positions.push(cx, cy - depth, cz);
    cup.uvs.push(0.5, 0.5);
    for (let i = 0; i < SEG; i++) {
      const j = (i + 1) % SEG;
      cup.indices.push(centre, j * 2 + 1, i * 2 + 1);
    }
    appendMesh(physicsMesh, cup);
  } else if (typeof process !== "undefined" && process.env?.NODE_ENV !== "production") {
    console.warn(`[golf] hole ${def.id}: cup is not inside a flat floor`);
  }

  for (const c of def.coins ?? []) grow(c[0], c[1], c[2]);
  grow(def.tee[0], def.tee[1], def.tee[2]);

  return {
    def,
    physicsMesh,
    floors,
    cup,
    cupRimY: cy,
    tracks,
    boxes,
    bumpers,
    zones,
    bouncePads,
    teleporters,
    kinematics,
    gates,
    windmills,
    coins: def.coins ?? [],
    decor,
    bounds: { min: [min.x, min.y, min.z], max: [max.x, max.y, max.z] },
    killY: def.killY ?? min.y - 3.5,
  };
}

// ---------------------------------------------------------------------------------------
// Swept track geometry

/** Grid mesh from rows of cross-section points (each row same length). */
function gridMesh(rows: THREE.Vector3[][], closedU = false): MeshData {
  const m = newMesh();
  const cols = rows[0].length;
  rows.forEach((row, ri) =>
    row.forEach((p, ci) => {
      m.positions.push(p.x, p.y, p.z);
      m.uvs.push(ci / (cols - 1), ri / 4);
    }),
  );
  for (let r = 0; r < rows.length - 1; r++) {
    for (let c = 0; c < cols - 1 + (closedU ? 1 : 0); c++) {
      const c2 = (c + 1) % cols;
      const a = r * cols + c, b = r * cols + c2, d = (r + 1) * cols + c, e = (r + 1) * cols + c2;
      m.indices.push(a, b, d, b, e, d);
    }
  }
  return m;
}

function buildHalfpipe(p: HalfpipePiece): MeshData {
  const [ax, az] = p.from;
  const [bx, bz] = p.to;
  const dx = bx - ax, dz = bz - az;
  const len = Math.hypot(dx, dz);
  const dir = new THREE.Vector3(dx / len, 0, dz / len);
  const side = new THREE.Vector3(-dir.z, 0, dir.x); // left/right perpendicular
  // Cross-section: left lip → left wall arc → flat bottom → right wall arc → right lip.
  const cs: [number, number][] = [];
  const ARC = 8;
  const w = p.width / 2, R = p.radius;
  cs.push([-(w + R + 0.02), R + 0.35]);
  for (let i = ARC; i >= 0; i--) {
    const a = (i / ARC) * (Math.PI / 2);
    cs.push([-(w + Math.sin(a) * R), R - Math.cos(a) * R]);
  }
  for (let i = 0; i <= ARC; i++) {
    const a = (i / ARC) * (Math.PI / 2);
    cs.push([w + Math.sin(a) * R, R - Math.cos(a) * R]);
  }
  cs.push([w + R + 0.02, R + 0.35]);
  const SEGS = Math.max(2, Math.ceil(len / 1.5));
  const rows: THREE.Vector3[][] = [];
  for (let s = 0; s <= SEGS; s++) {
    const t = s / SEGS;
    const base = new THREE.Vector3(ax + dx * t, p.y, az + dz * t);
    rows.push(cs.map(([l, h]) => base.clone().addScaledVector(side, l).add(new THREE.Vector3(0, h, 0))));
  }
  return gridMesh(rows);
}

function buildLoop(p: LoopPiece): MeshData {
  const d2 = dirFromYaw(p.yaw);
  const r2 = rightFromYaw(p.yaw);
  const fwd = new THREE.Vector3(d2[0], 0, d2[1]);
  const right = new THREE.Vector3(r2[0], 0, r2[1]);
  const shift = (p.width + 0.6) * (p.side ?? 1);
  const R = p.radius;
  const w = p.width / 2;
  const lip = 0.32;
  const SEG = 72;
  const rows: THREE.Vector3[][] = [];
  const origin = new THREE.Vector3(p.at[0], p.y, p.at[1]);
  for (let s = 0; s <= SEG; s++) {
    const th = (s / SEG) * Math.PI * 2;
    // Centre-line of the loop with a smooth lateral drift so exit clears entry.
    const lat = shift * (th - Math.sin(th)) / (Math.PI * 2);
    const c = origin
      .clone()
      .addScaledVector(fwd, Math.sin(th) * R)
      .add(new THREE.Vector3(0, R * (1 - Math.cos(th)), 0))
      .addScaledVector(right, lat);
    // Inward normal (toward loop centre) is the track "up".
    const up = new THREE.Vector3(0, Math.cos(th), 0).addScaledVector(fwd, -Math.sin(th)).normalize();
    rows.push([
      c.clone().addScaledVector(right, -w - 0.05).addScaledVector(up, lip),
      c.clone().addScaledVector(right, -w),
      c.clone().addScaledVector(right, w),
      c.clone().addScaledVector(right, w + 0.05).addScaledVector(up, lip),
    ]);
  }
  // Snap first/last rows exactly onto the floor height so seams line up.
  for (const row of [rows[0], rows[rows.length - 1]]) {
    row[1].y = p.y;
    row[2].y = p.y;
  }
  return gridMesh(rows);
}

/** Helpers for course authors and the sim. */
export function loopExit(p: LoopPiece): V2 {
  const r2 = rightFromYaw(p.yaw);
  const shift = (p.width + 0.6) * (p.side ?? 1);
  return [p.at[0] + r2[0] * shift, p.at[1] + r2[1] * shift];
}
