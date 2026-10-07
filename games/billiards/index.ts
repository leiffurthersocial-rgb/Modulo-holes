import { Circle, Target, Users, Bot } from "lucide-react";
import type { GameModule } from "../types";
import { BilliardsThumbnail } from "./Thumbnail";

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
  quickPlay: () => ({ entryId: "ai", params: { rules: "8ball", level: "medium" }, label: "Play" }),
  loadPlay: () => import("./play/BilliardsPlay"),
};
