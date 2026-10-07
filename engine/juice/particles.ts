/**
 * Particle emitter bus. Game code calls `emitParticles(...)` from anywhere; the
 * <ParticleSystem/> mounted inside the Canvas consumes the queue.
 */
export type ParticleKind = "confetti" | "spark" | "dust" | "splash" | "ring" | "star";

export interface EmitOptions {
  kind: ParticleKind;
  position: [number, number, number];
  count?: number;
  colors?: string[];
  /** Initial speed (units/s). */
  speed?: number;
  /** 0 = straight up cone, 1 = full sphere. */
  spread?: number;
  /** Optional base direction (normalised in system). */
  direction?: [number, number, number];
  gravity?: number;
  life?: number;
  size?: number;
}

type Listener = (e: EmitOptions) => void;
const listeners = new Set<Listener>();

export function emitParticles(e: EmitOptions) {
  listeners.forEach((l) => l(e));
}

export function onEmitParticles(l: Listener) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

export const PALETTE_CONFETTI = ["#ff5d73", "#ffd166", "#06d6a0", "#4cc9f0", "#b388ff", "#ffffff"];
