import { Circle, Target, Users, Bot } from "lucide-react";
import type { GameModule } from "../types";
import { BilliardsThumbnail } from "./Thumbnail";
import { useBilliardsSave, trickStarsTotal } from "./save";

export const billiards: GameModule = {
  id: "billiards",
  title: "Billiards",
  tagline: "Smooth strokes, satisfying clicks",
  description: "8-ball and 9-ball against a sharp AI or a friend, plus trick-shot puzzles.",
  colors: { from: "#1e7a5c", to: "#0c3b33", accent: "#ffb020" },
  Thumbnail: BilliardsThumbnail,
  music: "lounge",
  howTo: [
    "Drag on the table to aim — the ghost ball shows exactly where you'll make contact.",
    "Pull the cue back with the power slider and release to shoot.",
    "Tap the cue-ball widget to add english: top, back or side spin.",
    "Pot your group (or the lowest ball in 9-ball) — fouls give your opponent ball-in-hand.",
  ],
  menu: [
    { id: "ai", title: "vs Computer", subtitle: "8-ball or 9-ball · 3 difficulty levels", icon: Bot, hasSetup: true },
    { id: "local", title: "2 Players", subtitle: "Pass and play on one device", icon: Users, hasSetup: true },
    { id: "trick", title: "Trick Shots", subtitle: "Puzzle challenges", icon: Target, hasSetup: true },
    { id: "practice", title: "Practice", subtitle: "Free table, no rules", icon: Circle, hasSetup: false },
  ],
  quickPlay: () => ({ entryId: "ai", params: { rules: "8ball", level: "medium" }, label: "Quick 8-Ball" }),
  useProgressLabel: () => {
    const wins = useBilliardsSave((s) => s.wins);
    const trick = useBilliardsSave((s) => s.trick);
    const stars = trickStarsTotal(trick);
    if (!wins && !stars) return null;
    return [wins ? `${wins} win${wins === 1 ? "" : "s"}` : null, stars ? `${stars}★ tricks` : null].filter(Boolean).join(" · ");
  },
  useTrophies: () => {
    const wins = useBilliardsSave((s) => s.wins);
    const trick = useBilliardsSave((s) => s.trick);
    return [
      { label: "Pool wins", value: wins, icon: "🏆", color: "var(--accent)" },
      { label: "Trick stars", value: trickStarsTotal(trick), icon: "★", color: "var(--gold)" },
    ];
  },
  loadPlay: () => import("./play/BilliardsPlay"),
  loadSetup: () => import("./setup/BilliardsSetup"),
};
