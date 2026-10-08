/**
 * Throw model. Players aim with a reticle and *flick* to throw: flick speed inside the ideal
 * band flies true, a soft flick drops low, an over-hard flick sails high, and a sideways flick
 * pulls the dart left/right. AI throws use a Gaussian scatter around their chosen target.
 */
import { TUNING } from "@/config/tuning";

const F = TUNING.darts.flick;

export type FlickQuality = "soft" | "perfect" | "hard";

export interface FlickResult {
  x: number;
  y: number;
  quality: FlickQuality;
  /** 0..1 position of the flick speed on the meter (for UI feedback). */
  meter: number;
}

export function gauss(rand: () => number) {
  return Math.sqrt(-2 * Math.log(rand() + 1e-12)) * Math.cos(2 * Math.PI * rand());
}

/** Speed in screen-heights/s; vx/vy in the same units (vy > 0 = upward). */
export function resolveFlick(aimX: number, aimY: number, vx: number, vy: number, rand: () => number = Math.random): FlickResult | null {
  const speed = Math.hypot(vx, vy);
  if (vy < F.min) return null;
  let dy = 0;
  let quality: FlickQuality = "perfect";
  if (speed < F.idealLow) {
    dy = -(F.idealLow - speed) * F.softDrop;
    quality = "soft";
  } else if (speed > F.idealHigh) {
    dy = (speed - F.idealHigh) * F.hardRise;
    quality = "hard";
  } else {
    // Gentle bias inside the band so it still rewards a smooth, centred flick.
    const mid = (F.idealLow + F.idealHigh) / 2;
    dy = ((speed - mid) / (F.idealHigh - F.idealLow)) * 0.008;
  }
  const angle = Math.atan2(vx, vy);
  const dx = Math.sin(angle) * F.lateral;
  return {
    x: aimX + dx + gauss(rand) * F.scatter,
    y: aimY + dy + gauss(rand) * F.scatter,
    quality,
    meter: Math.max(0, Math.min(1, speed / (F.idealHigh * 1.4))),
  };
}

export function aiScatter(tx: number, ty: number, sigma: number, rand: () => number = Math.random): [number, number] {
  return [tx + gauss(rand) * sigma, ty + gauss(rand) * sigma];
}
