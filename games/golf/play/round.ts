/** Round construction for each golf mode (campaign, quick, daily, pass-and-play). */
import { allHoles, getWorld, WORLDS, type HoleRef } from "../courses";
import { hashString, mulberry32, todayKey } from "@/engine/rng";
import type { GameParams } from "@/games/types";

export type GolfMode = "campaign" | "quick" | "daily" | "party";

export interface Player {
  name: string;
  color: string;
}

export interface Round {
  mode: GolfMode;
  holes: HoleRef[];
  players: Player[];
  /** Daily challenge date key. */
  date?: string;
}

export const PLAYER_COLORS = ["#ff5d73", "#4cc9f0", "#ffd166", "#06d6a0"];

export function unlockedWorldIds(stars: number) {
  return WORLDS.filter((w) => w.unlockStars <= stars && w.holes.length > 0).map((w) => w.id);
}

export function randomHole(stars: number, exclude?: string): HoleRef {
  const ids = unlockedWorldIds(stars);
  const pool = allHoles().filter((h) => ids.includes(h.world.id) && h.hole.id !== exclude);
  return pool[Math.floor(Math.random() * pool.length)] ?? allHoles()[0];
}

export function dailyHoles(date: string): HoleRef[] {
  const rand = mulberry32(hashString(`modulo-daily-${date}`));
  const pool = allHoles();
  const picks: HoleRef[] = [];
  while (picks.length < Math.min(3, pool.length)) {
    const h = pool[Math.floor(rand() * pool.length)];
    if (!picks.includes(h)) picks.push(h);
  }
  return picks;
}

export function makeRound(entryId: string, params: GameParams, stars: number): Round {
  const solo: Player[] = [{ name: "You", color: PLAYER_COLORS[0] }];
  switch (entryId) {
    case "quick":
      return { mode: "quick", holes: [randomHole(stars)], players: solo };
    case "daily": {
      const date = params.date ?? todayKey();
      return { mode: "daily", holes: dailyHoles(date), players: solo, date };
    }
    case "party": {
      const n = Math.max(2, Math.min(4, parseInt(params.players ?? "2", 10) || 2));
      const world = getWorld(params.world ?? "meadow");
      const count = Math.max(1, Math.min(world.holes.length, parseInt(params.holes ?? "3", 10) || 3));
      const names = (params.names ?? "").split(",").filter(Boolean);
      return {
        mode: "party",
        holes: world.holes.slice(0, count).map((hole, index) => ({ world, hole, index })),
        players: Array.from({ length: n }, (_, i) => ({ name: names[i] || `Player ${i + 1}`, color: PLAYER_COLORS[i] })),
      };
    }
    default: {
      const world = getWorld(params.world ?? "meadow");
      const start = Math.max(0, Math.min(world.holes.length - 1, parseInt(params.hole ?? "0", 10) || 0));
      return { mode: "campaign", holes: world.holes.slice(start).map((hole, i) => ({ world, hole, index: start + i })), players: solo };
    }
  }
}
