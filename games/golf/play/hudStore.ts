"use client";
import { create } from "zustand";
import type { GolfPhase } from "../sim/GolfSim";

/** Lightweight HUD mirror of the simulation (updated only when values change). */
export interface GolfHud {
  strokes: number;
  phase: GolfPhase;
  aiming: boolean;
  power: number;
  coins: number;
  overview: boolean;
  set: (p: Partial<Omit<GolfHud, "set">>) => void;
}

export const useGolfHud = create<GolfHud>((set) => ({
  strokes: 0,
  phase: "aim",
  aiming: false,
  power: 0,
  coins: 0,
  overview: false,
  set: (p) => set(p),
}));
