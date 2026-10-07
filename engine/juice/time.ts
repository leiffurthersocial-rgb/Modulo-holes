/**
 * Global game clock with juice controls: hit-stop (brief freeze) and slow-motion.
 * Games advance their simulations with `tickTime(realDt)` which returns the scaled dt.
 */
import { TUNING } from "@/config/tuning";

const state = {
  scale: 1,
  slowScale: 1,
  slowUntil: 0,
  hitStopUntil: 0,
  elapsed: 0,
};

const now = () => (typeof performance !== "undefined" ? performance.now() / 1000 : 0);

/** Freeze simulation briefly (seconds). Big impacts feel heavier with 40–100ms of stop. */
export function hitStop(seconds: number) {
  const s = Math.min(seconds, TUNING.juice.hitStopMax);
  state.hitStopUntil = Math.max(state.hitStopUntil, now() + s);
}

/** Slow time to `scale` for `duration` seconds (real time), then ease back to 1. */
export function slowMo(scale: number, duration: number) {
  state.slowScale = Math.min(state.slowScale, scale);
  state.slowUntil = Math.max(state.slowUntil, now() + duration);
}

export function resetTime() {
  state.scale = 1;
  state.slowScale = 1;
  state.slowUntil = 0;
  state.hitStopUntil = 0;
}

/** Advance the clock; returns scaled dt for the simulation. */
export function tickTime(realDt: number): number {
  const t = now();
  if (t < state.hitStopUntil) {
    state.scale = 0;
    return 0;
  }
  const target = t < state.slowUntil ? state.slowScale : 1;
  if (t >= state.slowUntil) state.slowScale = 1;
  // Ease into slow-mo quickly, out of it gently.
  const rate = target < state.scale ? 14 : 3.5;
  state.scale += (target - state.scale) * Math.min(1, rate * realDt);
  if (Math.abs(state.scale - 1) < 0.002) state.scale = 1;
  const dt = realDt * state.scale;
  state.elapsed += dt;
  return dt;
}

export const timeScale = () => state.scale;
