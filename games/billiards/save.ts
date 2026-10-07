"use client";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { saveKey, saveStorage } from "@/engine/save/storage";
import { TABLE_THEMES, type TableTheme } from "./themes";

interface BilliardsSave {
  wins: number;
  losses: number;
  winsByLevel: { easy: number; medium: number; hard: number };
  trick: Record<string, number>; // id → best stars
  theme: string;
  bestStreak: number;
  totalPots: number;
  recordGame: (won: boolean, level: "easy" | "medium" | "hard" | null) => void;
  recordTrick: (id: string, stars: number) => void;
  addPots: (n: number, streak: number) => void;
  setTheme: (id: string) => void;
}

export const useBilliardsSave = create<BilliardsSave>()(
  persist(
    (set, get) => ({
      wins: 0,
      losses: 0,
      winsByLevel: { easy: 0, medium: 0, hard: 0 },
      trick: {},
      theme: "classic",
      bestStreak: 0,
      totalPots: 0,
      recordGame: (won, level) => {
        const s = get();
        if (!won) return set({ losses: s.losses + 1 });
        set({ wins: s.wins + 1, winsByLevel: level ? { ...s.winsByLevel, [level]: s.winsByLevel[level] + 1 } : s.winsByLevel });
      },
      recordTrick: (id, stars) => set({ trick: { ...get().trick, [id]: Math.max(get().trick[id] ?? 0, stars) } }),
      addPots: (n, streak) => set({ totalPots: get().totalPots + n, bestStreak: Math.max(get().bestStreak, streak) }),
      setTheme: (theme) => set({ theme }),
    }),
    { name: saveKey("billiards"), version: 1, storage: saveStorage },
  ),
);

export function trickStarsTotal(trick: Record<string, number>) {
  return Object.values(trick).reduce((a, b) => a + b, 0);
}

export function themeUnlocked(t: TableTheme, s: Pick<BilliardsSave, "wins" | "winsByLevel" | "trick">) {
  const u = t.unlock;
  return (u.wins ?? 0) <= s.wins && (u.hardWins ?? 0) <= s.winsByLevel.hard && (u.trickStars ?? 0) <= trickStarsTotal(s.trick);
}

export function unlockedThemes(s: Pick<BilliardsSave, "wins" | "winsByLevel" | "trick">) {
  return TABLE_THEMES.filter((t) => themeUnlocked(t, s));
}
