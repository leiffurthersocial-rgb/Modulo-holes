/**
 * Central feel configuration.
 *
 * Every number that changes how the games *feel* lives here so it can be tuned in one place.
 * Units: distances in world units (golf ball radius ≈ 0.22), time in seconds, speeds in units/s.
 */

export const TUNING = {
  golf: {
    ball: {
      radius: 0.22,
      /** Restitution of the ball itself (combined with surfaces using "max"). */
      restitution: 0.32,
      mass: 1,
    },
    gravity: -24,
    physicsHz: 120,
    maxSubSteps: 6,
    shot: {
      /** Ball speed at 100% power. */
      maxSpeed: 23,
      /** Minimum speed so a tiny drag still nudges the ball. */
      minSpeed: 0.6,
      /** Screen-space drag (px) that maps to 100% power — scaled by viewport. */
      maxDragPx: 210,
      /** Power curve exponent (>1 = finer control at low power). */
      powerCurve: 1.35,
      /** Drags shorter than this (px) cancel the shot. */
      cancelDragPx: 14,
      /** Pointer must start within this many px of the ball (screen space) to aim. */
      grabRadiusPx: 90,
    },
    rolling: {
      /** Deceleration model on each surface: decel = constant + linear * speed (units/s²). */
      grass: { constant: 1.7, linear: 0.32 },
      sand: { constant: 9.0, linear: 2.6 },
      ice: { constant: 0.18, linear: 0.03 },
      /** Airborne drag (very small). */
      air: { constant: 0, linear: 0.04 },
      /** Below this speed (and grounded on a gentle slope) the ball counts as resting. */
      restSpeed: 0.28,
      restTime: 0.22,
      /** Hard cap on how long a shot can run before we force it to rest. */
      maxShotTime: 14,
    },
    surfaces: {
      floorRestitution: 0.28,
      railRestitution: 0.78,
      bumperRestitution: 1.0,
      bumperKick: 9,
      boostSpeed: 19,
      boostAccel: 70,
      bouncePadSpeed: 13,
      conveyorBlend: 6,
      teleportCooldown: 0.6,
      /** Penalty strokes for water / out-of-bounds. */
      hazardPenalty: 1,
      hazardResetDelay: 0.75,
    },
    cup: {
      radius: 0.5,
      depth: 0.7,
      /** Gentle pull toward the cup centre when rolling over the lip slowly (feel assist). */
      magnetRadius: 0.75,
      magnetStrength: 10,
      magnetMaxSpeed: 6,
      /** Faster than this and a ball can skip over the cup. */
      captureMaxSpeed: 13,
    },
    strokeCap: 10,
    camera: {
      distance: 7.5,
      minDistance: 3.5,
      maxDistance: 16,
      pitch: 0.62,
      followLerp: 5,
      yawLerp: 3,
      zoomNearCupDistance: 3.2,
      zoomNearCupScale: 0.6,
      orbitSensitivity: 0.008,
      fov: 50,
    },
    trajectory: {
      dots: 26,
      /** Preview length at 100% power. */
      maxLength: 9,
      bounceLengthFactor: 0.55,
    },
    celebration: {
      slowMoScale: 0.25,
      slowMoDuration: 0.9,
      shake: 0.55,
      holeInOneShake: 0.9,
      confetti: 160,
    },
  },

  billiards: {
    /** Real-world-ish units (metres). The table is rendered at this scale. */
    table: { length: 2.54, width: 1.27, cushionHeight: 0.037, pocketRadius: 0.062, cornerPocketRadius: 0.066 },
    ball: { radius: 0.028575 },
    physics: {
      dt: 1 / 960,
      /** Sliding friction coefficient (ball-cloth). */
      muSlide: 0.13,
      /** Rolling resistance coefficient. */
      muRoll: 0.011,
      /** Spin (z-axis) decay coefficient. */
      muSpin: 0.044,
      gravity: 9.81,
      ballRestitution: 0.95,
      cushionRestitution: 0.78,
      /** How much side-spin changes the rebound angle off a cushion. */
      cushionEnglish: 0.25,
      /** Collision-induced throw (tangential friction between balls). */
      ballThrow: 0.04,
      stopSpeed: 0.005,
    },
    shot: {
      maxSpeed: 7.5,
      minSpeed: 0.18,
      powerCurve: 1.6,
      /** Max tip offset as fraction of radius (beyond ~0.5 = miscue in real life). */
      maxTipOffset: 0.55,
      /** Break shots get extra pace (an amateur break is ~8–9 m/s). */
      breakBoost: 1.3,
      pullBackPx: 220,
    },
    juice: {
      breakShake: 0.35,
      potShake: 0.12,
      finalSlowMo: 0.35,
      finalSlowMoDuration: 1.1,
    },
    ai: {
      easy: { aimNoiseDeg: 3.2, powerNoise: 0.22, thinkTime: 0.9, lookAhead: 4 },
      medium: { aimNoiseDeg: 1.2, powerNoise: 0.1, thinkTime: 1.0, lookAhead: 10 },
      hard: { aimNoiseDeg: 0.25, powerNoise: 0.04, thinkTime: 1.1, lookAhead: 22 },
    },
  },

  darts: {
    /** Oche → board distance (m) and eye height. */
    oche: 2.37,
    boardHeight: 1.73,
    flight: {
      /** Real seconds a dart spends in the air. */
      time: 0.34,
      arc: 0.16,
    },
    flick: {
      /** Flick speed measured in screen-heights per second. Below `min` the throw is cancelled. */
      min: 0.45,
      idealLow: 1.5,
      idealHigh: 3.6,
      /** Metres of drop per unit of speed below the ideal band (soft throws land low). */
      softDrop: 0.085,
      /** Metres of rise per unit above the band. */
      hardRise: 0.045,
      /** Lateral metres per unit of sin(flick angle). */
      lateral: 0.11,
      /** Inherent human scatter (σ, metres). */
      scatter: 0.0035,
    },
    sway: {
      /** Aim wobble amplitude (m) while steady, and how it grows after `steadyTime` seconds held. */
      base: 0.0018,
      growth: 0.006,
      steadyTime: 1.6,
      max: 0.02,
    },
    /** Chance a dart landing within `wireZone` of a wire bounces out. */
    bounceOut: { chance: 0.32, wireZone: 0.0009 },
    ai: {
      easy: { sigma: 0.029, think: 0.7 },
      medium: { sigma: 0.0175, think: 0.6 },
      hard: { sigma: 0.0092, think: 0.5 },
    },
    juice: { hitShake: 0.08, bigShake: 0.6, checkoutSlowMo: 0.3, checkoutSlowMoTime: 0.9 },
  },

  juice: {
    shakeDecay: 1.6,
    shakeMaxOffset: 0.45,
    shakeMaxRoll: 0.035,
    shakeFrequency: 22,
    hitStopMax: 0.12,
    popupDuration: 1.25,
  },

  audio: {
    masterVolume: 0.9,
    musicVolume: 0.32,
    sfxVolume: 0.85,
  },
} as const;

export type GolfTuning = typeof TUNING.golf;
export type BilliardsTuning = typeof TUNING.billiards;
