"use client";
import { create } from "zustand";
import type { BPhase } from "./game";
import type { Group } from "../sim/rules";

export interface BilliardsHud {
  cueCam: boolean;
  phase: BPhase;
  turn: 0 | 1;
  groups: [Group | null, Group | null];
  onTable: number[];
  ballInHand: boolean;
  kitchen: boolean;
  aiThinking: boolean;
  streak: number;
  set: (p: Partial<Omit<BilliardsHud, "set">>) => void;
}

export const useBilliardsHud = create<BilliardsHud>((set) => ({
  cueCam: false,
  phase: "aim",
  turn: 0,
  groups: [null, null],
  onTable: [],
  ballInHand: false,
  kitchen: false,
  aiThinking: false,
  streak: 0,
  set: (p) => set(p),
}));
