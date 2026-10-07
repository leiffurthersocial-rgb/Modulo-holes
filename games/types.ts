import type { ComponentType } from "react";
import type { MusicMood } from "@/engine/audio/audio";

/** Query-string style params passed between a mode's setup screen and its play screen. */
export type GameParams = Record<string, string>;

export interface PlayProps {
  /** Which menu entry (mode) is being played. */
  entryId: string;
  params: GameParams;
  /** Leave the play screen (back to the mode's setup or the game menu). */
  onExit: () => void;
  /** Jump to another play configuration (e.g. "next hole"). */
  onNavigate: (entryId: string, params: GameParams) => void;
}

export interface SetupProps {
  entryId: string;
  onStart: (params: GameParams) => void;
  onBack: () => void;
}

export interface GameMenuEntry {
  /** URL segment, e.g. "campaign". */
  id: string;
  title: string;
  subtitle: string;
  icon: ComponentType<{ size?: number; className?: string }>;
  /** If true the entry shows a setup screen (level / difficulty select) before playing. */
  hasSetup: boolean;
  /** Return a lock reason (or null when available). Runs on the client. */
  locked?: () => string | null;
}

export interface QuickPlay {
  entryId: string;
  params: GameParams;
  label: string;
}

/**
 * The contract every game implements. A module is self-contained: its rules, state, input
 * handling and scene live in `/games/<id>/` and are lazy-loaded so the hub stays tiny.
 * Register a module in `games/registry.ts` and it appears in the hub automatically.
 */
export interface GameModule {
  id: string;
  title: string;
  tagline: string;
  description: string;
  /** Card gradient + accent. */
  colors: { from: string; to: string; accent: string };
  Thumbnail: ComponentType<{ active?: boolean }>;
  menu: GameMenuEntry[];
  /** Short "how to play" bullets shown in the game menu. */
  howTo: string[];
  music: MusicMood;
  /** Where the big Play button goes (continue campaign, etc). Runs on the client. */
  quickPlay: () => QuickPlay;
  /** Optional one-line progress summary for the hub card ("14★ · World 2"). */
  useProgressLabel?: () => string | null;
  loadPlay: () => Promise<{ default: ComponentType<PlayProps> }>;
  loadSetup?: () => Promise<{ default: ComponentType<SetupProps> }>;
}
