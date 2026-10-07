/** Table themes, unlocked through billiards progression. */
export interface TableTheme {
  id: string;
  name: string;
  felt: string;
  cushion: string;
  wood: string;
  woodDark: string;
  pocket: string;
  metal: string;
  room: string;
  /** Emissive edge strip (neon tables). */
  glow?: string;
  unlock: { wins?: number; hardWins?: number; trickStars?: number };
  unlockLabel: string;
}

export const TABLE_THEMES: TableTheme[] = [
  { id: "classic", name: "Classic Green", felt: "#1f7a58", cushion: "#196b4c", wood: "#6b3b1f", woodDark: "#4a2713", pocket: "#120c08", metal: "#c9a45c", room: "#14100d", unlock: {}, unlockLabel: "" },
  { id: "tournament", name: "Tournament Blue", felt: "#1e5aa8", cushion: "#184c8f", wood: "#2a1a10", woodDark: "#1a0f08", pocket: "#0b0b0b", metal: "#b9bcc4", room: "#0d1018", unlock: { wins: 1 }, unlockLabel: "Win 1 game" },
  { id: "burgundy", name: "Burgundy Club", felt: "#7d1f2e", cushion: "#6a1826", wood: "#3b2416", woodDark: "#26170d", pocket: "#0f0a08", metal: "#d6b56d", room: "#150c0c", unlock: { wins: 3 }, unlockLabel: "Win 3 games" },
  { id: "candy", name: "Bubblegum", felt: "#ff8cc6", cushion: "#f572b4", wood: "#fff4fa", woodDark: "#f0d6e4", pocket: "#3a1030", metal: "#ffffff", room: "#2a1424", unlock: { trickStars: 12 }, unlockLabel: "12 ★ in Trick Shots" },
  { id: "midnight", name: "Midnight", felt: "#1b1d33", cushion: "#16182b", wood: "#0e0f19", woodDark: "#07080e", pocket: "#000000", metal: "#5b9bff", room: "#05060b", glow: "#5b9bff", unlock: { wins: 6 }, unlockLabel: "Win 6 games" },
  { id: "neon", name: "Neon Arcade", felt: "#14002e", cushion: "#1e0045", wood: "#0b0b14", woodDark: "#050509", pocket: "#000000", metal: "#ff3df2", room: "#04020a", glow: "#ff3df2", unlock: { hardWins: 1 }, unlockLabel: "Beat the Hard AI" },
  { id: "gold", name: "High Roller", felt: "#0f3d2e", cushion: "#0c3326", wood: "#1a120a", woodDark: "#0d0905", pocket: "#000000", metal: "#ffcf40", room: "#0e0b06", glow: "#ffcf40", unlock: { wins: 15 }, unlockLabel: "Win 15 games" },
];

export function getTheme(id: string) {
  return TABLE_THEMES.find((t) => t.id === id) ?? TABLE_THEMES[0];
}
