import { lazy, type ComponentType, type LazyExoticComponent } from "react";
import { GAMES } from "@/games/registry";
import type { PlayProps, SetupProps } from "@/games/types";

// Lazy components are created once at module scope — never during render.
export const PLAY_COMPONENTS: Record<string, LazyExoticComponent<ComponentType<PlayProps>>> = Object.fromEntries(
  GAMES.map((g) => [g.id, lazy(g.loadPlay)]),
);

export const SETUP_COMPONENTS: Record<string, LazyExoticComponent<ComponentType<SetupProps>> | undefined> = Object.fromEntries(
  GAMES.map((g) => [g.id, g.loadSetup ? lazy(g.loadSetup) : undefined]),
);
