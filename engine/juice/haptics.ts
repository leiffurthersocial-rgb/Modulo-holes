import { getSettings } from "@/engine/save/settings";

/** Named vibration patterns (ms). Android Chrome supports these; iOS Safari ignores silently. */
export const HAPTIC = {
  tick: 6,
  light: 12,
  medium: 24,
  heavy: 45,
  success: [18, 40, 28],
  celebrate: [30, 50, 30, 50, 70],
  fail: [50, 30, 50],
} as const;

export function haptic(pattern: keyof typeof HAPTIC | number | number[]) {
  if (typeof navigator === "undefined" || !("vibrate" in navigator)) return;
  if (!getSettings().haptics) return;
  const p = typeof pattern === "string" ? HAPTIC[pattern] : pattern;
  try {
    navigator.vibrate(p as number | number[]);
  } catch {
    /* ignore */
  }
}
