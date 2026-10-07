/**
 * Lazy Rapier loader. The -compat build embeds the WASM as base64 so it works in the
 * browser, in Node (headless course verification) and on Vercel with zero config.
 */
import type RAPIER_T from "@dimforge/rapier3d-compat";

export type Rapier = typeof RAPIER_T;

let promise: Promise<Rapier> | null = null;
let instance: Rapier | null = null;

export function loadRapier(): Promise<Rapier> {
  if (!promise) {
    promise = import("@dimforge/rapier3d-compat").then(async (mod) => {
      const R = ((mod as unknown as { default?: Rapier }).default ?? mod) as Rapier;
      await R.init();
      instance = R;
      return R;
    });
  }
  return promise;
}

/** Synchronous access once loaded (throws if not yet initialised). */
export function rapier(): Rapier {
  if (!instance) throw new Error("Rapier not loaded yet — await loadRapier() first");
  return instance;
}
