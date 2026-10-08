"use client";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { saveKey, saveStorage } from "@/engine/save/storage";
import { BOARD_THEMES, FLIGHTS, type BoardTheme, type FlightDesign } from "./themes";

interface DartsSave {
  wins: number;
  winsByLevel: { easy: number; medium: number; hard: number };
  oneEighties: number;
  bulls: number;
  bestAverage: number;
  bestCheckout: number;
  /** Around the Clock: fewest darts. */
  clockBest: number | null;
  challenges: Record<string, number>;
  theme: string;
  flight: string;
  recordMatch: (won: boolean, level: "easy" | "medium" | "hard" | null, average: number) => void;
  addStats: (s: { oneEighties?: number; bulls?: number; checkout?: number }) => void;
  recordClock: (darts: number) => boolean;
  recordChallenge: (id: string, stars: number) => void;
  setTheme: (id: string) => void;
  setFlight: (id: string) => void;
}

export const useDartsSave = create<DartsSave>()(
  persist(
    (set, get) => ({
      wins: 0,
      winsByLevel: { easy: 0, medium: 0, hard: 0 },
      oneEighties: 0,
      bulls: 0,
      bestAverage: 0,
      bestCheckout: 0,
      clockBest: null,
      challenges: {},
      theme: "pub",
      flight: "classic",
      recordMatch: (won, level, average) => {
        const s = get();
        set({
          bestAverage: Math.max(s.bestAverage, Math.round(average * 10) / 10),
          ...(won ? { wins: s.wins + 1, winsByLevel: level ? { ...s.winsByLevel, [level]: s.winsByLevel[level] + 1 } : s.winsByLevel } : {}),
        });
      },
      addStats: ({ oneEighties = 0, bulls = 0, checkout = 0 }) => {
        const s = get();
        set({ oneEighties: s.oneEighties + oneEighties, bulls: s.bulls + bulls, bestCheckout: Math.max(s.bestCheckout, checkout) });
      },
      recordClock: (darts) => {
        const b = get().clockBest;
        if (b !== null && b <= darts) return false;
        set({ clockBest: darts });
        return true;
      },
      recordChallenge: (id, stars) => set({ challenges: { ...get().challenges, [id]: Math.max(get().challenges[id] ?? 0, stars) } }),
      setTheme: (theme) => set({ theme }),
      setFlight: (flight) => set({ flight }),
    }),
    { name: saveKey("darts"), version: 1, storage: saveStorage },
  ),
);

type Progress = Pick<DartsSave, "wins" | "winsByLevel" | "oneEighties" | "bulls" | "challenges">;

export const challengeStarsTotal = (c: Record<string, number>) => Object.values(c).reduce((a, b) => a + b, 0);

export function boardUnlocked(t: BoardTheme, s: Progress) {
  const u = t.unlock;
  return (u.wins ?? 0) <= s.wins && (u.oneEighties ?? 0) <= s.oneEighties && (u.challengeStars ?? 0) <= challengeStarsTotal(s.challenges);
}

export function flightUnlocked(f: FlightDesign, s: Progress) {
  const u = f.unlock;
  return (u.oneEighties ?? 0) <= s.oneEighties && (u.bulls ?? 0) <= s.bulls && (u.hardWins ?? 0) <= s.winsByLevel.hard && (u.challengeStars ?? 0) <= challengeStarsTotal(s.challenges);
}

export const unlockedNames = (s: Progress) => [...BOARD_THEMES.filter((t) => boardUnlocked(t, s)).map((t) => t.name), ...FLIGHTS.filter((f) => flightUnlocked(f, s)).map((f) => `${f.name} flights`)];
