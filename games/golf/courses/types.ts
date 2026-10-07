/**
 * Data-driven golf course format. A hole is a list of pieces; the builder turns pieces into
 * physics colliders + render geometry. Map convention: x → right, z → toward the player
 * (tees usually sit at +z, cups toward −z). Heights are y.
 */

export type V2 = [number, number];
export type V3 = [number, number, number];
/** Polygon vertex: [x, z] at the piece's base height, or [x, z, y] for slopes/ramps. */
export type PolyPt = V2 | V3;

export interface FloorPiece {
  kind: "floor";
  /** Polygon outline (any winding). Shared edges with neighbours should share vertices exactly. */
  pts: PolyPt[];
  /** Default height for 2D points. */
  y?: number;
  /** Which edges get rails. Edge i runs from pts[i] to pts[i+1]. Default: all except `open`. */
  rails?: "all" | "none" | number[];
  /** Edges without rails (connections to neighbouring floors, drop-offs). */
  open?: number[];
  railHeight?: number;
  /** Visual variant: alternate grass tint (fairway vs green). */
  tone?: "fairway" | "green" | "path";
}

/** Static box obstacle (walls, blocks, pillars). */
export interface BlockPiece {
  kind: "block";
  at: V3;
  size: V3;
  yaw?: number;
  style?: "wall" | "stone" | "crate" | "accent";
}

/** U-shaped channel from `from` to `to` (flat bottom of `width`, curved walls of `radius`). */
export interface HalfpipePiece {
  kind: "halfpipe";
  from: V2;
  to: V2;
  y: number;
  width: number;
  radius: number;
  /** End caps closed (rails) at from/to — usually false so the ball can enter/exit. */
}

/** Loop-the-loop. Entry lane centred at `at`, travelling along `yaw`; exit is offset sideways. */
export interface LoopPiece {
  kind: "loop";
  at: V2;
  y: number;
  yaw: number;
  radius: number;
  width: number;
  /** +1: exit lane shifted to the right of travel, −1: to the left. */
  side?: 1 | -1;
}

export interface BumperPiece {
  kind: "bumper";
  at: V2;
  y: number;
  r: number;
}

export type ZoneSurface = "sand" | "ice";
export interface SurfaceZonePiece {
  kind: ZoneSurface;
  pts: V2[];
  y: number;
}

export interface BoostPiece {
  kind: "boost";
  at: V2;
  y: number;
  yaw: number;
  length?: number;
  width?: number;
  /** Override target speed. */
  speed?: number;
}

export interface BouncePadPiece {
  kind: "bounce";
  at: V2;
  y: number;
  r?: number;
  power?: number;
}

export interface ConveyorPiece {
  kind: "conveyor";
  at: V2;
  y: number;
  yaw: number;
  length: number;
  width: number;
  speed: number;
}

export interface TeleporterPiece {
  kind: "teleport";
  a: V3;
  b: V3;
  /** Exit direction (radians, 0 = −z). */
  exitYaw: number;
  color?: string;
}

/** Kinematic platform moving back and forth between `from` and `to` (centres). */
export interface MoverPiece {
  kind: "mover";
  from: V3;
  to: V3;
  size: V3;
  period: number;
  phase?: number;
  /** Pause at each end as a fraction of the period. */
  hold?: number;
}

/** Platform that rocks around its own x or z axis. */
export interface TiltPiece {
  kind: "tilt";
  at: V3;
  size: V3;
  axis: "x" | "z";
  amp: number;
  period: number;
  phase?: number;
}

/** Rotating sweeper bars around a vertical axis. */
export interface SpinnerPiece {
  kind: "spinner";
  at: V3;
  length: number;
  /** rad/s, sign = direction */
  speed: number;
  arms?: 1 | 2 | 3 | 4;
}

/** Windmill straddling a lane: ball passes through a tunnel under spinning blades. */
export interface WindmillPiece {
  kind: "windmill";
  at: V2;
  y: number;
  /** Direction of travel through the tunnel. */
  yaw: number;
  laneWidth: number;
  speed: number;
}

/** One-way flap gate: passable only when travelling along `yaw`. */
export interface GatePiece {
  kind: "gate";
  at: V2;
  y: number;
  yaw: number;
  width: number;
}

export type DecorKind = "tree" | "pine" | "rock" | "flower" | "bush" | "lollipop" | "candyCane" | "gumdrop" | "neonPillar" | "neonRing" | "crystal" | "cloud";
export interface DecorPiece {
  kind: "decor";
  type: DecorKind;
  at: V3;
  scale?: number;
  yaw?: number;
}

export type Piece =
  | FloorPiece
  | BlockPiece
  | HalfpipePiece
  | LoopPiece
  | BumperPiece
  | SurfaceZonePiece
  | BoostPiece
  | BouncePadPiece
  | ConveyorPiece
  | TeleporterPiece
  | MoverPiece
  | TiltPiece
  | SpinnerPiece
  | WindmillPiece
  | GatePiece
  | DecorPiece;

export interface HoleDef {
  id: string;
  name: string;
  par: number;
  tee: V3;
  cup: V3;
  pieces: Piece[];
  /** Collectible coins — usually on risky trick-shot lines. */
  coins?: V3[];
  /** Below this the ball is out of bounds (default: lowest floor − 3). */
  killY?: number;
  /** One-line tip shown on the hole intro card. */
  tip?: string;
  /** Marks a showcase hole. */
  wow?: boolean;
}

export interface CourseTheme {
  skyTop: string;
  skyBottom: string;
  fog: string;
  fogNear: number;
  fogFar: number;
  /** Whatever is below the course: a lake (splash) or a void (fall). */
  below: { kind: "water" | "void"; color: string; y: number };
  grass: string;
  grassAlt: string;
  green: string;
  path: string;
  cliff: string;
  rail: string;
  railTop: string;
  accent: string;
  sand: string;
  ice: string;
  sun: string;
  sunIntensity: number;
  ambient: string;
  ambientIntensity: number;
  bloom: number;
  /** Emissive-glow rails/edges (neon). */
  glowEdges?: boolean;
  ball: string;
  flag: string;
}

export interface WorldDef {
  id: string;
  name: string;
  subtitle: string;
  emoji: string;
  /** Stars needed (total across all holes) to unlock. */
  unlockStars: number;
  theme: CourseTheme;
  mood: "meadow" | "neon" | "candy";
  holes: HoleDef[];
}
