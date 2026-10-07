/** Golf ball skins — unlocked by total stars or coins collected. */
export interface BallSkin {
  id: string;
  name: string;
  color: string;
  stripe?: string;
  emissive?: string;
  pattern: "solid" | "stripe" | "dots" | "rainbow" | "galaxy";
  unlock: { stars?: number; coins?: number };
}

export const SKINS: BallSkin[] = [
  { id: "classic", name: "Classic", color: "#ffffff", stripe: "#ff5d73", pattern: "stripe", unlock: {} },
  { id: "sunset", name: "Sunset", color: "#ff9f43", stripe: "#ffd166", pattern: "stripe", unlock: { stars: 8 } },
  { id: "mint", name: "Mint Chip", color: "#a8f0dc", stripe: "#3b2a20", pattern: "dots", unlock: { coins: 10 } },
  { id: "ocean", name: "Ocean", color: "#4cc9f0", stripe: "#ffffff", pattern: "stripe", unlock: { stars: 20 } },
  { id: "bubblegum", name: "Bubblegum", color: "#ff7ac6", stripe: "#ffffff", pattern: "dots", unlock: { coins: 25 } },
  { id: "neon", name: "Neon", color: "#111111", stripe: "#36f9f6", emissive: "#36f9f6", pattern: "stripe", unlock: { stars: 35 } },
  { id: "galaxy", name: "Galaxy", color: "#1b1446", stripe: "#b388ff", emissive: "#5b3cff", pattern: "galaxy", unlock: { stars: 50 } },
  { id: "rainbow", name: "Rainbow", color: "#ffffff", pattern: "rainbow", unlock: { coins: 45 } },
  { id: "gold", name: "24K", color: "#ffcf40", stripe: "#fff3b0", emissive: "#7a5200", pattern: "solid", unlock: { stars: 70 } },
];

export function skinUnlocked(s: BallSkin, stars: number, coins: number) {
  return (s.unlock.stars ?? 0) <= stars && (s.unlock.coins ?? 0) <= coins;
}

export function getSkin(id: string) {
  return SKINS.find((s) => s.id === id) ?? SKINS[0];
}
