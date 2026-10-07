/**
 * Tiny authoring helpers for course data. Everything returns plain data (Piece objects).
 */
import type { FloorPiece, PolyPt, V2 } from "./types";

/** Axis-aligned rectangle polygon from (x0,z0) to (x1,z1). Edges: 0 = z0 side, 1 = x1 side, 2 = z1 side, 3 = x0 side. */
export function rect(x0: number, z0: number, x1: number, z1: number): V2[] {
  return [
    [x0, z0],
    [x1, z0],
    [x1, z1],
    [x0, z1],
  ];
}

/** Floor piece helper. */
export function floor(pts: PolyPt[], opts: Omit<FloorPiece, "kind" | "pts"> = {}): FloorPiece {
  return { kind: "floor", pts, ...opts };
}

/**
 * Ramp along z between z0 (height y0) and z1 (height y1), spanning x0..x1.
 * Edge indices: 0 = z0 edge, 1 = x1 side, 2 = z1 edge, 3 = x0 side.
 */
export function rampZ(x0: number, x1: number, z0: number, y0: number, z1: number, y1: number, opts: Omit<FloorPiece, "kind" | "pts"> = {}): FloorPiece {
  return floor(
    [
      [x0, z0, y0],
      [x1, z0, y0],
      [x1, z1, y1],
      [x0, z1, y1],
    ],
    { open: [0, 2], ...opts },
  );
}

/** Ramp along x between x0 (y0) and x1 (y1), spanning z0..z1. Edges: 0 = x0→x1 at z0, 1 = x1 edge, 2 = z1 side, 3 = x0 edge. */
export function rampX(z0: number, z1: number, x0: number, y0: number, x1: number, y1: number, opts: Omit<FloorPiece, "kind" | "pts"> = {}): FloorPiece {
  return floor(
    [
      [x0, z0, y0],
      [x1, z0, y1],
      [x1, z1, y1],
      [x0, z1, y0],
    ],
    { open: [1, 3], ...opts },
  );
}
