/** Board rooms and flight designs, unlocked through darts progression. */
export interface BoardTheme {
  id: string;
  name: string;
  /** Single-bed colours (dark, light), double/treble colours (red, green). */
  dark: string;
  light: string;
  red: string;
  green: string;
  wire: string;
  surround: string;
  wall: "brick" | "panel" | "neon" | "candy";
  wallColor: string;
  cabinet: string;
  /** LED ring around the board. */
  ring?: string;
  lamp: string;
  unlock: { wins?: number; oneEighties?: number; challengeStars?: number };
  unlockLabel: string;
}

export const BOARD_THEMES: BoardTheme[] = [
  { id: "pub", name: "The Local", dark: "#1b1a18", light: "#efe1bd", red: "#cf2a2a", green: "#14803c", wire: "#d9d9d9", surround: "#121212", wall: "brick", wallColor: "#7a3b28", cabinet: "#5b3519", lamp: "#ffe2b0", unlock: {}, unlockLabel: "" },
  { id: "stage", name: "Ally Pally", dark: "#141414", light: "#f2e7c9", red: "#e02b2b", green: "#0f8a3f", wire: "#f0f0f0", surround: "#0d0d10", wall: "panel", wallColor: "#0d1430", cabinet: "#141826", ring: "#ffffff", lamp: "#ffffff", unlock: { wins: 2 }, unlockLabel: "Win 2 matches" },
  { id: "neon", name: "Neon Arcade", dark: "#0b0820", light: "#2a1a55", red: "#ff2fd6", green: "#21e6ff", wire: "#9af7ff", surround: "#05030f", wall: "neon", wallColor: "#07051a", cabinet: "#120a2a", ring: "#ff3df2", lamp: "#c7b8ff", unlock: { oneEighties: 1 }, unlockLabel: "Hit a 180" },
  { id: "candy", name: "Sugar Rush", dark: "#ff7cbf", light: "#fff3fa", red: "#7c4dff", green: "#2ed3a0", wire: "#ffffff", surround: "#ffb3da", wall: "candy", wallColor: "#ffd1ea", cabinet: "#ffffff", lamp: "#fff4fb", unlock: { challengeStars: 15 }, unlockLabel: "15 ★ in Challenges" },
];

export interface FlightDesign {
  id: string;
  name: string;
  pattern: "stripe" | "flame" | "galaxy" | "chequer" | "gold";
  unlock: { oneEighties?: number; bulls?: number; hardWins?: number; challengeStars?: number };
  unlockLabel: string;
}

export const FLIGHTS: FlightDesign[] = [
  { id: "classic", name: "Classic", pattern: "stripe", unlock: {}, unlockLabel: "" },
  { id: "flame", name: "Flame", pattern: "flame", unlock: { bulls: 10 }, unlockLabel: "Hit 10 bulls" },
  { id: "galaxy", name: "Galaxy", pattern: "galaxy", unlock: { oneEighties: 1 }, unlockLabel: "Hit a 180" },
  { id: "chequer", name: "Chequered", pattern: "chequer", unlock: { hardWins: 1 }, unlockLabel: "Beat the Pro" },
  { id: "gold", name: "24K", pattern: "gold", unlock: { challengeStars: 30 }, unlockLabel: "All challenges ★★★" },
];

export const getBoardTheme = (id: string) => BOARD_THEMES.find((t) => t.id === id) ?? BOARD_THEMES[0];
export const getFlight = (id: string) => FLIGHTS.find((f) => f.id === id) ?? FLIGHTS[0];
