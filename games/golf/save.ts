"use client";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { saveKey, saveStorage } from "@/engine/save/storage";

export interface HoleRecord {
  best: number;
  stars: number;
  /** Indices of coins ever collected on this hole. */
  coins: number[];
  plays: number;
}

interface GolfSave {
  holes: Record<string, HoleRecord>;
  /** Daily challenge: date → best score relative to par. */
  daily: Record<string, number>;
  skin: string;
  tutorialDone: boolean;
  last: { world: string; index: number } | null;
  holesInOne: number;
  recordHole: (id: string, strokes: number, stars: number, coins: number[]) => { newBest: boolean; newStars: number };
  recordDaily: (date: string, toPar: number) => boolean;
  setSkin: (id: string) => void;
  setLast: (world: string, index: number) => void;
  markTutorialDone: () => void;
  addHoleInOne: () => void;
}

export const useGolfSave = create<GolfSave>()(
  persist(
    (set, get) => ({
      holes: {},
      daily: {},
      skin: "classic",
      tutorialDone: false,
      last: null,
      holesInOne: 0,
      recordHole: (id, strokes, stars, coins) => {
        const prev = get().holes[id];
        const newBest = !prev || strokes < prev.best;
        const rec: HoleRecord = {
          best: prev ? Math.min(prev.best, strokes) : strokes,
          stars: Math.max(prev?.stars ?? 0, stars),
          coins: [...new Set([...(prev?.coins ?? []), ...coins])].sort(),
          plays: (prev?.plays ?? 0) + 1,
        };
        set({ holes: { ...get().holes, [id]: rec } });
        return { newBest, newStars: Math.max(0, rec.stars - (prev?.stars ?? 0)) };
      },
      recordDaily: (date, toPar) => {
        const prev = get().daily[date];
        if (prev !== undefined && prev <= toPar) return false;
        set({ daily: { ...get().daily, [date]: toPar } });
        return true;
      },
      setSkin: (skin) => set({ skin }),
      setLast: (world, index) => set({ last: { world, index } }),
      markTutorialDone: () => set({ tutorialDone: true }),
      addHoleInOne: () => set({ holesInOne: get().holesInOne + 1 }),
    }),
    { name: saveKey("golf"), version: 1, storage: saveStorage },
  ),
);

export function totalStars(holes: Record<string, HoleRecord>) {
  return Object.values(holes).reduce((a, h) => a + h.stars, 0);
}

export function totalCoins(holes: Record<string, HoleRecord>) {
  return Object.values(holes).reduce((a, h) => a + h.coins.length, 0);
}
