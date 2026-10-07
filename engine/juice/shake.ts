/**
 * Trauma-based screen shake (Squirrel Eiserloh's GDC talk): shake = trauma², decays linearly.
 * Camera rigs read `shakeOffset()` each frame.
 */
import { TUNING } from "@/config/tuning";

let trauma = 0;
let punch = 0;
let seed = Math.random() * 1000;

export function addTrauma(amount: number) {
  trauma = Math.min(1, trauma + amount);
}

/** Camera "punch": a quick FOV / dolly kick, 0..1 */
export function cameraPunch(amount: number) {
  punch = Math.min(1.5, punch + amount);
}

export function updateShake(dt: number) {
  trauma = Math.max(0, trauma - TUNING.juice.shakeDecay * dt);
  punch = Math.max(0, punch - punch * Math.min(1, 6 * dt) - 0.01 * dt);
  seed += dt * TUNING.juice.shakeFrequency;
}

// Cheap smooth noise from summed sines.
const n = (s: number, k: number) => Math.sin(s * 1.0 + k) * 0.6 + Math.sin(s * 2.31 + k * 3.7) * 0.4;

export function shakeOffset() {
  const s = trauma * trauma;
  const m = TUNING.juice.shakeMaxOffset * s;
  return {
    x: n(seed, 1.3) * m,
    y: n(seed, 7.9) * m,
    z: n(seed, 4.1) * m,
    roll: n(seed, 11.7) * TUNING.juice.shakeMaxRoll * s,
    punch,
  };
}

export function resetShake() {
  trauma = 0;
  punch = 0;
}
