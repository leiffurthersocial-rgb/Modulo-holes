import { Flag, Shuffle, CalendarDays, Users } from "lucide-react";
import type { GameModule } from "../types";
import { GolfThumbnail } from "./Thumbnail";
import { useGolfSave, totalStars, totalCoins } from "./save";
import { WORLDS } from "./courses";

export const golf: GameModule = {
  id: "golf",
  title: "Golf",
  tagline: "Mini golf with maximum chaos",
  description: "27 handcrafted holes of loops, windmills, teleporters and trick shots.",
  colors: { from: "#43c06a", to: "#1f8f7a", accent: "#ff5d4d" },
  Thumbnail: GolfThumbnail,
  music: "meadow",
  howTo: [
    "Drag back from the ball and release to putt — the further you pull, the harder the hit.",
    "The dotted line previews your shot and bends at the first bounce.",
    "Drag anywhere else to orbit the camera, pinch or scroll to zoom, tap the map for an overview.",
    "Finish under par for more stars. Stars unlock new worlds; coins unlock ball skins.",
  ],
  menu: [
    { id: "campaign", title: "Campaign", subtitle: "3 worlds · 27 holes", icon: Flag, hasSetup: true },
    { id: "quick", title: "Quick Round", subtitle: "A random hole, right now", icon: Shuffle, hasSetup: false },
    { id: "daily", title: "Daily Challenge", subtitle: "3 holes · same for everyone today", icon: CalendarDays, hasSetup: true },
    { id: "party", title: "Pass & Play", subtitle: "2–4 players, one device", icon: Users, hasSetup: true },
  ],
  quickPlay: () => {
    const s = useGolfSave.getState();
    if (s.last) {
      const w = WORLDS.find((x) => x.id === s.last!.world);
      if (w && w.holes[s.last.index]) {
        return { entryId: "campaign", params: { world: w.id, hole: String(s.last.index) }, label: `Continue · ${w.emoji} ${s.last.index + 1}` };
      }
    }
    return { entryId: "campaign", params: { world: "meadow", hole: "0" }, label: "Play" };
  },
  useProgressLabel: () => {
    const holes = useGolfSave((s) => s.holes);
    const stars = totalStars(holes);
    const max = WORLDS.reduce((a, w) => a + w.holes.length * 3, 0);
    return stars > 0 ? `${stars}/${max} stars` : null;
  },
  useTrophies: () => {
    const holes = useGolfSave((s) => s.holes);
    const hio = useGolfSave((s) => s.holesInOne);
    return [
      { label: "Golf stars", value: totalStars(holes), icon: "★", color: "var(--gold)" },
      { label: "Coins", value: totalCoins(holes), icon: "●", color: "#ffb300" },
      { label: "Holes in one", value: hio, icon: "⛳", color: "var(--good)" },
    ];
  },
  loadPlay: () => import("./play/GolfPlay"),
  loadSetup: () => import("./setup/GolfSetup"),
};

