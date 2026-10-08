import { Bot, Users, Clock, Target, Crosshair } from "lucide-react";
import type { GameModule } from "../types";
import { DartsThumbnail } from "./Thumbnail";
import { useDartsSave, challengeStarsTotal } from "./save";

export const darts: GameModule = {
  id: "darts",
  title: "Darts",
  tagline: "Flick. Thunk. One hundred and eighty!",
  description: "501, 301 and Cricket against a sharp AI or a friend, plus Around the Clock and challenges.",
  colors: { from: "#8a3a22", to: "#2b120b", accent: "#e8433a" },
  Thumbnail: DartsThumbnail,
  music: "pub",
  howTo: [
    "Hold anywhere to aim — the reticle sits just above your finger and follows it finely.",
    "Flick up to throw. A smooth, quick flick flies true; too soft drops low, too hard sails high, sideways pulls it.",
    "Don't hold too long: your hand starts to wobble after a moment.",
    "In 501/301 finish exactly on zero with a double (or bull). The checkout hint shows the route.",
  ],
  menu: [
    { id: "ai", title: "vs Computer", subtitle: "501 · 301 · Cricket · 3 levels", icon: Bot, hasSetup: true },
    { id: "local", title: "2 Players", subtitle: "Pass and play on one device", icon: Users, hasSetup: true },
    { id: "clock", title: "Around the Clock", subtitle: "1 to 20, then the bull — fewest darts", icon: Clock, hasSetup: false },
    { id: "challenge", title: "Challenges", subtitle: "Ten three-dart puzzles", icon: Target, hasSetup: true },
    { id: "practice", title: "Practice", subtitle: "Free throwing, no pressure", icon: Crosshair, hasSetup: false },
  ],
  quickPlay: () => ({ entryId: "ai", params: { game: "501", level: "medium", legs: "1" }, label: "Quick 501" }),
  useProgressLabel: () => {
    const wins = useDartsSave((s) => s.wins);
    const t80 = useDartsSave((s) => s.oneEighties);
    if (!wins && !t80) return null;
    return [wins ? `${wins} win${wins === 1 ? "" : "s"}` : null, t80 ? `${t80}× 180` : null].filter(Boolean).join(" · ");
  },
  useTrophies: () => {
    const s = useDartsSave();
    return [
      { label: "Darts wins", value: s.wins, icon: "🎯", color: "var(--accent)" },
      { label: "180s", value: s.oneEighties, icon: "🔥", color: "#ff8a3d" },
      { label: "Challenge stars", value: challengeStarsTotal(s.challenges), icon: "★", color: "var(--gold)" },
    ];
  },
  loadPlay: () => import("./play/DartsPlay"),
  loadSetup: () => import("./setup/DartsSetup"),
};
